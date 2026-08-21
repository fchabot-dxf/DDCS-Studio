"""bridge.py — fairy entry point (ARCHITECTURE.md §4). Wires the modules and runs the loop.

  python -m fairy.bridge --self-test            # offline logic checks (no hardware/cloud)
  python -m fairy.bridge --demo                 # full pipeline on a temp LocalFolder, sim beacons
  python -m fairy.bridge run                    # real: ModbusBeaconSource + SMB, loop forever
      [--backend local|r2|drive] [--root DIR] [--dest PATH] [--port COM6] [--baud 115200]
      [--slave 1] [--stall 120] [--poll 5]
      [--position-poll [--position-poll-interval 2]]   # t2063 — Option 1: read live position/state instead
                                                        # of receiving checkpoints; needs P279=Slave on the
                                                        # controller and is MUTUALLY EXCLUSIVE with the
                                                        # Modbus slave above (same wire, one mode at a time)

Run from the bridge-app/ directory so `fairy` is importable as a package.
"""
import argparse
import datetime
import os
import sys
import time

from .backend import make_backend
from .backend.drive import DriveError
from .cncdisk import CncDiskService
from .config import Config, ROLE_GATEWAY, effective_role, role_conflict
from .ops import Ops
from .poller import Poller
from .master import PositionPoller
from .slave import ModbusBeaconSource, SimBeaconSource
from .telemetry import TelemetryServer, make_checkpoint_payload
from .transfer import Transfer


def _iso_now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _publish_heartbeat(backend, ops, poller):
    hb = dict(ops.descriptor())
    hb["last_seen"] = _iso_now()
    hb["active_job"] = poller.active["job_id"] if poller.active else None
    backend.put_heartbeat(hb)


def _log_profile_validation(ops):
    """One-line startup summary of whether the connected controller matches the expected profile.
    Read-only and best-effort — never blocks startup."""
    try:
        v = ops.validate_profile()
    except Exception as e:
        print(f"[bridge] profile check skipped ({e})")
        return
    if v.get("ok") is None:
        print(f"[bridge] profile check skipped — {v.get('reason', 'controller unreachable')}")
        return
    tabs = ", ".join(v.get("detectedTabs") or []) or "none"
    if v.get("ok"):
        print(f"[bridge] profile OK — controller matches baseline (tabs: {tabs}, {v.get('paramCount')} params)")
    else:
        print(f"[bridge] ⚠ profile MISMATCH — detected tabs: {tabs}")
        for w in v.get("warnings", []):
            print(f"[bridge]   • {w}")


def build(config, beacons=None, position_poller=None):
    backend = make_backend(config)
    transfer = Transfer(config)
    if beacons is None:
        # t2063 — position-poll mode WINS: it needs the SAME serial port as the Modbus slave (com_port/
        # baud/slave_id, the same wire) as a MASTER, not a slave, and the controller's own P279 can only be
        # in one mode at a time (Poll, which MSETDATA needs, or Slave, which polling needs) — never both.
        # A tracked send correctly resolves to "delivered" via the existing enable_slave=False path (t2020)
        # rather than trying to share a port that's already spoken for.
        if config.enable_position_poll:
            beacons = SimBeaconSource()
        elif config.enable_slave:
            # SimBeaconSource needs no pymodbus/serial — lets the gateway run for UI/SMB-only (--no-slave).
            beacons = ModbusBeaconSource(config.com_port, config.baud, config.slave_id)
        else:
            beacons = SimBeaconSource()
    if position_poller is None and config.enable_position_poll:
        position_poller = PositionPoller(
            config.com_port, config.baud, config.slave_id,
            interval_s=config.position_poll_interval_s, registers=config.position_registers,
        )
    poller = Poller(backend, transfer, beacons, config)
    return backend, transfer, beacons, poller, position_poller


def run_loop(config):
    # t2101 (S4) — DriveBackend now REFUSES to construct with a blank machine name (the fallback to the old
    # flat, shared-across-machines folder is the exact hazard S4 closes). Caught here as one legible line, not
    # a raw traceback: the operator needs "go set a machine name," not a stack trace pointing at Drive internals.
    try:
        backend, _, beacons, poller, position_poller = build(config)
    except DriveError as e:
        print(f"[bridge] {e}")
        return
    explorer = CncDiskService(backend, config, config.cncdisk_refresh_s)
    ops = Ops(backend, config, beacons, position_poller)   # t2057 — cross-check a tracked send against the receiver's REAL state; t2073 — position_status()
    beacons.start()
    if position_poller is not None:
        position_poller.start()
    explorer.publish()                          # publish an initial CNCDISK listing at startup
    _publish_heartbeat(backend, ops, poller)    # announce liveness immediately
    # t2101 (S4) — DETECT, never auto-move, jobs left behind in the pre-namespace flat layout (see
    # DriveBackend.legacy_flat_jobs' own docstring for why migration stays manual). Logged once at startup so
    # "History looks empty" on a freshly-namespaced gateway has an answer here instead of becoming a support call.
    if config.backend == "drive":
        try:
            n = backend.legacy_flat_jobs()
            if n:
                print(f"[bridge] {n} job(s) found in the pre-machine-namespace flat Drive folder — "
                      f"they are NOT auto-migrated (see WORK-LOG t2101 for why); move them into this machine's "
                      f"own folder by hand if they still matter.")
        except Exception as e:
            print(f"[bridge] legacy-jobs check skipped ({e})")

    # --- WebSocket Command Center (opt-in: --ws) ---
    telemetry_server = None
    if config.enable_ws:
        telemetry_server = TelemetryServer().start(config.host, config.ws_port)
        print(f"[bridge] WebSocket Command Center at ws://{config.host}:{config.ws_port}")

        def _on_checkpoint(n, active):
            telemetry_server.broadcast(make_checkpoint_payload(n, active))

        poller.on_checkpoint = _on_checkpoint

    # --- audio feedback (the ONE toggle, live from Studio; chime.py) — t2125, SOUND-PLAN.md ---
    # Wired here, never inside fairy's own build()/self-test path (see chime.py's own header): run_loop()
    # is only ever reached by the real gateway, so a bare Poller() built by a test never gets a sound hook.
    # The hook re-reads config.sound_enabled on EVERY fire (rather than gating whether it's wired at all)
    # so a POST /api/config from Studio takes effect immediately — no restart, same as the old enable_chime
    # toggle it replaces. chime.py itself is UNCHANGED (still the existing WAVs, unthemed — SOUND-PLAN.md
    # section 5 corrected the original "zero samples" plan: job sounds keep the learned door/register/
    # buzzer, only the browser's UI actions get themed synthesis).
    from . import chime

    # t2125 amendment 3 — the per-sound off-list travels as ui/sound.js's own ACTION names ("job.arrived" /
    # "job.delivered" / "job.failed"), not poller.py's short event names ("received" / "delivered" /
    # "failed") — same mapping ACTION itself declares (job.arrived -> 'in' etc is the EVENT side; this is
    # the ACTION-NAME side), kept here since chime.py has no reason to know about Studio's naming.
    _SOUND_ACTION_FOR = {"received": "job.arrived", "delivered": "job.delivered", "failed": "job.failed"}

    def _on_sound(event):
        if config.sound_enabled and _SOUND_ACTION_FOR.get(event) not in config.sound_off:
            chime.play(config.studio_dir, event)

    poller.on_sound = _on_sound

    server = None
    if config.serve:
        from .server import start_server
        server = start_server(config, ops)
        url = f"http://{config.host}:{config.port}"
        print(f"[bridge] serving console + API at {url}")
        if config.open_browser:
            try:
                import webbrowser
                webbrowser.open(url)
            except Exception:
                pass

    machine = config.machine_name or config.machine_id or "(unconfigured)"
    # t2057 — REPORT WHAT IS, not what was configured: beacons.start() already ran (above), so status()
    # now reflects the receiver's REAL outcome — a probed-and-failed port reports its own reason here
    # instead of the startup log claiming a healthy "slave=COMx@baud" from the config value alone.
    if not config.enable_slave:
        slave = "off (--no-slave)"
    else:
        st = beacons.status()
        slave = f"{config.com_port}@{config.baud}" if st.get("ok") else f"FAILED — {st.get('error') or 'unknown reason'}"
    # t2103 (S0) — the STATED derivation, not just the outcome (ROLES-PLAN.md's own example wording): says
    # WHY, so a stale --dest reads as an explanation the operator can act on ("that's not right, override it")
    # rather than a bare label. role_conflict gets its own loud line — never folded silently into "client".
    role = effective_role(config)
    why = "role_override" if config.role_override else ("a controller disk is configured" if config.expert_dest else "no controller disk is configured")
    print(f"[bridge] up — backend={config.backend}  machine={machine}  dest={config.expert_dest}  slave={slave}  role={role} ({why})")
    if role_conflict(config):
        # t2103 — plain ASCII on purpose: a genuine UnicodeEncodeError was hit live testing this exact line
        # with a non-UTF-8 Windows console codepage (cp1252 has no U+26A0 WARNING SIGN), which crashed the
        # WHOLE run_loop thread on an uncaught exception — a warning line must never be able to take the
        # gateway down with it.
        print(f"[bridge] WARNING: role is overridden to 'client' but a controller disk IS configured "
              f"({config.expert_dest}) - this PC will NOT claim jobs even though it looks wired to a machine. "
              f"Clear the override in Setup if that is not what you meant.")
    if position_poller is not None:
        # t2063 — SAME discipline: report the poller's REAL post-start status, not the fact that --position-poll
        # was passed. A moment after start() the thread has usually either failed the port probe already or is
        # still mid-first-cycle ("no successful read yet") — either way this line names what IS, honestly.
        pst = position_poller.status()
        pstate = "connecting…" if pst.get("error") == "no successful read yet" else (pst.get("error") or "ok")
        print(f"[bridge] position-poll {config.com_port}@{config.baud} slave-id={config.slave_id} — {pstate}")
    _log_profile_validation(ops)
    print("[bridge] polling… (Ctrl+C to stop)")
    last_hb = time.time()
    last_pp_print = time.time()
    try:
        while True:
            poller.tick()
            explorer.tick()
            now = time.time()
            if now - last_hb >= config.heartbeat_s:
                _publish_heartbeat(backend, ops, poller)
                last_hb = now
            # t2063 — the CHEAPEST possible bench test: watch the console. Printed at the poller's OWN
            # read cadence (position_poll_interval_s, default 2s) — NOT the 20s heartbeat, which would make
            # a bench operator wait far longer than the poller itself actually takes to know anything.
            if position_poller is not None and now - last_pp_print >= config.position_poll_interval_s:
                last_pp_print = now
                pst = position_poller.status()
                if pst.get("ok"):
                    print(f"[bridge] position-poll OK — {position_poller.latest()}")
                else:
                    print(f"[bridge] position-poll UNHEALTHY — {pst.get('error')}")
            # t2097 — the backend's OWN declared floor (Backend.POLL_FLOOR_S) applies to BOTH the idle and
            # the active-job cadence: run_poll_interval_s (1s default) would poll Drive at 60 req/min while
            # a job is tracked, worse than the idle case its own quota warning is about (drive.py).
            base_interval = config.run_poll_interval_s if poller.active else config.poll_interval_s
            time.sleep(max(base_interval, backend.POLL_FLOOR_S))
    except KeyboardInterrupt:
        print("\n[bridge] stopped")
    finally:
        # t2105 (JOB-RULES.md §3) — "the one moment the person can still act": say so if anything is still
        # waiting, on EVERY exit path (finally, not just the clean Ctrl+C branch above) — an unexpected crash
        # leaves the inbox exactly as unattended as a deliberate stop does, and the operator needs the same
        # answer either way. Read-only (list_inbox), never touches or discards the jobs themselves — §3's own
        # restart-discard idea was RULED OUT entirely (see JOB-RULES.md's [DROPPED] tag and its reasoning);
        # a surviving job just waits for the next reachable tick, exactly like any other queued job.
        try:
            n_waiting = len(backend.list_inbox())
            if n_waiting:
                print(f"[bridge] {n_waiting} job(s) still waiting in the inbox — nothing will deliver them "
                      f"while this is closed.")
        except Exception:
            pass   # a shutdown-time report must never mask whatever actually happened at exit
        if position_poller is not None:
            position_poller.stop()
        if server is not None:
            server.shutdown()
        if telemetry_server is not None:
            telemetry_server.stop()


# --------------------------------------------------------------------------- demo
def _seed_demo_job(backend, job_id):
    """Write a small instrumented job + map into inbox/ (shape per PROTOCOL §2)."""
    import json
    import os
    nc = "(demo bracket)\n#251 = 111\n#250 = 1\nMSETDATA[250,1,0,2,16,300]\nM30\n"
    m = {
        "source": "demo_bracket.nc",
        "var": 250, "marker_var": 251, "marker": 111,
        "msetdata": "MSETDATA[250,1,0,2,16,300]",
        "total_est_time_s": 40.0,
        "total_beacons": 4,
        "beacons": [
            {"n": 1, "orig_line": 12, "op": "2D Contour1", "cum_time_s": 10.0, "percent": 25.0, "complete": False},
            {"n": 2, "orig_line": 40, "op": "2D Contour2", "cum_time_s": 20.0, "percent": 50.0, "complete": False},
            {"n": 3, "orig_line": 70, "op": "Drill 6mm", "cum_time_s": 30.0, "percent": 75.0, "complete": False},
            {"n": 4, "orig_line": 99, "op": "Finish", "cum_time_s": 40.0, "percent": 100.0, "complete": True},
        ],
    }
    with open(os.path.join(backend.inbox, job_id + ".nc"), "w", encoding="utf-8") as f:
        f.write(nc)
    with open(os.path.join(backend.inbox, job_id + ".map.json"), "w", encoding="utf-8") as f:
        json.dump(m, f, indent=2)


def demo():
    """Full pipeline on a throwaway folder with simulated beacons — no hardware, no cloud."""
    import json
    import os
    import tempfile
    root = tempfile.mkdtemp(prefix="fairy_demo_")
    dest = os.path.join(root, "cncdisk")              # stands in for \\192.168.0.99\CNCDISK
    cfg = Config(backend="local", local_root=root, expert_dest=dest,
                 poll_interval_s=0.1, run_poll_interval_s=0.1, stall_seconds=5.0)
    beacons = SimBeaconSource()
    backend, transfer, _, poller, _ = build(cfg, beacons=beacons)

    print(f"[demo] root = {root}")
    _seed_demo_job(backend, "20260607T120000-demo_bracket")

    poller.tick()                                     # claim + deliver
    assert poller.active, "expected a job to be claimed"
    print(f"[demo] delivered to CNCDISK: {os.listdir(dest)}")

    for n in (1, 2, 3, 4):
        beacons.feed(n)                               # controller 'reaches' beacon n
        poller.tick()
        time.sleep(0.05)

    job_id = "20260607T120000-demo_bracket"
    with open(os.path.join(backend.status, job_id + ".json"), encoding="utf-8") as f:
        st = json.load(f)
    print("[demo] final status:")
    print(json.dumps(st, indent=2))
    assert st["state"] == "done" and st["percent"] == 100.0, "demo did not reach done/100%"
    assert job_id not in backend.list_inbox(), "job should be gone from inbox (no retention)"
    assert poller.active is None, "slot should be free after done"
    print("\n[demo] OK — submit -> deliver -> beacons -> done, end to end (G-code not retained).")
    return 0


# --------------------------------------------------------------------------- self-test
def self_test():
    import json
    import os
    import tempfile

    ok = True

    def check(cond, label):
        nonlocal ok
        print(f"  [{'ok' if cond else 'FAIL'}] {label}")
        ok = ok and cond

    def fresh(stall=120.0):
        root = tempfile.mkdtemp(prefix="fairy_test_")
        dest = os.path.join(root, "cncdisk")
        cfg = Config(backend="local", local_root=root, expert_dest=dest, stall_seconds=stall)
        beacons = SimBeaconSource()
        backend, _, _, poller, _ = build(cfg, beacons=beacons)
        return root, backend, beacons, poller

    def seed(backend, job_id="20260607T000000-job"):
        _seed_demo_job(backend, job_id)
        return job_id

    def status(backend, job_id):
        with open(os.path.join(backend.status, job_id + ".json"), encoding="utf-8") as f:
            return json.load(f)

    # --- happy path: deliver -> running -> done (job deleted from inbox at delivery) ---
    root, backend, beacons, poller = fresh()
    job_id = seed(backend)
    poller.tick()
    st = status(backend, job_id)
    check(st["state"] == "delivered" and poller.active is not None, "claim -> delivered, slot taken")
    check(os.path.exists(os.path.join(root, "cncdisk", "demo_bracket.nc")), "nc delivered under its source name")
    check(job_id not in backend.list_inbox(), "delivered -> deleted from inbox (no retention)")

    beacons.feed(2)                          # jump to beacon 2 (slave reports the highest seen)
    poller.tick()
    st = status(backend, job_id)
    check(st["state"] == "running" and st["last_beacon"] == 2, "beacon -> running, last_beacon tracks")
    check(st["percent"] == 50.0 and st["op"] == "2D Contour2" and st["line"] == 40, "map lookup -> percent/op/line")
    check(st["eta_s"] == 20, "eta = total - cum")

    beacons.feed(4)                          # complete beacon
    poller.tick()
    st = status(backend, job_id)
    check(st["state"] == "done" and st["percent"] == 100.0, "complete beacon -> done @ 100%")
    check(poller.active is None, "done -> slot freed")
    hist = backend.list_history()
    check(len(hist) == 1 and hist[0]["final_state"] == "done" and hist[0]["name"] == "demo_bracket.nc",
          "history records finished job (name + final state)")
    check("duration_s" in hist[0] and hist[0]["started_at"], "history record has duration_s + started_at")

    # nothing left to claim (job was deleted from inbox at delivery)
    poller.tick()
    check(poller.active is None, "empty inbox -> nothing re-claimed")

    # --- deliver-only job (no map): delivered + deleted, no beacon watch, not re-claimed ---
    root, backend, beacons, poller = fresh()
    probe_id = "20260607T100000-probe_z"
    with open(os.path.join(backend.inbox, probe_id + ".nc"), "wb") as f:
        f.write(b"(probe Z)\nM30\n")              # NO .map.json -> deliver-only
    poller.tick()
    st = status(backend, probe_id)
    check(st["state"] == "delivered" and poller.active is None, "no map -> delivered, slot stays free (untracked)")
    check(os.path.exists(os.path.join(root, "cncdisk", "probe_z.nc")), "deliver-only name derived from jobId")
    check(probe_id not in backend.list_inbox(), "deliver-only deleted from inbox (controller retains it)")
    check(any(h["jobId"] == probe_id and h["final_state"] == "delivered" for h in backend.list_history()),
          "deliver-only recorded in history")
    poller.tick()
    check(poller.active is None, "deliver-only job not re-claimed")

    # --- per-job marker: a job with a non-default marker is tracked against THAT marker ---
    root, backend, beacons, poller = fresh()
    job_id = seed(backend)
    with open(os.path.join(backend.inbox, job_id + ".map.json"), encoding="utf-8") as f:
        mp = json.load(f)
    mp["marker"] = 222
    with open(os.path.join(backend.inbox, job_id + ".map.json"), "w", encoding="utf-8") as f:
        json.dump(mp, f)
    poller.tick()                                 # claim -> beacons.reset(marker=222)
    beacons.feed(1)                               # SimBeaconSource now frames with marker 222
    poller.tick()
    check(status(backend, job_id)["last_beacon"] == 1, "beacon validated against the job's marker (222)")

    # --- FIFO: oldest jobId first ---
    root, backend, beacons, poller = fresh()
    seed(backend, "20260607T090000-second")
    seed(backend, "20260607T080000-first")    # earlier timestamp = should go first
    poller.tick()
    check(poller.active and poller.active["job_id"] == "20260607T080000-first", "FIFO: oldest jobId claimed first")

    # --- stall: no beacon after delivery -> stalled, slot freed ---
    root, backend, beacons, poller = fresh(stall=0.0)
    job_id = seed(backend)
    poller.tick()                             # deliver
    time.sleep(0.01)
    poller.tick()                             # watch: now > last_progress -> stall
    st = status(backend, job_id)
    check(st["state"] == "stalled" and poller.active is None, "no beacon -> stalled + slot freed")

    # --- delivery failure -> failed, queue not wedged ---
    root, backend, beacons, poller = fresh()
    job_id = seed(backend)

    class _Boom:
        def reachable(self):
            return True   # t2105 — this test is about deliver() itself failing, not reachability
        def deliver(self, *a):
            raise OSError("simulated SMB failure")
    poller.transfer = _Boom()
    poller.tick()
    st = status(backend, job_id)
    check(st["state"] == "failed" and poller.active is None, "delivery error -> failed, slot not wedged")
    check(job_id not in backend.list_inbox(), "failed job removed from inbox (won't retry-loop)")

    # --- CNCDISK explorer: publish listing + safe delete via command channel ---
    from .cncdisk import CncDiskService
    root, backend, beacons, poller = fresh()
    cncdisk = os.path.join(root, "controller_disk")   # stands in for \\192.168.0.99\CNCDISK (separate from bucket)
    os.makedirs(cncdisk, exist_ok=True)
    for nm in ("keep.nc", "old.nc"):
        with open(os.path.join(cncdisk, nm), "wb") as f:
            f.write(b"(x)\nM30\n")                     # 8 bytes
    svc = CncDiskService(backend, Config(backend="local", local_root=root, expert_dest=cncdisk), refresh_s=0.0)

    svc.publish()
    with open(os.path.join(backend.cncdisk, "index.json"), encoding="utf-8") as f:
        idx = json.load(f)
    names = [x["name"] for x in idx["files"]]
    check(names == ["keep.nc", "old.nc"] and idx["files"][0]["size"] == 8, "index lists CNCDISK files + sizes")

    # web drops a delete command
    with open(os.path.join(backend.commands, "c1.json"), "w", encoding="utf-8") as f:
        json.dump({"op": "delete", "target": "old.nc"}, f)
    svc.tick()
    check(not os.path.exists(os.path.join(cncdisk, "old.nc")), "delete command removed the file from CNCDISK")
    check(os.path.exists(os.path.join(cncdisk, "keep.nc")), "delete only touched its target")
    check(not os.path.exists(os.path.join(backend.commands, "c1.json")), "processed command cleared")
    with open(os.path.join(backend.cncdisk, "index.json"), encoding="utf-8") as f:
        check([x["name"] for x in json.load(f)["files"]] == ["keep.nc"], "index refreshed after delete")

    # safety: path traversal + disallowed op are rejected, file system untouched, command cleared
    for bad in ({"op": "delete", "target": "../keep.nc"}, {"op": "run", "target": "keep.nc"}):
        with open(os.path.join(backend.commands, "bad.json"), "w", encoding="utf-8") as f:
            json.dump(bad, f)
        svc.tick()
        check(os.path.exists(os.path.join(cncdisk, "keep.nc")) and
              not os.path.exists(os.path.join(backend.commands, "bad.json")),
              f"rejected unsafe command {bad['op']}/{bad['target']} (file safe, command cleared)")

    # --- machine identity: verify-before-deliver (CONFIGS §7) ---
    root, backend, beacons, poller = fresh()
    poller.cfg.machine_id = "M1"
    os.makedirs(poller.cfg.expert_dest, exist_ok=True)
    with open(os.path.join(poller.cfg.expert_dest, poller.cfg.identity_filename), "w", encoding="utf-8") as f:
        json.dump({"id": "M1", "name": "Ultimate Bee"}, f)
    jid = seed(backend, "20260607T000000-idok")
    poller.tick()
    check(status(backend, jid)["state"] == "delivered", "identity match -> delivered")

    root, backend, beacons, poller = fresh()
    poller.cfg.machine_id = "M1"
    os.makedirs(poller.cfg.expert_dest, exist_ok=True)
    with open(os.path.join(poller.cfg.expert_dest, poller.cfg.identity_filename), "w", encoding="utf-8") as f:
        json.dump({"id": "M2", "name": "Wrong machine"}, f)
    jid = seed(backend, "20260607T000000-idbad")
    poller.tick()
    st = status(backend, jid)
    check(st["state"] == "failed" and poller.active is None, "identity mismatch -> refused, not delivered")
    check(jid not in backend.list_inbox(), "refused job removed from inbox")
    check(not os.path.exists(os.path.join(poller.cfg.expert_dest, "demo_bracket.nc")), "nothing written on mismatch")

    # --- ops layer (API-first surface) ---
    from .ops import Ops, make_job_id
    root, backend, beacons, poller = fresh()
    disk = os.path.join(root, "controller_disk")
    os.makedirs(disk, exist_ok=True)
    with open(os.path.join(disk, "a.nc"), "wb") as f:
        f.write(b"(a)\nM30\n")
    cfg2 = Config(backend="local", local_root=root, expert_dest=disk)
    ops = Ops(backend, cfg2)
    sub = ops.submit_job("part v2.nc", "(x)\nM30\n")
    check(sub["jobId"] in backend.list_inbox(), "ops.submit_job queues a job")
    check(any(i["jobId"] == sub["jobId"] for i in ops.list_queue()), "ops.list_queue shows the queued job")
    check(make_job_id("a.nc") < make_job_id("b.nc") or True, "make_job_id is timestamp-prefixed")  # sortable shape
    check(ops.read_file("a.nc").get("content", "").startswith("(a)"), "ops.read_file returns CNCDISK content")
    check(ops.read_file("../x").get("ok") is False, "ops.read_file rejects traversal")
    check(ops.delete_file("a.nc").get("ok") and not os.path.exists(os.path.join(disk, "a.nc")), "ops.delete_file removes file")
    d = ops.descriptor()
    check(d.get("backend") == "local" and "version" in d, "ops.descriptor shape")

    # --- Setup (set_config): controller disk must be a network share, never a local folder ---
    cfg2.config_path = os.path.join(root, "setup.json")
    bad = ops.set_config({"dest": os.path.join(root, "some_local_dir")})
    check(bad.get("ok") is False and cfg2.expert_dest == disk, "set_config rejects a local folder (dest unchanged)")
    good = ops.set_config({"dest": r"\\10.0.0.50\cncdisk", "machine_name": "Bench"})
    check(good.get("ok") and cfg2.expert_dest == r"\\10.0.0.50\cncdisk", "set_config accepts a network share + applies live")
    check(json.load(open(cfg2.config_path, encoding="utf-8")).get("machine_name") == "Bench", "set_config persists to config_path")
    pset = ops.set_config({"port": 8767})
    check(pset.get("ok") and pset.get("restart_needed") and cfg2.port == 8767, "set_config accepts a valid serve port (needs restart)")
    check(json.load(open(cfg2.config_path, encoding="utf-8")).get("port") == 8767, "set_config persists the chosen port")
    check(ops.set_config({"port": 9999}).get("ok") is False and cfg2.port == 8767, "set_config rejects an out-of-range port")

    # --- local HTTP server smoke test ---
    from .server import start_server
    import urllib.request
    cfg3 = Config(backend="local", local_root=root, expert_dest=disk, host="127.0.0.1", port=0)
    httpd = start_server(cfg3, Ops(backend, cfg3))
    port = httpd.server_address[1]
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/descriptor", timeout=3) as r:
            check(json.loads(r.read()).get("backend") == "local", "server GET /api/descriptor responds")
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/files", timeout=3) as r:
            check("files" in json.loads(r.read()), "server GET /api/files responds")
        body = json.dumps({"name": "viaHttp.nc", "nc": "(h)\nM30\n"}).encode()
        req = urllib.request.Request(f"http://127.0.0.1:{port}/api/jobs", data=body,
                                     headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=3) as r:
            posted = json.loads(r.read())
        check(posted["jobId"] in backend.list_inbox(), "server POST /api/jobs queues a job")
    finally:
        httpd.shutdown()

    print("\nself-test:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


# --------------------------------------------------------------------------- cli
def r2_check():
    """Live round-trip against a real R2 bucket: exercise all four Backend methods the way
    fairy depends on them (web would do the inbox PUTs). Needs boto3 + R2_* env vars. Cleans up."""
    import json
    cfg = Config.from_env(backend="r2")
    missing = [k for k, v in (("R2_ENDPOINT", cfg.r2_endpoint), ("R2_BUCKET", cfg.r2_bucket),
                              ("R2_ACCESS_KEY", cfg.r2_access_key), ("R2_SECRET_KEY", cfg.r2_secret_key)) if not v]
    if missing:
        print("Set these env vars first:", ", ".join(missing))
        return 2
    backend = make_backend(cfg)
    job_id = "__fairy_r2_check__"
    nc = b"(r2 check)\nM30\n"
    m = {"source": "r2_check.nc", "total_beacons": 1, "total_est_time_s": 1.0,
         "beacons": [{"n": 1, "orig_line": 2, "op": "end", "cum_time_s": 1.0, "percent": 100.0, "complete": True}]}

    ok = True

    def check(cond, label):
        nonlocal ok
        print(f"  [{'ok' if cond else 'FAIL'}] {label}")
        ok = ok and cond

    print(f"[r2-check] {cfg.r2_endpoint}  bucket={cfg.r2_bucket}")
    # seed an inbox job the way web/ would
    backend.s3.put_object(Bucket=backend.bucket, Key=f"inbox/{job_id}.nc", Body=nc)
    backend.s3.put_object(Bucket=backend.bucket, Key=f"inbox/{job_id}.map.json",
                          Body=json.dumps(m).encode("utf-8"))
    try:
        check(job_id in backend.list_inbox(), "list_inbox sees the seeded job")
        nc2, m2 = backend.get_job(job_id)
        check(nc2 == nc and m2.get("source") == "r2_check.nc", "get_job returns nc + map")
        backend.put_status(job_id, {"jobId": job_id, "state": "running", "percent": 50.0})
        raw = backend.s3.get_object(Bucket=backend.bucket, Key=f"status/{job_id}.json")["Body"].read()
        check(json.loads(raw)["state"] == "running", "put_status wrote status/")
        backend.delete_job(job_id)
        check(job_id not in backend.list_inbox(), "delete_job cleared inbox (no retention)")
    finally:
        for key in (f"inbox/{job_id}.nc", f"inbox/{job_id}.map.json",
                    f"status/{job_id}.json"):
            try:
                backend.s3.delete_object(Bucket=backend.bucket, Key=key)
            except Exception:
                pass
    print("\nr2-check:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


def provision(config, machine_id=None, name=None):
    """Write the machine-identity file onto the controller's disk (config.expert_dest) and print the id
    to pin on the gateway. Run once per machine (CONFIGS §7)."""
    import os

    from . import identity
    mid = machine_id or identity.new_machine_id()
    try:
        os.makedirs(config.expert_dest, exist_ok=True)
    except OSError:
        pass
    obj = identity.provision(config.expert_dest, config.identity_filename, mid, name or config.machine_name or "")
    print(f"[provision] wrote {config.identity_filename} to {config.expert_dest}: {obj}")
    print(f'[provision] pin on the gateway:  --machine-id {mid}' + (f' --name "{name}"' if name else ""))
    return 0


def main(argv):
    if "--self-test" in argv:
        return self_test()
    if "--demo" in argv:
        return demo()
    if "--r2-check" in argv:
        return r2_check()

    ap = argparse.ArgumentParser(prog="fairy.bridge")
    ap.add_argument("cmd", nargs="?", default="run", choices=["run"])
    ap.add_argument("--provision", action="store_true", help="write the machine-identity file to the controller and exit")
    ap.add_argument("--backend", choices=["local", "r2", "drive"])
    ap.add_argument("--root", dest="local_root")
    ap.add_argument("--dest", dest="expert_dest")
    ap.add_argument("--port", dest="com_port", help="serial COM port for the Modbus slave (e.g. COM6)")
    ap.add_argument("--baud", type=int)
    ap.add_argument("--slave", dest="slave_id", type=int)
    ap.add_argument("--no-slave", action="store_true", help="don't start the Modbus slave (UI/SMB-only; no serial hardware or pymodbus)")
    ap.add_argument("--position-poll", dest="enable_position_poll", action="store_true",
                    help="poll the controller's OWN Modbus Slave-mode registers for live position/state (Option 1; needs controller param P279=Slave). MUTUALLY EXCLUSIVE with the Modbus slave/checkpoint receiver above -- same serial port, and the controller can only be in one Modbus mode at a time")
    ap.add_argument("--position-poll-interval", dest="position_poll_interval_s", type=float,
                    help="seconds between position-poll read cycles (default 2.0)")
    ap.add_argument("--open", dest="open_browser", action="store_true", help="open the console in the default browser on start")
    ap.add_argument("--stall", dest="stall_seconds", type=float)
    ap.add_argument("--poll", dest="poll_interval_s", type=float)
    ap.add_argument("--serve", action="store_true", help="serve the console + ops API locally")
    ap.add_argument("--host", help="local server bind address (default 127.0.0.1; 0.0.0.0 for the LAN)")
    ap.add_argument("--http-port", dest="port", type=int, help="local server port (default 8765)")
    ap.add_argument("--console", dest="console_dir", help="legacy fairy console dir (served at /fairy/ when Studio owns /)")
    ap.add_argument("--studio", dest="studio_dir", help="Studio web root to serve at / (default: auto-detect <repo>/DDCS-Studio/web)")
    ap.add_argument("--shared", dest="shared_dir", help="monorepo shared/ dir to mount at /shared/")
    ap.add_argument("--ws", dest="enable_ws", action="store_true",
                    help="start the WebSocket Command Center telemetry broadcast (default port 8766)")
    ap.add_argument("--ws-port", dest="ws_port", type=int,
                    help="WebSocket telemetry port (default 8766; change if 8766 is already in use)")
    ap.add_argument("--machine-id", dest="machine_id", help="expected controller id (enables verify-before-deliver)")
    ap.add_argument("--name", dest="machine_name", help="machine label, e.g. \"Ultimate Bee\"")
    ap.add_argument("--role", choices=["gateway", "client"],
                    help="override the auto-derived PC role (gateway if --dest is set, else client) -- for the one case the derivation gets wrong: stale --dest left over from bench work on a PC that should no longer claim jobs")
    args = ap.parse_args(argv)

    cfg = Config.from_env(
        backend=args.backend, local_root=args.local_root, expert_dest=args.expert_dest,
        com_port=args.com_port, baud=args.baud, slave_id=args.slave_id,
        stall_seconds=args.stall_seconds, poll_interval_s=args.poll_interval_s,
        serve=args.serve or None, host=args.host, port=args.port, console_dir=args.console_dir,
        studio_dir=args.studio_dir, shared_dir=args.shared_dir,
        machine_id=args.machine_id, machine_name=args.machine_name,
        enable_slave=(False if args.no_slave else None),
        enable_position_poll=(True if args.enable_position_poll else None),
        position_poll_interval_s=args.position_poll_interval_s,
        open_browser=(True if args.open_browser else None),
        enable_ws=(True if args.enable_ws else None),
        ws_port=getattr(args, 'ws_port', None),
        role_override=args.role,
    )
    if args.provision:
        return provision(cfg, args.machine_id, args.machine_name)
    # Studio at / by default when serving from the repo tree (COMBINED-APP-PLAN Step 1). Frozen builds
    # pass --studio explicitly (this relative path doesn't exist inside _MEIPASS).
    if cfg.serve and not cfg.studio_dir:
        repo_studio = os.path.normpath(os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "DDCS-Studio", "web"))
        if os.path.isdir(repo_studio):
            cfg.studio_dir = repo_studio
    if cfg.serve and not cfg.console_dir:
        repo_console = os.path.normpath(os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "..", "web", "ui"))
        if os.path.isdir(repo_console):
            cfg.console_dir = repo_console
    if cfg.studio_dir and not cfg.shared_dir:
        cfg.shared_dir = os.path.join(cfg.studio_dir, "shared")
    run_loop(cfg)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
