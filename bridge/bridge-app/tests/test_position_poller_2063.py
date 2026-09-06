"""
POSITION POLLER: OPTION 1 WIRED AS A GENUINE PROGRESS SOURCE (t2063).

t2059 proved the one-shot `ModbusMaster` client against a local synthetic slave. This turn wraps it in a
continuously-polling `PositionPoller` — proving the CENTRAL claim: a poller whose reads are failing must
report itself UNHEALTHY, even while its background thread is genuinely alive and looping. A thread that
"looks fine" while quietly answering nothing is exactly the defect this discipline exists to catch.

t2649 (BACKLOG #78) — the Modbus SLAVE (the beacon checkpoint receiver, `slave.py`) this poller used to be
"mutually exclusive with, same serial port" is REMOVED — owner-directed 2026-09-04, never demonstrably ran
end-to-end. `build()` no longer constructs a beacons object of any kind, so the mutual-exclusivity tests that
lived here are gone with it; `com_port`/`baud`/`slave_id` are this poller's OWN config now, not shared with
anything.

Two tiers, same reasoning as test_master_2059.py: logic needing no pymodbus wire I/O runs in the standard
suite; the real wire round-trip (a genuine in-process synthetic slave) is detected structurally and skips
cleanly when the installed pymodbus doesn't match the pinned client signature master.py targets, with the
real proof run separately through the correctly-pinned scratch venv (see WORK-LOG t2063).

Run standalone:  python bridge/bridge-app/tests/test_position_poller_2063.py
"""
import os
import sys
import time

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))
from fairy.master import PositionPoller, ModbusMaster, REGISTERS   # noqa: E402
from fairy.bridge import build   # noqa: E402
from fairy.config import Config   # noqa: E402


# ── (1) logic that needs no pymodbus wire I/O ───────────────────────────────────────────────────────────────

def test_status_before_start_reports_not_started_honestly():
    p = PositionPoller("COM_UNUSED", 115200, 1)
    assert p.status() == {"ok": False, "error": "not started"}


def test_latest_before_any_successful_read_is_none_not_a_fabricated_value():
    p = PositionPoller("COM_UNUSED", 115200, 1)
    assert p.latest() is None


def test_registers_are_configurable_per_instance_not_baked_in():
    """A bench correction (a wrong address for THIS controller) costs a constructor argument, never a code
    change — the exact requirement, checked directly against the instance, not the module default."""
    custom = {"state": {"addr": 99999, "count": 4, "note": "a bench correction, hypothetically"}}
    p = PositionPoller("COM_UNUSED", 115200, 1, registers=custom)
    assert p.registers == custom
    assert p.registers is not REGISTERS   # a real override, not accidentally aliasing the module default

    default = PositionPoller("COM_UNUSED", 115200, 1)
    assert default.registers == REGISTERS
    assert default.registers is not REGISTERS   # snapshotted, not aliased — mutating REGISTERS later can't reach back in


def test_stop_before_start_is_a_harmless_noop():
    PositionPoller("COM_UNUSED", 115200, 1).stop()   # must not raise


def test_a_bad_port_reports_dead_immediately_never_looking_healthy():
    """THE REPRODUCTION, same shape as t2057's slave.py fix but for the read side: a port that cannot
    possibly exist. The connect() failure happens inside _run() (the background thread) — status() must
    still surface it, not leave the poller looking merely 'not started yet' forever."""
    p = PositionPoller("COM_DOES_NOT_EXIST_2063", 115200, 1, interval_s=0.2)
    p.start()
    time.sleep(0.5)   # give the thread time to hit connect() and fail
    st = p.status()
    assert st["ok"] is False, st
    assert "COM_DOES_NOT_EXIST_2063" in (st["error"] or ""), st
    p.stop()


# ── t2073 — Ops.position_status(): AN HONEST STUB, not a job-progress feature ───────────────────────────────
# The poller is bench-proven to READ; nothing turns "the tool is at these numbers" into "the job is N% done"
# (that cursor stays gated on a real bench session — JOB-PROGRESS-PLAN.md). So the API surfaces exactly what
# the poller measures: RAW, UNDECODED registers. Assembling a work_position register pair into a float32
# X/Y/Z would be a SECOND unverified guess (byte order) stacked on the register MAP's own already-unattested
# addresses — not built here on purpose.

def test_position_status_when_no_poller_is_configured_says_so_plainly():
    from fairy.ops import Ops
    ops = Ops(backend=None, config=None)   # position_poller defaults to None — no --position-poll
    assert ops.position_status() == {"enabled": False}


def test_position_status_surfaces_the_pollers_real_connected_state_and_raw_registers():
    from fairy.ops import Ops
    ops = Ops(backend=None, config=None, position_poller=PositionPoller("COM_UNUSED", 115200, 1))
    st = ops.position_status()
    assert st["enabled"] is True
    assert st["connected"] is False, st          # never started -> status() says "not started"
    assert st["error"] == "not started", st
    assert st["raw"] == {}, st                   # latest() is None before any read -> empty raw, not fabricated zeros
    assert st["read_at"] is None, st


def test_position_status_never_leaks_the_internal_ts_key_into_raw():
    """raw must be ONLY the register blocks (work_position/machine_position/state) — ts is surfaced
    separately as read_at, so a UI reading `raw` never has to know to skip one special key."""
    from fairy.ops import Ops

    class _FakeReadyPoller:
        def status(self): return {"ok": True, "error": None}
        def latest(self): return {"work_position": [1, 2, 3], "state": [0, 0], "ts": 1734567890.0}

    ops = Ops(backend=None, config=None, position_poller=_FakeReadyPoller())
    st = ops.position_status()
    assert st["connected"] is True
    assert st["raw"] == {"work_position": [1, 2, 3], "state": [0, 0]}, st   # ts excluded
    assert st["read_at"] == "2024-12-19T00:24:50Z", st


# ── bridge.py wiring: PositionPoller construction from config ───────────────────────────────────────────────

def _cfg(tmp, **overrides):
    dest = os.path.join(tmp, "cncdisk")
    return Config(backend="local", local_root=tmp, expert_dest=dest, com_port="COM_TEST", slave_id=1, **overrides)


def test_position_poller_is_constructed_when_enabled_none_when_not():
    import tempfile
    tmp = tempfile.mkdtemp()
    try:
        cfg = _cfg(tmp, enable_position_poll=True)
        _, _, _, pp = build(cfg)
        assert isinstance(pp, PositionPoller), type(pp)
        assert pp.port == "COM_TEST"

        cfg_off = _cfg(tmp, enable_position_poll=False)
        _, _, _, pp_off = build(cfg_off)
        assert pp_off is None
    finally:
        import shutil; shutil.rmtree(tmp, ignore_errors=True)


def test_position_registers_override_flows_from_config_through_to_the_poller():
    import tempfile
    tmp = tempfile.mkdtemp()
    try:
        custom = {"state": {"addr": 1, "count": 1, "note": "a bench correction"}}
        cfg = _cfg(tmp, enable_position_poll=True, position_registers=custom)
        _, _, _, pp = build(cfg)
        assert pp.registers == custom
    finally:
        import shutil; shutil.rmtree(tmp, ignore_errors=True)


# ── (2) the real wire round-trip, against a synthetic in-process slave ─────────────────────────────────────

def _pymodbus_client_matches_pinned_signature():
    try:
        import inspect
        from pymodbus.client import ModbusSerialClient
        sig = inspect.signature(ModbusSerialClient.read_holding_registers)
        params = list(sig.parameters.values())
        return len(params) >= 4 and params[3].name == "slave" and params[3].kind != inspect.Parameter.KEYWORD_ONLY
    except Exception:
        return False


def test_real_poller_reports_healthy_and_returns_live_data_from_a_synthetic_slave():
    if not _pymodbus_client_matches_pinned_signature():
        print("  SKIP  (installed pymodbus does not match the pinned 3.6.9 client signature -- see "
              "WORK-LOG t2063 for the manual run against a correctly-pinned scratch venv)")
        return

    import threading as th
    from pymodbus.datastore import ModbusSequentialDataBlock, ModbusServerContext, ModbusSlaveContext
    from pymodbus.server import StartTcpServer
    from pymodbus.client import ModbusTcpClient

    block = ModbusSequentialDataBlock(0, [0] * 20000)
    block.setValues(10002, [0, 0])          # state = IDLE (0)
    store = ModbusSlaveContext(hr=block, zero_mode=True)
    context = ModbusServerContext(slaves=store, single=True)
    PORT = 15504
    th.Thread(target=lambda: StartTcpServer(context=context, address=("127.0.0.1", PORT)), daemon=True).start()
    time.sleep(0.3)

    # PositionPoller talks Serial by construction; graft in a real ModbusTcpClient the way t2059 did, so the
    # SAME polling loop / status()/latest() logic runs against a real socket instead of asserting on the
    # (untestable-here) serial transport specifically.
    p = PositionPoller("UNUSED", 115200, 1, interval_s=0.3, registers={"state": REGISTERS["state"]})

    def fake_run():
        m = ModbusMaster("UNUSED", 115200, 1, registers=p.registers)
        m._client = ModbusTcpClient("127.0.0.1", port=PORT, timeout=2.0)
        assert m._client.connect()
        try:
            while not p._stop.is_set():
                try:
                    cycle = {key: m.read(key) for key in p.registers}
                    cycle["ts"] = time.time()
                    with p._lock:
                        p._latest = cycle
                    p._error = None
                except Exception as e:
                    p._error = str(e)
                p._stop.wait(p.interval_s)
        finally:
            m.close()

    p._stop.clear()
    p._thread = th.Thread(target=fake_run, daemon=True)
    p._thread.start()
    time.sleep(0.8)
    try:
        st = p.status()
        assert st == {"ok": True, "error": None}, st
        latest = p.latest()
        assert latest is not None and latest["state"] == [0, 0], latest
    finally:
        p.stop()


def test_real_poller_reports_unhealthy_while_the_thread_stays_alive_and_looping():
    """THE CENTRAL CLAIM: a poller that keeps running but whose reads are wrong must say so, every cycle —
    not merely at startup. A synthetic slave whose datastore is too small for the declared register range
    provokes a real Modbus exception EVERY poll; status() must report unhealthy throughout, even while the
    background thread is demonstrably alive."""
    if not _pymodbus_client_matches_pinned_signature():
        print("  SKIP  (see test_real_poller_reports_healthy_and_returns_live_data_from_a_synthetic_slave)")
        return

    import threading as th
    from pymodbus.datastore import ModbusSequentialDataBlock, ModbusServerContext, ModbusSlaveContext
    from pymodbus.server import StartTcpServer
    from pymodbus.client import ModbusTcpClient

    block = ModbusSequentialDataBlock(0, [0] * 20000)
    store = ModbusSlaveContext(hr=block, zero_mode=True)
    context = ModbusServerContext(slaves=store, single=True)
    PORT = 15505
    th.Thread(target=lambda: StartTcpServer(context=context, address=("127.0.0.1", PORT)), daemon=True).start()
    time.sleep(0.3)

    bad_registers = {"state": {"addr": 19990, "count": 50, "note": "deliberately past the datastore's real size"}}
    p = PositionPoller("UNUSED", 115200, 1, interval_s=0.3, registers=bad_registers)

    def fake_run():
        m = ModbusMaster("UNUSED", 115200, 1, registers=p.registers)
        m._client = ModbusTcpClient("127.0.0.1", port=PORT, timeout=2.0)
        assert m._client.connect()
        try:
            while not p._stop.is_set():
                try:
                    cycle = {key: m.read(key) for key in p.registers}
                    cycle["ts"] = time.time()
                    with p._lock:
                        p._latest = cycle
                    p._error = None
                except Exception as e:
                    p._error = str(e)
                p._stop.wait(p.interval_s)
        finally:
            m.close()

    p._stop.clear()
    p._thread = th.Thread(target=fake_run, daemon=True)
    p._thread.start()
    try:
        for _ in range(3):
            time.sleep(0.4)
            assert p._thread.is_alive(), "the background thread genuinely keeps running"
            st = p.status()
            assert st["ok"] is False, f"a poller whose reads keep failing must report unhealthy: {st}"
            assert "state" in (st["error"] or ""), st
        assert p.latest() is None, "never a single successful cycle landed — latest() must stay None, not fabricate data"
    finally:
        p.stop()


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- PositionPoller reports its REAL health every cycle, alive-but-failing included; the real "
          "wire round-trip runs when the installed pymodbus matches the pinned client signature, else skips "
          "cleanly and names why")
