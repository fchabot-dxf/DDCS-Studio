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

import struct
import threading
import time

REGISTERS = {
    "work_position": {"addr": 7080, "count": 10, "note": "WORK coords X,Y,Z,A,B — 5 x float32 (2 regs each)"},
    "machine_position": {"addr": 7260, "count": 10, "note": "MACHINE coords X,Y,Z,A,B — 5 x float32"},
    # t2647 (BACKLOG #79) — note text updated to the newer, CONFIRMED meaning (was "IDLE/BUSY/RESET — 32-bit
    # int", the t2063 placeholder before this was ever bench-proven). Address/count UNCHANGED — a caller
    # (test_position_poller_2063.py) references REGISTERS["state"] directly by key, so the key name stays.
    # CONFIRMED [expert-m350/FINDINGS.md "RUN STATE CONFIRMED", 2026-09-05, owner pressed Start on
    # V21_dwell.nc]: 1.0 = a program is RUNNING (program-level — holds through a G04 dwell, NOT a motion
    # flag), 0.0 = idle. Float32 CDAB (decode_float32_cdab below) — vendor source m350_liveg.py's own
    # poll_m350_state_with_strict_crc, re-derived from register values (not the raw byte stream) here.
    "state": {"addr": 10002, "count": 2, "note": "program running (1.0) vs idle (0.0), float32 CDAB — NOT a motion flag, holds through a dwell"},
    # t2647 (BACKLOG #79) — the executing line number. CONFIRMED [FINDINGS.md "REGISTER 16062 IS THE LIVE
    # EXECUTING LINE NUMBER", 2026-09-05]: float32 CDAB, 0.0 at idle, matches the file's own line number
    # exactly (verified against V21_dwell.nc's G04 on line 10 -> read back 10.0). Macro mirror #2031.
    # ⚠ UNTESTED: whether this counts physical file lines or executable blocks on a file with interleaved
    # comments (FINDINGS.md, same section) — do not draw a percentage off it; show "line N" only (BACKLOG #79).
    "line_number": {"addr": 16062, "count": 2, "note": "executing line number, float32 CDAB, 0.0 at idle (macro #2031)"},
}


def decode_float32_cdab(regs):
    """Decode a 2-register Modbus read into the float32 value it represents, per the CDAB word-swap the
    vendor's own m350_liveg.py uses (confirmed live, expert-m350/FINDINGS.md "RUN STATE IS EXPORTED"):
    `struct.unpack('>f', bytes([res[5], res[6], res[3], res[4]]))` where res[3:5] are the FIRST register's own
    big-endian bytes and res[5:7] the SECOND's. In terms of pymodbus's own parsed `regs` list (`regs[0]` =
    first register, `regs[1]` = second, each already a 16-bit int) that is: pack regs[1] then regs[0], each
    big-endian within itself, and interpret the resulting 4 bytes as a big-endian float32. Raises ValueError
    on anything but exactly 2 registers — a caller passing the wrong register block is a bug to surface, not
    a value to guess at."""
    if len(regs) != 2:
        raise ValueError(f"decode_float32_cdab needs exactly 2 registers, got {len(regs)}")
    return struct.unpack(">f", struct.pack(">HH", regs[1], regs[0]))[0]


def encode_float32_cdab(value):
    """The exact inverse of decode_float32_cdab — packs a float into the 2-register [reg0, reg1] shape a
    synthetic Modbus slave's datastore expects, so a test can plant a KNOWN value and assert the decoded
    round-trip rather than asserting on raw register ints it would otherwise have to hand-compute."""
    b = struct.pack(">f", value)   # big-endian float32 bytes: A B C D
    reg1 = (b[0] << 8) | b[1]      # A B — the SECOND register (high half, CDAB's own word-swap)
    reg0 = (b[2] << 8) | b[3]      # C D — the FIRST register (low half)
    return [reg0, reg1]


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

    def __init__(self, port, baud, device_id, timeout=1.0, registers=None):
        self.port = port
        self.baud = baud
        self.device_id = device_id
        self.timeout = timeout
        # t2063 — CONFIGURABLE, not baked in: the register map is evidence, never bench-confirmed on this
        # user's own controller, so a correction (a wrong address, a wrong count) must cost a config value,
        # not a code change. Snapshotted from the module default at construction time; pass an override dict
        # (any subset of keys) to replace individual blocks without touching this file.
        self.registers = dict(registers) if registers else dict(REGISTERS)
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
        """Read a DECLARED register block by name (a key in this instance's registers — never a bare
        address, so a typo'd register is a KeyError-shaped refusal at the call site, not a silent wrong
        read). Returns the raw register list on a clean reply; raises ModbusMasterError on anything else."""
        if self._client is None:
            raise ModbusMasterError("not connected — call connect() first")
        spec = self.registers.get(key)
        if spec is None:
            raise ModbusMasterError(f"unknown register key {key!r} — not in the declared registers map")
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


class PositionPoller:
    """t2063 — Option 1's READ-side progress source: continuously polls the controller's own Modbus
    Slave-mode registers (P279=Slave) for live position/state, in a background daemon thread, with the SAME
    honest `status()` contract from t2057: a dead poller REPORTS dead, it never looks healthy by omission.
    `status()` reflects the LAST poll CYCLE's real outcome, not merely "is the thread alive" — a thread that
    keeps looping while every single read fails must still report unhealthy; that was exactly the gap t2057
    closed on the receive side, and this is the same discipline applied to the read side.

    Position/state is not a beacon ordinal — there is no cursor yet to translate "where the tool physically
    is" into "which operation, how much time left" (`JOB-PROGRESS-PLAN.md`'s own cursor-advance design, named
    as load-bearing and explicitly NOT built at t2059/t2061). This class only proves the one thing t2063 asked
    for: that the PC can read live position/state from the controller, standing alone, observable, honestly
    reported. BACKLOG #79 (t2647) later built the job-tracking consumer on top of it.

    t2649 (BACKLOG #78) — this docstring used to explain why this class was MUTUALLY EXCLUSIVE with
    `slave.py`'s `ModbusBeaconSource` on the SAME physical serial link (a controller-side fact: `P279` is a
    three-way mode select — `NO`/`Poll`/`Slave` — and MSETDATA's master-mode push needs `Poll` while this
    class needs `Slave`, so a controller can only serve one of them at a time). `slave.py` and the beacon
    mechanism it served are REMOVED (owner-directed 2026-09-04) — there is nothing left to be exclusive
    with — kept here as a historical note in case a future master-mode consumer is ever added again.
    """

    def __init__(self, port, baud, device_id, interval_s=2.0, registers=None, timeout=1.0):
        self.port = port
        self.baud = baud
        self.device_id = device_id
        self.interval_s = interval_s
        self.registers = dict(registers) if registers else dict(REGISTERS)
        self.timeout = timeout
        self._thread = None
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self._latest = None    # {..key: [regs].., "ts": float} from the most recent CLEAN cycle
        self._error = None     # the most recent cycle's failure reason, or None while healthy

    def start(self):
        self._stop.clear()
        self._error = None
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=self.interval_s + 2)
        self._thread = None

    def status(self):
        """{"ok": bool, "error": str|None} — t2057's exact contract, reused rather than re-invented."""
        if self._thread is None or not self._thread.is_alive():
            return {"ok": False, "error": self._error or "not started"}
        if self._error:
            return {"ok": False, "error": self._error}
        if self._latest is None:
            return {"ok": False, "error": "no successful read yet"}
        return {"ok": True, "error": None}

    def latest(self):
        """The most recent SUCCESSFUL reading, or None if none has landed yet — never a stale value handed
        out silently: check status() alongside this to know whether it's still current."""
        with self._lock:
            return dict(self._latest) if self._latest is not None else None

    def _run(self):
        master = ModbusMaster(self.port, self.baud, self.device_id, timeout=self.timeout, registers=self.registers)
        try:
            master.connect()
        except ModbusMasterError as e:
            self._error = str(e)
            return   # connect failed -- the thread ends HERE; status() reports it, nothing hides behind an internal retry loop (the exact pymodbus-server trap t2057 fixed on the receive side)
        try:
            while not self._stop.is_set():
                try:
                    cycle = {key: master.read(key) for key in self.registers}
                    cycle["ts"] = time.time()
                    with self._lock:
                        self._latest = cycle
                    self._error = None
                except ModbusMasterError as e:
                    self._error = str(e)   # THIS cycle failed; the OLD _latest (still the last genuinely good reading) stays, but status() now reports the failure honestly rather than silently continuing to look fine
                self._stop.wait(self.interval_s)
        finally:
            master.close()
