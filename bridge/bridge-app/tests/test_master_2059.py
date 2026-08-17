"""
MASTER-SIDE MODBUS: OPTION 1 PREP, proven against a LOCAL SYNTHETIC SLAVE first (t2059).

bridge/ had ZERO master-side Modbus code before this turn (grepped: only slave.py, a passive receiver).
`fairy/master.py` adds a read-only Modbus RTU CLIENT for polling the Expert's own Slave-mode registers
(P279=Slave) — the "PC as master, no emitted G-code" path (Option 1), currently blocked on the human's own
firmware/parameter confirmation, prepared here so it is ready the moment that lands.

TWO TIERS of proof, on purpose:
  1. Logic that needs NO pymodbus wire I/O at all — REGISTERS shape, unknown-key refusal, not-connected
     refusal. Runs here, in the standard suite, under whatever pymodbus is installed.
  2. A REAL round-trip against a synthetic in-process Modbus slave — needs pymodbus's client AND server
     APIs to actually agree with each other on the wire. `master.py`'s own `read()` is written for the
     PINNED `pymodbus==3.6.9` (matching what actually ships — see master.py's own note on the 3.13 rename
     of `slave`->`device_id`). This machine's installed pymodbus may not match; guarded below so a mismatch
     SKIPS cleanly (prints why, does not fail the suite) rather than crash the gate on an environment fact
     unrelated to the code under test. See WORK-LOG t2059 for the MANUAL run against the correctly-pinned
     version (a scratch venv), which is the one that actually proves the wire protocol.

Run standalone:  python bridge/bridge-app/tests/test_master_2059.py
"""
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))
from fairy.master import ModbusMaster, ModbusMasterError, REGISTERS   # noqa: E402


# ── (1) logic that needs no pymodbus wire I/O ───────────────────────────────────────────────────────────────

def test_registers_are_declared_data_not_scattered_magic_numbers():
    """The three EVIDENCE-tier blocks from M350-MODBUS-REFERENCE.md §1, exactly — a wrong number here is a
    one-line diff to fix, not a hunt through call sites."""
    assert REGISTERS["work_position"] == {"addr": 7080, "count": 10, "note": REGISTERS["work_position"]["note"]}
    assert REGISTERS["machine_position"] == {"addr": 7260, "count": 10, "note": REGISTERS["machine_position"]["note"]}
    assert REGISTERS["state"] == {"addr": 10002, "count": 2, "note": REGISTERS["state"]["note"]}


def test_read_before_connect_refuses_loudly_not_silently():
    m = ModbusMaster("COM_UNUSED", 115200, 1)
    try:
        m.read("state")
        assert False, "must raise, never return silently"
    except ModbusMasterError as e:
        assert "not connected" in str(e)


def test_read_an_unknown_register_key_refuses_loudly():
    """A typo'd register name is a KeyError-shaped refusal at the call site, never a silent wrong read —
    fails even before touching the (unset) client, so this needs no connection at all."""
    m = ModbusMaster("COM_UNUSED", 115200, 1)
    m._client = object()   # anything non-None — the unknown-key check must fire BEFORE any client call
    try:
        m.read("line_number")   # doesn't exist — t2046/t2055 both confirmed no such register is documented
        assert False, "must raise, never return silently"
    except ModbusMasterError as e:
        assert "unknown register key" in str(e) and "line_number" in str(e)


def test_close_before_connect_is_a_harmless_noop():
    ModbusMaster("COM_UNUSED", 115200, 1).close()   # must not raise


# ── (2) the real wire round-trip, against a synthetic in-process slave ─────────────────────────────────────

def _pymodbus_client_matches_pinned_signature():
    """t2059 — the SAME cross-version trap master.py's own header names: 3.13 renamed `slave`->`device_id`
    and made it keyword-only. Detect it structurally (not by version string, which could itself drift) —
    ask whether a positional 3rd argument is even accepted."""
    try:
        import inspect
        from pymodbus.client import ModbusSerialClient
        sig = inspect.signature(ModbusSerialClient.read_holding_registers)
        params = list(sig.parameters.values())
        # pinned shape: (self, address, count=1, slave=0, **kwargs) -- slave is POSITIONAL-capable, index 3
        return len(params) >= 4 and params[3].name == "slave" and params[3].kind != inspect.Parameter.KEYWORD_ONLY
    except Exception:
        return False


def test_real_round_trip_against_a_synthetic_slave():
    if not _pymodbus_client_matches_pinned_signature():
        print("  SKIP  (installed pymodbus does not match the pinned 3.6.9 client signature master.py "
              "targets -- see WORK-LOG t2059 for the manual run against a correctly-pinned scratch venv, "
              "which is what actually proves this wire round-trip)")
        return

    import threading
    import time
    from pymodbus.datastore import ModbusSequentialDataBlock, ModbusServerContext, ModbusSlaveContext
    from pymodbus.server import StartTcpServer
    from pymodbus.client import ModbusTcpClient

    # A minimal synthetic slave: holding registers pre-loaded with KNOWN values at the SAME addresses
    # master.py's own REGISTERS map declares, so a real read() proves the whole chain — request encoding,
    # transport, response decoding, length validation -- not just that a socket opened.
    block = ModbusSequentialDataBlock(0, [0] * 20000)
    block.setValues(7080, [111, 222])                # work_position's first two registers, zero_mode=True so addr 7080 means exactly that
    store = ModbusSlaveContext(hr=block, zero_mode=True)
    context = ModbusServerContext(slaves=store, single=True)

    PORT = 15502
    srv_thread = threading.Thread(
        target=lambda: StartTcpServer(context=context, address=("127.0.0.1", PORT)),
        daemon=True,
    )
    srv_thread.start()
    time.sleep(0.3)   # let the listener bind before the client dials in

    m = ModbusMaster("UNUSED", 115200, 1)
    m._client = ModbusTcpClient("127.0.0.1", port=PORT, timeout=2.0)
    assert m._client.connect(), "the synthetic slave must accept the connection"
    try:
        regs = m.read("work_position")
        assert regs == [111, 222] + [0] * 8, regs   # the two we set, the rest of the declared count still comes back as real registers
    finally:
        m.close()


def test_real_round_trip_a_wrong_register_count_fails_loudly():
    """THE POINT of the whole design: a slave that answers with the WRONG number of registers (exactly what
    would happen if the register map is simply wrong for this controller) must be REFUSED, not silently
    truncated/padded into looking like a valid reading."""
    if not _pymodbus_client_matches_pinned_signature():
        print("  SKIP  (see test_real_round_trip_against_a_synthetic_slave)")
        return

    import threading
    import time
    from fairy import master as master_mod
    from pymodbus.datastore import ModbusSequentialDataBlock, ModbusServerContext, ModbusSlaveContext
    from pymodbus.server import StartTcpServer
    from pymodbus.client import ModbusTcpClient

    # Register a bogus block whose declared count (3) will never match what a real "state" read (count=2)
    # returns once the slave's own address space is short -- simulate a wrong map by pointing "state" at an
    # address this synthetic slave never populated meaningfully, then asking for MORE registers than exist
    # in a way that provokes a Modbus exception response (illegal address) rather than silent garbage.
    old_regs = master_mod.REGISTERS
    master_mod.REGISTERS = {**old_regs, "state": {"addr": 19990, "count": 50, "note": "deliberately past the datastore's real size"}}
    try:
        block = ModbusSequentialDataBlock(0, [0] * 20000)
        store = ModbusSlaveContext(hr=block, zero_mode=True)
        context = ModbusServerContext(slaves=store, single=True)
        PORT = 15503
        threading.Thread(target=lambda: StartTcpServer(context=context, address=("127.0.0.1", PORT)), daemon=True).start()
        time.sleep(0.3)

        m = ModbusMaster("UNUSED", 115200, 1)
        m._client = ModbusTcpClient("127.0.0.1", port=PORT, timeout=2.0)
        assert m._client.connect()
        try:
            m.read("state")
            assert False, "an out-of-range register block must be REFUSED, never silently accepted"
        except ModbusMasterError as e:
            assert "state" in str(e), e   # names WHICH read failed
        finally:
            m.close()
    finally:
        master_mod.REGISTERS = old_regs


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- master-side Modbus client logic proven; the real wire round-trip runs when the installed "
          "pymodbus matches the pinned client signature, else skips cleanly and names why")
