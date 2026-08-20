"""
BEACON HEALTH: MAKE THE RECEIVER'S REAL STATE VISIBLE, AND CROSS-CHECK IT AT SEND TIME (t2057).

Two silent failures found while fault-hunting "beacon never worked" (t2055):

1. `ModbusBeaconSource.start()` spawned a daemon thread and returned immediately, with the actual serial
   port open happening INSIDE it. pymodbus's own transport sets `reconnect_delay=2` and retries a failed
   open FOREVER inside its asyncio loop — confirmed on the bench (a scratch venv pinned to the required
   `pymodbus==3.6.9`): a bad/missing/busy port never raises out of the thread, never stops the thread, and
   the daemon thread stays `is_alive() == True` indefinitely either way. A try/except around `StartSerialServer`
   itself catches nothing. Fixed by probing the port SYNCHRONOUSLY with pyserial directly before handing off
   — a quick open+close raises cleanly for a missing/busy/wrong port, and the probe alone needs no pymodbus
   import at all (these tests run without the correctly-pinned pymodbus version installed, on purpose, the
   same way the rest of this suite already does).

2. `send.js`'s per-job "Beacons" checkbox and the bridge's own per-machine `enable_slave` toggle are two
   independent settings nothing compared. A tracked request against a bridge with tracking off/dead degraded
   correctly server-side (t2020, `poller.py`'s claim-time check) — but the OPERATOR saw a job sitting at 0%,
   "DELIVERED," never advancing, indistinguishable from "about to start." Fixed by having `ops.submit_job`
   cross-check the SAME two facts (`enable_slave`, and — when a real BeaconSource is threaded in — its live
   `status()`) and return an explicit `warning` string in the submit response itself, at send time.

Run standalone:  python bridge/bridge-app/tests/test_beacon_health_2057.py
"""
import os
import sys
import tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))
from fairy.backend.local_folder import LocalFolderBackend    # noqa: E402
from fairy.config import Config                               # noqa: E402
from fairy.ops import Ops                                     # noqa: E402
from fairy.slave import BeaconSource, ModbusBeaconSource, SimBeaconSource   # noqa: E402


# ── (1) the receiver's real state ───────────────────────────────────────────────────────────────────────────

def test_status_before_start_reports_not_started_honestly():
    b = ModbusBeaconSource("COM999", 115200, 1)
    st = b.status()
    assert st == {"ok": False, "error": "not started"}, st


def test_a_bad_port_reports_the_real_reason_instead_of_silently_looking_healthy():
    """THE REPRODUCTION: a port that cannot possibly exist on this machine. Before the fix, start() spawned
    a thread that stayed alive forever regardless (confirmed live on the bench with real pymodbus); status()
    now reports the honest pyserial failure — no pymodbus import needed to reach this path at all, since the
    probe runs before the pymodbus import."""
    b = ModbusBeaconSource("COM_DOES_NOT_EXIST_999", 115200, 1)
    b.start()
    st = b.status()
    assert st["ok"] is False, st
    assert "COM_DOES_NOT_EXIST_999" in (st["error"] or ""), st
    assert b._thread is None, "a failed probe must not spawn the pymodbus thread at all"


def test_sim_beacon_source_reports_healthy_always_no_real_hardware_to_be_unhealthy():
    s = SimBeaconSource()
    s.start()
    assert s.status() == {"ok": True, "error": None}


def test_beacon_source_base_class_default_status_is_healthy():
    """A future BeaconSource subclass that doesn't override status() gets the safe default, not a crash."""
    class _Minimal(BeaconSource):
        def start(self): pass
        def reset(self, marker=None): pass
        def latest(self): return None
    assert _Minimal().status() == {"ok": True, "error": None}


# ── (2) the cross-check at send time ────────────────────────────────────────────────────────────────────────

class _HealthyBeacons:
    def status(self): return {"ok": True, "error": None}


class _DeadBeacons:
    def status(self): return {"ok": False, "error": "could not open COM6: FileNotFoundError"}


def _real_dest(tmp):
    """t2107 — expert_dest must now be a REAL, reachable directory: submit_job() refuses at the door
    otherwise (the local half of the no-send policy). These tests are about the beacon-health cross-check,
    not reachability, so give them a real one — matching transfer.py's own stated convention ("for a
    no-hardware test, point dest at an ordinary folder; it behaves identically") rather than the placeholder
    UNC string these predate."""
    dest = os.path.join(tmp, "cncdisk")
    os.makedirs(dest, exist_ok=True)
    return dest


def _submit(backend, cfg, beacons, name, nc, mapping=None):
    ops = Ops(backend, cfg, beacons)
    return ops.submit_job(name, nc, mapping)


def test_no_warning_for_a_deliver_only_send_regardless_of_receiver_health():
    """Untracked sends never asked for beacons — a dead receiver is irrelevant to them."""
    tmp = tempfile.mkdtemp()
    try:
        backend = LocalFolderBackend(tmp)
        cfg = Config(local_root=tmp, expert_dest=_real_dest(tmp), enable_slave=True)
        r = _submit(backend, cfg, _DeadBeacons(), "probe.nc", "#520=5\nM30\n", None)
        assert r["tracked"] is False and r["warning"] is None, r
    finally:
        import shutil; shutil.rmtree(tmp, ignore_errors=True)


def test_no_warning_for_a_tracked_send_when_the_receiver_is_genuinely_healthy():
    tmp = tempfile.mkdtemp()
    try:
        backend = LocalFolderBackend(tmp)
        cfg = Config(local_root=tmp, expert_dest=_real_dest(tmp), enable_slave=True)
        r = _submit(backend, cfg, _HealthyBeacons(), "part.nc", "M30\n", {"total_beacons": 7})
        assert r["tracked"] is True and r["warning"] is None, r
    finally:
        import shutil; shutil.rmtree(tmp, ignore_errors=True)


def test_warning_when_tracking_is_requested_but_enable_slave_is_off():
    """THE t2020 CASE, from the submit side: the job still degrades correctly server-side (poller.py's own
    claim-time check, unchanged), but now the operator is told AT SEND TIME instead of finding out by
    watching a bar that never moves."""
    tmp = tempfile.mkdtemp()
    try:
        backend = LocalFolderBackend(tmp)
        cfg = Config(local_root=tmp, expert_dest=_real_dest(tmp), enable_slave=False)
        r = _submit(backend, cfg, _HealthyBeacons(), "part.nc", "M30\n", {"total_beacons": 7})
        assert r["tracked"] is True, r    # the REQUEST was still tracked (the map has beacons) — the warning is the new signal
        assert r["warning"] and "Modbus disabled" in r["warning"], r
    finally:
        import shutil; shutil.rmtree(tmp, ignore_errors=True)


def test_warning_when_tracking_is_requested_and_enable_slave_is_on_but_the_receiver_is_dead():
    """THE NEW CASE t2057 closes: enable_slave=True (correctly configured) but the actual receiver failed to
    start (bad COM port, no adapter, etc.) — the ASYMMETRY suspect from t2055's fault hunt."""
    tmp = tempfile.mkdtemp()
    try:
        backend = LocalFolderBackend(tmp)
        cfg = Config(local_root=tmp, expert_dest=_real_dest(tmp), enable_slave=True)
        r = _submit(backend, cfg, _DeadBeacons(), "part.nc", "M30\n", {"total_beacons": 7})
        assert r["tracked"] is True, r
        assert r["warning"] and "not running" in r["warning"] and "COM6" in r["warning"], r
    finally:
        import shutil; shutil.rmtree(tmp, ignore_errors=True)


def test_no_beacons_object_at_all_never_crashes_matching_existing_test_call_sites():
    """Ops(backend, cfg) with no third arg — the shape every OTHER existing test in this suite already uses.
    Must behave exactly as before this turn: no warning key surprises, no AttributeError."""
    tmp = tempfile.mkdtemp()
    try:
        backend = LocalFolderBackend(tmp)
        cfg = Config(local_root=tmp, expert_dest=_real_dest(tmp), enable_slave=True)
        ops = Ops(backend, cfg)   # no beacons — matches test_poller_track_gate.py's own _submit()
        r = ops.submit_job("part.nc", "M30\n", {"total_beacons": 7})
        assert r["tracked"] is True and r["warning"] is None, r
    finally:
        import shutil; shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- the Modbus receiver's real state is now visible (a bad port reports itself instead of "
          "looking healthy forever), and a tracked send against a dead/disabled receiver is flagged at "
          "submit time instead of silently degrading")
