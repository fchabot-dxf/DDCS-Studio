"""poller.py — the heart: the single-active-job state machine (PROTOCOL §4).

Because the beacon frame carries no job id, only ONE job is active (running + tracked) at
a time. The poller serializes the queue:

  idle  : LIST inbox -> claim oldest -> Transfer to Expert -> DELETE from inbox -> "delivered"
            - TRACKED job (has a map w/ beacons): becomes active and is watched (below).
            - DELIVER-ONLY job (no map, e.g. a probe): "delivered" is terminal; slot stays free.
  active: watch the beacon source; each new valid n -> "running" + status update
          last beacon (complete) -> "done", free the slot
          no new beacon for stall_seconds -> "stalled", free the slot

No retention: the inbox/ entry is deleted the instant delivery succeeds (the bytes are now on
the controller and the map is held in memory for tracking). So inbox/ is a pure delivery queue
that holds a job only for the seconds between submit and pickup; live tracking runs off the
in-memory map + the status/ object. A crashed/restarted fairy therefore can't re-deliver a job
to a controller that's mid-cut.

One tick = one iteration. bridge.py calls tick() on a timer.
"""
import datetime
import time

from . import identity, tracker
from .config import ROLE_GATEWAY, effective_role


def _iso(ts):
    if ts is None:
        return None
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class Poller:
    def __init__(self, backend, transfer, beacons, config, log=print, on_checkpoint=None, on_sound=None):
        self.backend = backend
        self.transfer = transfer
        self.beacons = beacons
        self.cfg = config
        self.log = log
        self.active = None     # None when idle; else the active-job dict
        # Optional hook: on_checkpoint(n: int, active: dict) called after every new beacon.
        # Injected by bridge.py when --ws is active; None = no-op (self-test / demo unaffected).
        self.on_checkpoint = on_checkpoint
        # t2097 — optional hook: on_sound(event: 'received'|'delivered'|'failed') at the moments
        # PROVENANCE.md's three sounds name (a job was claimed / delivered to the controller / refused,
        # delivery failed, or stalled). Injected by bridge.py's run_loop() (mirroring on_checkpoint) only
        # when the Setup chime toggle is on; None = no-op, so fairy's own unit tests / --self-test (which
        # call build() directly and never reach run_loop()) can never trigger a sound.
        self.on_sound = on_sound

    def _sound(self, event):
        if self.on_sound is not None:
            try:
                self.on_sound(event)
            except Exception:      # never let a sound hook crash the poller
                pass

    # -- one iteration --------------------------------------------------------
    def tick(self):
        if self.active is None:
            self._maybe_claim()
        else:
            self._watch()

    # -- idle: pick up the next job ------------------------------------------
    def _maybe_claim(self):
        # t2103 (S0, ROLES-PLAN.md) — THE CLAIM GATE IS AUTHORITATIVE, never the UI: a role that hides tabs
        # while the poller still claims is worse than no role at all. Checked via effective_role (which
        # respects an explicit override), not expert_dest directly — a stale-config override to "client" must
        # win even when a leftover disk path is still configured.
        if effective_role(self.cfg) != ROLE_GATEWAY:
            return
        if not self.cfg.expert_dest:
            return                                  # gateway role, but no controller configured yet (Setup) — leave jobs queued
        # t2105 (JOB-RULES.md §2) — THE THIRD CLAIM CHECK, previously missing: CONFIGURED is not REACHABLE.
        # Without this, switching the mill off claimed the next job anyway, transfer.deliver() raised OSError,
        # and the existing except-branch called delete_job — the job was DESTROYED because a machine was
        # switched off. The inbox IS the queue (no retry counter/backoff/ceiling — deliberately not built,
        # JOB-RULES.md §6): not claiming already means waiting, so this simply leaves the job queued exactly
        # like the expert_dest check above, rather than claiming it into a delivery that cannot succeed.
        if not self.transfer.reachable():
            return
        ids = self.backend.list_inbox()
        if ids:
            self._claim(ids[0])                    # oldest jobId == FIFO

    def _claim(self, job_id):
        nc, m = self.backend.get_job(job_id)
        name = self._job_name(job_id, m)
        tracked = bool(m.get("total_beacons"))     # has a map with beacons -> Fusion cut; else deliver-only
        self.beacons.reset(m.get("marker") or 111)  # per-job marker; forget the previous job's beacons (§4)
        events = [f"claimed {job_id}"]
        self._sound("received")   # t2097 — a job came in, look up (the door chime)

        # safety: never deliver to the wrong controller (CONFIGS §7). Skipped if no machine_id configured.
        ok, reason = identity.verify(self.cfg.expert_dest, self.cfg.identity_filename, self.cfg.machine_id)
        if not ok:
            self.log(f"[poller] REFUSED {job_id}: {reason}")
            self._sound("failed")   # t2097 — a sibling bad outcome to delivery failure; same sound, free to share
            self.backend.put_status(
                job_id, tracker.build_status(job_id, name, m, "failed", 0, events + [f"refused: {reason}"]))
            self.backend.delete_job(job_id)
            return

        # t2101 (S4) — a SECOND, independent layer: the Drive backend now namespaces each machine's inbox by
        # folder, so this should never fire in practice, but the map itself may ALSO carry a machine_id (set by
        # whichever client submitted the job) — and if a job ever does end up in front of the wrong gateway
        # (a manual copy, a future backend without folder namespacing, a bug), this is the last line before an
        # Expert program reaches a V4.1. PRESENT-AND-MISMATCHED only, never require-present: a gateway-local
        # send never sets this field at all, and refusing an absent one would refuse every local job.
        job_machine_id = m.get("machine_id")
        if job_machine_id and self.cfg.machine_id and job_machine_id != self.cfg.machine_id:
            reason = f"job is for machine '{job_machine_id}', this gateway is '{self.cfg.machine_id}'"
            self.log(f"[poller] REFUSED {job_id}: {reason}")
            self._sound("failed")
            # t2066 — the SAME put-status-failed-then-delete_job as the identity refusal above, and for the
            # SAME reason: _maybe_claim always takes ids[0], so leaving this queued instead would wedge the
            # FIFO on this one job forever — every later job stuck behind a refusal that never resolves.
            self.backend.put_status(
                job_id, tracker.build_status(job_id, name, m, "failed", 0, events + [f"refused: {reason}"]))
            self.backend.delete_job(job_id)
            return

        # t2066 — DECLARE the one genuinely-unsafe window so a take-over can SEE it. The write to the controller is
        # the synchronous deliver() just below; until it returns there was no queue state meaning "a file is being
        # written right now" — delivered/running/stalled are ALL post-write. Mark "delivering" here so /api/queue
        # reports it for the duration of the copy (the HTTP thread reads it while this thread blocks in deliver);
        # delivered/failed overwrite it immediately after. This is the ONLY state a take-over should stop for
        # (fairy_gateway._transfer_in_flight) — the false "a job is in flight" alarm was gating on the post-write
        # states, which persist durably and made a forgotten job look like a live transfer forever.
        self.backend.put_status(
            job_id, tracker.build_status(job_id, name, m, "delivering", 0, events + ["writing to controller"]))
        try:
            dest = self.transfer.deliver(nc, name)
        except OSError as e:
            self.log(f"[poller] DELIVERY FAILED {job_id}: {e}")
            self._sound("failed")   # t2097 — the buzzer: wrong, every game show ever
            self.backend.put_status(
                job_id, tracker.build_status(job_id, name, m, "failed", 0, events + [f"delivery failed: {e}"]))
            self.backend.delete_job(job_id)        # don't wedge the queue on a bad job
            self._record_history(job_id, name, m, "failed", 0, None, None)
            return
        self.backend.delete_job(job_id)            # delivered -> bucket copy no longer needed (controller has it)
        # t2097 — the register: the transaction completed. ALL THREE success branches below pass through
        # this one line (deliver-only terminal, no-Modbus terminal, tracked-active), so one call covers all.
        self._sound("delivered")
        now = time.time()
        if not tracked:
            # deliver-only (probe / utility .nc): no beacons to watch; "delivered" is terminal
            self.backend.put_status(
                job_id, tracker.build_status(job_id, name, m, "delivered", 0,
                                             events + [f"delivered (deliver-only) -> {dest}"]))
            self._record_history(job_id, name, m, "delivered", 0, now, None)
            self.log(f"[poller] delivered (deliver-only) {name} ({job_id})")
            return
        if not self.cfg.enable_slave:
            # t2020 — beacons were requested (the map has total_beacons), but this bridge has no Modbus link
            # running (the admin "Beacons" toggle is off — the correct, labelled default for a V4.1 controller,
            # which has no Modbus RTU in firmware at all; see bridge/controllers/README.md). Left alone this
            # job would enter the watch loop below, never receive a beacon, and time out into "stalled" — a
            # controller INCAPABILITY mislabelled as a machine fault. The program is still valid, cuttable
            # G-code, so it still delivers; it just cannot be TRACKED, which is exactly the "delivered"
            # terminal state deliver-only jobs already use — no new job state invented.
            reason = "no Modbus link is active on this bridge (enable it in Setup, or leave it off for a V4.1 controller)"
            self.backend.put_status(
                job_id, tracker.build_status(job_id, name, m, "delivered", 0,
                                             events + [f"delivered ({reason}) -> {dest}"]))
            self._record_history(job_id, name, m, "delivered", 0, now, None)
            self.log(f"[poller] delivered ({reason}) {name} ({job_id})")
            return
        self.active = {
            "job_id": job_id, "name": name, "map": m,
            "total": m.get("total_beacons"),
            "last_beacon": 0, "events": events + [f"delivered -> {dest}"],
            "last_progress_at": now, "delivered_at": now, "started_at": None,
        }
        self.log(f"[poller] delivered {name} ({job_id}) -> awaiting Cycle Start + beacons")
        self._put("delivered")

    @staticmethod
    def _job_name(job_id, m):
        """Filename to deliver under. Prefer the map's source; else strip the jobId's timestamp
        prefix (`<ts>-<name>` -> `<name>.nc`)."""
        if m.get("source"):
            return m["source"]
        base = job_id.split("-", 1)[1] if "-" in job_id else job_id
        return base + ".nc"

    # -- active: watch beacons -----------------------------------------------
    def _watch(self):
        a = self.active
        now = time.time()
        latest = self.beacons.latest()
        if latest is not None and latest[0] > a["last_beacon"]:
            n, ts = latest
            if a["last_beacon"] == 0:
                a["started_at"] = ts               # first beacon = the run actually started
            a["last_beacon"] = n
            a["last_progress_at"] = ts
            a["events"].append(f"beacon {n}/{a['total']}")
            self.log(f"[poller] {a['name']}: beacon {n}/{a['total']}")
            # Notify telemetry hook (injected by bridge.py --ws; None = no-op)
            if self.on_checkpoint is not None:
                try:
                    self.on_checkpoint(n, dict(a))
                except Exception:              # never let the hook crash the poller
                    pass
            if self._is_complete(a, n):
                a["events"].append("done")
                self._put("done")                  # inbox copy already deleted at delivery
                self._record_history(a["job_id"], a["name"], a["map"], "done", a["last_beacon"], a["delivered_at"], a["started_at"])
                self.log(f"[poller] {a['name']}: DONE")
                self.active = None
            else:
                self._put("running")
            return

        # no new beacon: check for a stall
        if now - a["last_progress_at"] > self.cfg.stall_seconds:
            where = f"after beacon {a['last_beacon']}" if a["last_beacon"] else "after delivery (no Start?)"
            a["events"].append(f"stalled {where}")
            self._sound("failed")   # t2097 — the other sibling bad outcome; same shared failure sound
            self._put("stalled")                   # inbox copy already deleted at delivery
            self._record_history(a["job_id"], a["name"], a["map"], "stalled", a["last_beacon"], a["delivered_at"], a["started_at"])
            self.log(f"[poller] {a['name']}: STALLED {where}")
            self.active = None

    # -- helpers --------------------------------------------------------------
    def _is_complete(self, a, n):
        b = tracker.beacon_for(a["map"], n)
        if b and b.get("complete"):
            return True
        return a["total"] is not None and n >= a["total"]

    def _put(self, state):
        a = self.active
        self.backend.put_status(
            a["job_id"],
            tracker.build_status(a["job_id"], a["name"], a["map"], state, a["last_beacon"], a["events"]),
        )

    def _record_history(self, job_id, name, m, final_state, last_beacon, delivered_at, started_at):
        """Append a durable finished-job record (name, final state, run duration). History seam —
        consumed by the console History view and any later metrics.

        t2020 — `content_hash` (a SHA-256 of the NORMALISED G-code, computed client-side by `send.js` and
        carried through in the map since it applies to a deliver-only job too, not just a tracked one) rides
        through here so the History view can link two runs of the SAME program — job identity (jobId) stays
        timestamp+name, unique per SEND on purpose; content_hash is a SEPARATE, joinable field for "have I
        run this exact program before," not a replacement for jobId's own uniqueness."""
        ended = time.time()
        rec = {
            "jobId": job_id, "name": name, "final_state": final_state,
            "total_beacons": m.get("total_beacons"), "last_beacon": last_beacon,
            "delivered_at": _iso(delivered_at), "started_at": _iso(started_at), "ended_at": _iso(ended),
            "duration_s": round(ended - started_at) if started_at else None,
            "recorded_at": _iso(ended),
            "content_hash": m.get("content_hash"),
        }
        try:
            self.backend.append_history(rec)
        except Exception as e:
            self.log(f"[poller] history record failed for {job_id}: {e}")
