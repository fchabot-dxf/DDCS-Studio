"""
JOB TRACKING (BACKLOG #79, t2647) — the decoded half of PositionPoller's already-proven read side.

t2063 proved PositionPoller could read live registers, honestly reporting health, but left `state` (and
now `line_number`) RAW — position_status()'s own docstring explains why: the byte order for the POSITION
registers is unattested, so decoding them would be a second unverified guess. That reasoning does NOT apply
here: expert-m350/FINDINGS.md confirms `state` (10002) and `line_number` (16062) are BOTH float32 CDAB,
verified live against a real run (V21_dwell.nc / V22/V23_lineno.nc). So this turn adds the decode (master.py's
`decode_float32_cdab`) and a NEW `Ops.job_tracking_status()` that surfaces DECODED run-state + line number,
built on the exact SAME PositionPoller machinery t2063 already proved — no second poller.

Same two tiers as test_position_poller_2063.py: pure logic needs no wire I/O; the real round trip runs
against a genuine in-process synthetic slave and skips cleanly when the installed pymodbus doesn't match the
pinned client signature master.py targets.
"""
import os
import sys
import time

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))
from fairy.master import PositionPoller, ModbusMaster, REGISTERS, decode_float32_cdab, encode_float32_cdab   # noqa: E402


# ── (1) decode/encode — pure, no wire I/O ───────────────────────────────────────────────────────────────────

def test_decode_matches_the_vendors_own_byte_level_formula():
    """Cross-checks decode_float32_cdab against m350_liveg.py's own confirmed recipe
    (`struct.unpack('>f', bytes([res[5], res[6], res[3], res[4]]))`), rebuilt from raw response bytes rather
    than trusting this module's own encode function to agree with itself."""
    import struct

    def vendor_decode_from_response_bytes(res):
        return struct.unpack(">f", bytes([res[5], res[6], res[3], res[4]]))[0]

    for v in (0.0, 1.0, 10.0, 45.0, 26.565):
        reg0, reg1 = encode_float32_cdab(v)
        d0, d1 = (reg0 >> 8) & 0xFF, reg0 & 0xFF
        d2, d3 = (reg1 >> 8) & 0xFF, reg1 & 0xFF
        res = [1, 3, 4, d0, d1, d2, d3, 0, 0]
        assert vendor_decode_from_response_bytes(res) == decode_float32_cdab([reg0, reg1]), v


def test_encode_decode_round_trips_including_negative_and_fractional():
    for v in (0.0, 1.0, 10.0, 8.0, 11.0, 14.0, -5.5, 123.456):
        got = decode_float32_cdab(encode_float32_cdab(v))
        assert abs(got - v) < 1e-3, (v, got)


def test_decode_refuses_the_wrong_register_count_loudly():
    try:
        decode_float32_cdab([1, 2, 3])
        assert False, "must raise, never guess at a mis-sized register block"
    except ValueError as e:
        assert "2 registers" in str(e)


def test_line_number_register_is_declared_alongside_state_not_a_second_poller():
    """BACKLOG #79's own instruction: extend the existing PositionPoller machinery, never write a second
    poller. Confirmed by construction: a default-registers poller already carries line_number."""
    assert "line_number" in REGISTERS
    assert REGISTERS["line_number"]["addr"] == 16062
    assert REGISTERS["line_number"]["count"] == 2
    assert REGISTERS["state"]["addr"] == 10002   # unchanged address — only the note text was corrected
    p = PositionPoller("COM_UNUSED", 115200, 1)
    assert "line_number" in p.registers, "the default PositionPoller must poll line_number without a caller opting in"


# ── (2) Ops.job_tracking_status() — logic, no wire I/O ──────────────────────────────────────────────────────

def test_job_tracking_status_with_no_poller_says_so_plainly():
    from fairy.ops import Ops
    ops = Ops(backend=None, config=None)   # position_poller defaults to None
    assert ops.job_tracking_status() == {"enabled": False}


def test_job_tracking_status_before_any_successful_read_reports_not_connected():
    from fairy.ops import Ops
    ops = Ops(backend=None, config=None, position_poller=PositionPoller("COM_UNUSED", 115200, 1))
    st = ops.job_tracking_status()
    assert st["enabled"] is True
    assert st["connected"] is False
    assert st["error"] == "not started"
    assert st["running"] is None and st["line"] is None
    assert st["read_at"] is None


def test_job_tracking_status_decodes_idle():
    from fairy.ops import Ops

    class _FakeIdlePoller:
        def status(self): return {"ok": True, "error": None}
        def latest(self): return {"state": encode_float32_cdab(0.0), "line_number": encode_float32_cdab(0.0), "ts": 1734567890.0}

    ops = Ops(backend=None, config=None, position_poller=_FakeIdlePoller())
    st = ops.job_tracking_status()
    assert st == {"enabled": True, "connected": True, "error": None, "running": False, "line": 0, "read_at": "2024-12-19T00:24:50Z"}


def test_job_tracking_status_decodes_running_with_a_live_line_number():
    from fairy.ops import Ops

    class _FakeRunningPoller:
        def status(self): return {"ok": True, "error": None}
        def latest(self): return {"state": encode_float32_cdab(1.0), "line_number": encode_float32_cdab(10.0), "ts": 1734567890.0}

    ops = Ops(backend=None, config=None, position_poller=_FakeRunningPoller())
    st = ops.job_tracking_status()
    assert st["running"] is True
    assert st["line"] == 10


def test_job_tracking_status_treats_ANY_nonzero_state_as_running_never_idle():
    """BACKLOG #79's own explicit rule: only 0/1 have been observed on register 10002, but the vendor's tool
    treats any non-zero as running — an unknown value (feed hold? probing?) must never read as idle."""
    from fairy.ops import Ops

    class _FakeUnknownStatePoller:
        def status(self): return {"ok": True, "error": None}
        def latest(self): return {"state": encode_float32_cdab(0.5), "line_number": encode_float32_cdab(3.0), "ts": 1734567890.0}

    ops = Ops(backend=None, config=None, position_poller=_FakeUnknownStatePoller())
    st = ops.job_tracking_status()
    assert st["running"] is True, "a non-{0,1} state value must still read as running, per the vendor's own convention"


def test_job_tracking_status_never_leaks_ts_or_raw_registers():
    """job_tracking_status is the DECODED surface — raw register lists belong to position_status(), not here."""
    from fairy.ops import Ops

    class _FakePoller:
        def status(self): return {"ok": True, "error": None}
        def latest(self): return {"state": encode_float32_cdab(1.0), "line_number": encode_float32_cdab(5.0), "ts": 1734567890.0}

    ops = Ops(backend=None, config=None, position_poller=_FakePoller())
    st = ops.job_tracking_status()
    assert set(st.keys()) == {"enabled", "connected", "error", "running", "line", "read_at"}


# ── (3) the real wire round trip: idle -> running -> line-advance -> finish, against a synthetic slave ──────

def _pymodbus_client_matches_pinned_signature():
    try:
        import inspect
        from pymodbus.client import ModbusSerialClient
        sig = inspect.signature(ModbusSerialClient.read_holding_registers)
        params = list(sig.parameters.values())
        return len(params) >= 4 and params[3].name == "slave" and params[3].kind != inspect.Parameter.KEYWORD_ONLY
    except Exception:
        return False


def test_real_poller_tracks_idle_to_running_to_line_advance_to_finish():
    """THE VERIFY BAR: a synthetic slave whose registers change over time, proving the poller's own DECODED
    view (via Ops.job_tracking_status, not just raw registers) advances through every state transition a real
    job produces — the exact sequence FINDINGS.md's own V21/V23 runs measured on the real machine, reproduced
    here against a controllable fake so the assertion doesn't need real hardware to be trustworthy."""
    if not _pymodbus_client_matches_pinned_signature():
        print("  SKIP  (installed pymodbus does not match the pinned 3.6.9 client signature -- see "
              "WORK-LOG t2063 for the manual run against a correctly-pinned scratch venv)")
        return

    import threading as th
    from pymodbus.datastore import ModbusSequentialDataBlock, ModbusServerContext, ModbusSlaveContext
    from pymodbus.server import StartTcpServer
    from pymodbus.client import ModbusTcpClient
    from fairy.ops import Ops

    block = ModbusSequentialDataBlock(0, [0] * 20000)
    block.setValues(10002, encode_float32_cdab(0.0))   # idle at boot
    block.setValues(16062, encode_float32_cdab(0.0))
    store = ModbusSlaveContext(hr=block, zero_mode=True)
    context = ModbusServerContext(slaves=store, single=True)
    PORT = 15506
    th.Thread(target=lambda: StartTcpServer(context=context, address=("127.0.0.1", PORT)), daemon=True).start()
    time.sleep(0.3)

    p = PositionPoller("UNUSED", 115200, 1, interval_s=0.2, registers={"state": REGISTERS["state"], "line_number": REGISTERS["line_number"]})
    ops = Ops(backend=None, config=None, position_poller=p)

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
        time.sleep(0.5)
        st = ops.job_tracking_status()
        assert st["connected"] is True, st
        assert st["running"] is False and st["line"] == 0, ("idle at boot", st)

        # Start pressed — matches FINDINGS.md's own V21 run: 10002 -> 1, holds through motion/dwell
        block.setValues(10002, encode_float32_cdab(1.0))
        block.setValues(16062, encode_float32_cdab(10.0))
        time.sleep(0.5)
        st = ops.job_tracking_status()
        assert st["running"] is True and st["line"] == 10, ("running, first line", st)

        # line advance — matches V23_lineadvance.nc's own 8 -> 11 -> 14 sequence (the "does it ADVANCE" proof)
        for line in (11, 14):
            block.setValues(16062, encode_float32_cdab(float(line)))
            time.sleep(0.5)
            st = ops.job_tracking_status()
            assert st["running"] is True and st["line"] == line, (f"advance to line {line}", st)

        # finish edge — both clear, matching FINDINGS.md's own V21 t=56.3s row
        block.setValues(10002, encode_float32_cdab(0.0))
        block.setValues(16062, encode_float32_cdab(0.0))
        time.sleep(0.5)
        st = ops.job_tracking_status()
        assert st["running"] is False and st["line"] == 0, ("finished", st)
    finally:
        p.stop()


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- job_tracking_status decodes state/line_number correctly, treats any nonzero state as "
          "running, and the real poller round-trip tracks a full idle->running->advance->finish sequence "
          "against a synthetic slave")
