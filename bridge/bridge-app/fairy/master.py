"""master.py — Modbus RTU MASTER/client for polling the controller's own Slave-mode registers (t2059).

DIRECTION IS THE OPPOSITE OF slave.py. slave.py makes CNC-FAIRY a Modbus SLAVE that the Expert (as master)
PUSHES MSETDATA checkpoint frames INTO (PROTOCOL §1). This file makes CNC-FAIRY a Modbus MASTER that POLLS
the Expert's OWN Modbus slave-mode registers (controller param P279=Slave) — a read-only, PC-INITIATED
request/response. Prepares Option 1 (M350-MODBUS-REFERENCE.md, JOB-PROGRESS-PLAN.md) — position/state
polling with no emitted-G-code change at all, the fallback-of-choice for when Option 2's checkpoint push
isn't wanted. Nothing here is wired into the live poller/job flow yet — this is the client alone, proven
against a local synthetic slave (test_master_local_slave_2059.py), per the dispatch's own "prove it here
before it meets the machine."

WHY THIS CANNOT WEDGE THE FIRMWARE THE WAY MGETDATA DOES (dispatch's own explicit question, answered here so
it stays attached to the code, not just a WORK-LOG paragraph):
`MGETDATA` is a G-CODE MACRO INSTRUCTION — the Expert's own interpreter executes it WHILE A PROGRAM RUNS,
blocking that running macro on an external slave's reply (a documented ~16s timeout; a non-responding or
wrongly-configured slave hangs the controller's own analyzer channel hard enough to force a reboot —
expert-m350/FINDINGS.md). That hazard lives entirely INSIDE the controller's macro-execution path.

Polling here is the reverse relationship. With P279=Slave, the Expert's firmware MODBUS STACK — not a
running macro, not the G-code interpreter — answers a standard FC03 (read holding registers) request the
way any compliant Modbus slave device does. No macro executes, nothing on the controller blocks waiting for
anything; the controller's own analyzer/interpreter is never in this path at all. A bad register, a timeout,
or a malformed reply here stalls only the PC's own poll loop — never the machine, never the running program.
This module NEVER issues MGETDATA (it has no G-code emission of any kind — it speaks raw Modbus RTU frames
directly) and never will: `read()` below is the ONLY transaction shape this file can produce, and it is a
plain FC03 read.

REGISTER MAP — EVIDENCE, NOT ATTESTED (M350-MODBUS-REFERENCE.md §1). Sourced from a DIFFERENT OEM-derived
open-source project's own working code (foinnc/M3X-M350-IoT-Bridge), never bench-confirmed against THIS
user's own controller. Declared here as data, not scattered as magic numbers through the logic, so a
correction (or an addition, once a fuller map is established) is a one-line edit, not a hunt through call
sites. `count` is REGISTERS per block (each float32 axis value spans 2 registers; `state` is one 32-bit int
= 2 registers) — read()'s own length check below is what makes a wrong count fail loudly instead of silently
truncating.
"""

REGISTERS = {
    "work_position": {"addr": 7080, "count": 10, "note": "WORK coords X,Y,Z,A,B — 5 x float32 (2 regs each)"},
    "machine_position": {"addr": 7260, "count": 10, "note": "MACHINE coords X,Y,Z,A,B — 5 x float32"},
    "state": {"addr": 10002, "count": 2, "note": "system state (IDLE/BUSY/RESET) — 32-bit int"},
}


class ModbusMasterError(Exception):
    """Anything that stops a read from being a clean, trustworthy answer. Raised, never swallowed — a
    caller that catches this broadly and moves on is reintroducing the t2057 defect (a failure nobody sees).
    Deliberately one exception type for every failure shape (connect, timeout, Modbus exception response,
    wrong-length reply, unknown register key) — a caller checking `except ModbusMasterError` catches all of
    them, so nothing slips through a narrower except clause by accident."""


class ModbusMaster:
    """A read-only Modbus RTU master. Never issues a write — `read()` is the only transaction this class can
    produce. Fails LOUDLY AND INSTANTLY on anything that isn't a clean, correctly-sized reply: a wrong
    register, a Modbus protocol-level exception response, a transport timeout, and a malformed/short reply
    all raise the SAME `ModbusMasterError`, immediately, from the call that hit them — never a silent stale
    value, never a thread that looks alive while answering nothing (the mirror-image discipline of t2057's
    `slave.py` probe-before-start fix: report what happened, not what was hoped for).

    Call shape pinned to pymodbus==3.6.9 (the project's own required version — see slave.py's own note;
    3.13's `read_holding_registers` renamed the `slave` kwarg to `device_id` and made it keyword-only,
    confirmed by direct inspection of both installs while building this)."""

    def __init__(self, port, baud, device_id, timeout=1.0):
        self.port = port
        self.baud = baud
        self.device_id = device_id
        self.timeout = timeout
        self._client = None

    def connect(self):
        from pymodbus.client import ModbusSerialClient
        self._client = ModbusSerialClient(
            port=self.port, baudrate=self.baud, timeout=self.timeout,
            bytesize=8, parity="N", stopbits=1,
        )
        if not self._client.connect():
            self._client = None
            raise ModbusMasterError(f"could not open {self.port}@{self.baud}: connect() returned False")

    def read(self, key):
        """Read a DECLARED register block by name (a key in REGISTERS — never a bare address, so a typo'd
        register is a KeyError-shaped refusal at the call site, not a silent wrong read). Returns the raw
        register list on a clean reply; raises ModbusMasterError on anything else."""
        if self._client is None:
            raise ModbusMasterError("not connected — call connect() first")
        spec = REGISTERS.get(key)
        if spec is None:
            raise ModbusMasterError(f"unknown register key {key!r} — not in the declared REGISTERS map")
        try:
            rr = self._client.read_holding_registers(spec["addr"], spec["count"], self.device_id)
        except Exception as e:
            raise ModbusMasterError(f"read({key!r}) at {spec['addr']}: transport failure: {e}") from e
        if rr is None:
            raise ModbusMasterError(f"read({key!r}) at {spec['addr']}: no response")
        if rr.isError():
            raise ModbusMasterError(f"read({key!r}) at {spec['addr']}: Modbus error response: {rr}")
        regs = getattr(rr, "registers", None)
        if not regs or len(regs) != spec["count"]:
            got = len(regs) if regs else 0
            raise ModbusMasterError(
                f"read({key!r}) at {spec['addr']}: expected {spec['count']} registers, got {got} — "
                "the register map may be wrong for this controller; do not trust this reply"
            )
        return regs

    def close(self):
        if self._client is not None:
            self._client.close()
            self._client = None
