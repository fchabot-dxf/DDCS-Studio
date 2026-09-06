"""poller.py — the heart: claim the oldest queued job and deliver it (PROTOCOL §4).

t2649 (BACKLOG #78) — was a single-ACTIVE-job state machine, because the beacon frame carried no job id and
watching one job's progress needed the receiver's undivided attention. The beacon mechanism is REMOVED
(owner-directed 2026-09-04, never demonstrably ran end-to-end — BACKLOG #78's own evidence table) and its
replacement (live Modbus position/job-state polling, BACKLOG #79, t2647) is PROCESS-WIDE, not per-job — it
needs no "which job is this beacon for" exclusivity at all. So there is no more "active" phase: every claim
delivers and reaches a TERMINAL state (delivered/failed) within the same tick that claimed it.

  idle  : LIST inbox -> claim oldest -> Transfer to Expert -> DELETE from inbox -> "delivered" (terminal)

No retention: the inbox/ entry is deleted the instant delivery succeeds (the bytes are now on the
controller). So inbox/ is a pure delivery queue that holds a job only for the seconds between submit and
pickup. A crashed/restarted fairy therefore can't re-deliver a job to a controller mid-cut.

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
    def __init__(self, backend, transfer, config, log=print, on_sound=None):
        self.backend = backend
        self.transfer = transfer
        self.cfg = config
        self.log = log
        # t2097 — optional hook: on_sound(event: 'received'|'delivered'|'failed') at the moments
        # PROVENANCE.md's three sounds name (a job was claimed / delivered to the controller / refused or
        # delivery failed). Injected by bridge.py's run_loop() only when the Setup chime toggle is on;
        # None = no-op, so fairy's own unit tests / --self-test (which call build() directly and never
        # reach run_loop()) can never trigger a sound.
        self.on_sound = on_sound

    def _sound(self, event):
        if self.on_sound is not None:
            try:
                self.on_sound(event)
            except Exception:      # never let a sound hook crash the poller
                pass

    # -- one iteration --------------------------------------------------------
    def tick(self):
        self._maybe_claim()

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
        try:
            self._do_claim(job_id)
        except Exception as e:
            # t2111 -- backend.get_job (first line of _do_claim) can raise far more than OSError: a
            # corrupt local .map.json raises FileNotFoundError/ValueError, and the Drive backend raises
            # DriveError (a RuntimeError, NOT an OSError). Only the delivery step below was guarded
            # (except OSError); nothing else in _do_claim was, so any of these escaped _claim -> tick()
            # -> run_loop(), where only KeyboardInterrupt is caught -- one malformed job or one bad Drive
            # response killed the whole daemon. Same shape as every refusal inside _do_claim: fail THIS
            # job honestly (status failed + delete_job, so the FIFO can't wedge on it), log it loudly,
            # and keep polling -- never take the process down over one bad entry.
            name = self._job_name(job_id, {})
            reason = f"claim failed: {e}"
            self.log(f"[poller] CLAIM FAILED {job_id}: {reason}")
            self._sound("failed")
            try:
                self.backend.put_status(
                    job_id, tracker.build_status(job_id, name, "failed",
                                                 [f"claimed {job_id}", f"refused: {reason}"]))
                self.backend.delete_job(job_id)
            except Exception as e2:
                self.log(f"[poller] could not clean up {job_id} after claim failure: {e2}")

    def _do_claim(self, job_id):
        nc, m = self.backend.get_job(job_id)
        name = self._job_name(job_id, m)
        events = [f"claimed {job_id}"]
        self._sound("received")   # t2097 — a job came in, look up (the door chime)

        # safety: never deliver to the wrong controller (CONFIGS §7). Skipped if no machine_id configured.
        ok, reason = identity.verify(self.cfg.expert_dest, self.cfg.identity_filename, self.cfg.machine_id)
        if not ok:
            self.log(f"[poller] REFUSED {job_id}: {reason}")
            self._sound("failed")   # t2097 — a sibling bad outcome to delivery failure; same sound, free to share
            self.backend.put_status(
                job_id, tracker.build_status(job_id, name, "failed", events + [f"refused: {reason}"]))
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
                job_id, tracker.build_status(job_id, name, "failed", events + [f"refused: {reason}"]))
            self.backend.delete_job(job_id)
            return

        # t2066 — DECLARE the one genuinely-unsafe window so a take-over can SEE it. The write to the controller is
        # the synchronous deliver() just below; until it returns there was no queue state meaning "a file is being
        # written right now" — delivered/failed are BOTH post-write. Mark "delivering" here so /api/queue
        # reports it for the duration of the copy (the HTTP thread reads it while this thread blocks in deliver);
        # delivered/failed overwrite it immediately after.
        self.backend.put_status(
            job_id, tracker.build_status(job_id, name, "delivering", events + ["writing to controller"]))
        try:
            dest = self.transfer.deliver(nc, name)
        except OSError as e:
            self.log(f"[poller] DELIVERY FAILED {job_id}: {e}")
            self._sound("failed")   # t2097 — the buzzer: wrong, every game show ever
            self.backend.put_status(
                job_id, tracker.build_status(job_id, name, "failed", events + [f"delivery failed: {e}"]))
            self.backend.delete_job(job_id)        # don't wedge the queue on a bad job
            self._record_history(job_id, name, m, "failed", None)
            return
        self.backend.delete_job(job_id)            # delivered -> bucket copy no longer needed (controller has it)
        # t2097 — the register: the transaction completed.
        self._sound("delivered")
        # t2649 (BACKLOG #78) — every job is now what "deliver-only" always was: "delivered" IS terminal.
        # There is no more post-delivery watch phase (that was the beacon receiver's job); live job state
        # (BACKLOG #79, t2647) is a separate, process-wide Modbus poll, not attached to this status object.
        self.backend.put_status(
            job_id, tracker.build_status(job_id, name, "delivered", events + [f"delivered -> {dest}"]))
        self._record_history(job_id, name, m, "delivered", time.time())
        self.log(f"[poller] delivered {name} ({job_id})")

    @staticmethod
    def _job_name(job_id, m):
        """Filename to deliver under. Prefer the map's source; else strip the jobId's timestamp
        prefix (`<ts>-<name>` -> `<name>.nc`)."""
        if m.get("source"):
            return m["source"]
        base = job_id.split("-", 1)[1] if "-" in job_id else job_id
        return base + ".nc"

    def _record_history(self, job_id, name, m, final_state, delivered_at):
        """Append a durable finished-job record (name, final state). History seam — consumed by the console
        History view and any later metrics.

        t2649 (BACKLOG #78) — was also `total_beacons`/`last_beacon`/`started_at`/`duration_s`, all derived
        from the beacon watch phase (the run's own start/finish signal). Removed with it: delivery is now
        synchronous and terminal, so there is no separate "the cut finished" moment this process can observe
        for any job — a duration would be a number with nothing behind it.

        t2020 — `content_hash` (a SHA-256 of the NORMALISED G-code, computed client-side by `send.js`) rides
        through here so the History view can link two runs of the SAME program — job identity (jobId) stays
        timestamp+name, unique per SEND on purpose; content_hash is a SEPARATE, joinable field for "have I
        run this exact program before," not a replacement for jobId's own uniqueness."""
        rec = {
            "jobId": job_id, "name": name, "final_state": final_state,
            "delivered_at": _iso(delivered_at),
            "recorded_at": _iso(time.time()),
            "content_hash": m.get("content_hash"),
        }
        try:
            self.backend.append_history(rec)
        except Exception as e:
            self.log(f"[poller] history record failed for {job_id}: {e}")
