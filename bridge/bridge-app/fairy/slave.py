"""slave.py — the readback channel (ARCHITECTURE.md §4, PROTOCOL §1).

The Expert is the Modbus MASTER; it PUSHES beacons to us via MSETDATA. So CNC-FAIRY
presents a Modbus RTU *slave* and watches HOLDING register 0. Each beacon arrives as
`reg = (111 << 8) | n` -> decode n = reg & 0xFF, valid only if (reg >> 8) & 0xFF == 111.
(This frame is PROVEN LIVE 2026-06-06; see PROTOCOL §1 — do not change it.)

We NEVER issue MGETDATA (a read) — that hard-wedges the Expert (FINDINGS / tools/README).
The slave only ever *receives*.

A BeaconSource is the seam between the real Modbus slave (needs hardware + pymodbus) and
a hardware-free SimBeaconSource (for demo/tests). Both expose the same tiny contract:
  start() / reset() / latest() -> (n, ts) | None
`latest()` returns the HIGHEST valid beacon seen since the last reset() (beacons in a job
run strictly 1..total). reset() is called by the Poller when a new job becomes active, so
the previous job's beacons can't leak into the next (the frame carries no job id — §4).
"""
import threading
import time
from abc import ABC, abstractmethod

MARKER = 111   # PROTOCOL §1 — high byte that identifies a checkpoint frame


class _LatestBeacon:
    """Thread-safe 'highest valid beacon since reset', shared with the slave thread."""

    def __init__(self, marker=MARKER):
        self.marker = marker
        self._lock = threading.Lock()
        self._n = None
        self._ts = None

    def offer(self, reg, ts):
        if (reg >> 8) & 0xFF != self.marker:
            return                      # not a checkpoint frame — ignore (PROTOCOL §1)
        n = reg & 0xFF
        if n <= 0:
            return
        with self._lock:
            if self._n is None or n > self._n:
                self._n, self._ts = n, ts

    def reset(self, marker=None):
        with self._lock:
            if marker is not None:
                self.marker = marker        # per-job marker (PROTOCOL §1 default is 111)
            self._n = self._ts = None

    def latest(self):
        with self._lock:
            return None if self._n is None else (self._n, self._ts)


class BeaconSource(ABC):
    @abstractmethod
    def start(self): ...
    @abstractmethod
    def reset(self, marker=None): ...
    @abstractmethod
    def latest(self): ...
    def stop(self):
        pass
    def status(self):
        """The receiver's REAL, current state — {"ok": bool, "error": str|None}. t2057 — default
        healthy-always (no real hardware to be unhealthy); ModbusBeaconSource overrides with the truth."""
        return {"ok": True, "error": None}


class ModbusBeaconSource(BeaconSource):
    """The real channel: a pymodbus RTU slave on COM6, run in a daemon thread.
    Requires `pip install "pymodbus==3.6.9"` (3.13 broke the classic datastore — pin it)."""

    def __init__(self, port, baud, slave_id, marker=MARKER):
        self.port = port
        self.baud = baud
        self.slave_id = slave_id
        self._beacon = _LatestBeacon(marker)
        self._thread = None
        self._error = None    # None = healthy; a string = why the receiver is NOT actually listening. t2057

    def status(self):
        """t2057 — THE RECEIVER'S REAL STATE, not what `enable_slave` was configured to. Report what IS."""
        if self._error:
            return {"ok": False, "error": self._error}
        if self._thread and self._thread.is_alive():
            return {"ok": True, "error": None}
        return {"ok": False, "error": "not started"}

    def start(self):
        # t2057 — PROBE THE PORT FIRST, synchronously, before handing off to pymodbus. Confirmed on the
        # bench (a scratch venv pinned to the required pymodbus==3.6.9): StartSerialServer's own transport
        # layer sets `reconnect_delay=2` and RETRIES A FAILED OPEN FOREVER inside its asyncio loop — a
        # missing/busy/wrong port never raises out of this thread, never stops the thread, and the daemon
        # thread stays `is_alive() == True` indefinitely either way. A try/except around StartSerialServer
        # itself catches NOTHING (proven, not assumed) — the only way to know honestly is to test the port
        # BEFORE handing it to that retry loop. A quick pyserial open+close raises synchronously and clearly
        # for a missing device, a wrong port name, or one already claimed by another process.
        try:
            import serial
            probe = serial.Serial(port=self.port, baudrate=self.baud, timeout=0.2)
            probe.close()
        except Exception as e:
            self._error = f"could not open {self.port}: {e}"
            return   # do NOT start the thread — nothing to run; status() now reports the real reason

        from pymodbus.datastore import (
            ModbusSequentialDataBlock,
            ModbusServerContext,
            ModbusSlaveContext,
        )
        from pymodbus.server import StartSerialServer
        from pymodbus.transaction import ModbusRtuFramer

        beacon = self._beacon

        class BeaconBlock(ModbusSequentialDataBlock):
            def __init__(self):
                super().__init__(0, [0] * 2001)

            def setValues(self, address, values):
                super().setValues(address, values)
                vlist = values if isinstance(values, (list, tuple)) else [values]
                ts = time.time()
                for off, v in enumerate(vlist):
                    if address + off == 0:        # the beacon lands at HOLDING reg 0
                        beacon.offer(v, ts)

        store = ModbusSlaveContext(
            di=ModbusSequentialDataBlock(0, [0] * 2001),
            co=ModbusSequentialDataBlock(0, [0] * 2001),
            hr=BeaconBlock(),
            ir=BeaconBlock(),
            zero_mode=True,
        )
        context = ModbusServerContext(slaves={self.slave_id: store}, single=False)

        def _run():
            StartSerialServer(
                context=context,
                framer=ModbusRtuFramer,
                port=self.port,
                baudrate=self.baud,
                bytesize=8,
                parity="N",
                stopbits=1,
            )

        self._thread = threading.Thread(target=_run, daemon=True)
        self._thread.start()

    def reset(self, marker=None):
        self._beacon.reset(marker)

    def latest(self):
        return self._beacon.latest()


class SimBeaconSource(BeaconSource):
    """Hardware-free beacon source for demo/tests. Call feed(n) to inject a beacon
    exactly as the controller's MSETDATA would land it."""

    def __init__(self, marker=MARKER):
        self._beacon = _LatestBeacon(marker)

    def start(self):
        pass

    def reset(self, marker=None):
        self._beacon.reset(marker)

    def latest(self):
        return self._beacon.latest()

    def feed(self, n):
        self._beacon.offer((self._beacon.marker << 8) | (n & 0xFF), time.time())
