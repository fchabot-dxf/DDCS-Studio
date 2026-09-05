#!/usr/bin/env python3
"""macro_probe.py — evaluate macro expressions on a DDCS Expert and read the answer back.

Injects `#915 = <expr>` at register 3000 and reads register 7330 (= 6500 + 2*415, the Modbus mirror
of macro #915). Reads only; #915 is a scratch slot in the unused/±9999 range and is restored to 0.

⛔ WHY THIS FILE EXISTS — the failure it is built to prevent, measured 2026-09-05:

A syntax error LATCHES the controller. After it, register 3000 still ACKs every FC16 write at the wire
level and SILENTLY DISCARDS the line. The target variable keeps its last good value, so the read-back
returns a plausible-looking number that measures nothing. Nine expressions in a row read `1.0` — the
value TAN[45] had legitimately left behind — including `[3*3]`, which is not 9. It was caught only
because the owner looked at the pendant.

⭐ The naive guard (write a sentinel, call it evaluated if the read-back differs) DOES NOT WORK: when the
channel is dead the sentinel is dropped too, so the stale value never equals the sentinel and every
reading passes. THE SENTINEL MUST BE READ BACK AND CONFIRMED TO HAVE LANDED. That is what probe() does,
and why it stops the whole run at the first drop instead of returning numbers nobody can trust.

Clearing a latch needs Reset AT THE PENDANT. `#2037 = 65863` cannot do it — that press would travel
through the same channel that is dropping lines.

Usage:
    python macro_probe.py COM6 "SQRT[16]" "COS[90]" "[1 NE 2]"
    python macro_probe.py COM6 --file exprs.txt
"""
import struct
import sys
import time

REG_INJECT = 3000
MAX_PAYLOAD = 246
SCRATCH = 916   # NOT 915 -- #915 refuses writes, cause unknown (FINDINGS 2026-09-05)
REG_READ = 6500 + 2 * (SCRATCH - 500)   # 7332
SENTINEL = -77777.0


def crc16(b):
    c = 0xFFFF
    for x in b:
        c ^= x
        for _ in range(8):
            c = (c >> 1) ^ 0xA001 if c & 1 else c >> 1
    return c


def frame(body):
    return body + struct.pack("<H", crc16(body))


def read_f32(s, reg):
    """Read one word-swapped float32 (LOW word first — little-endian throughout)."""
    s.reset_input_buffer()
    s.write(frame(bytes([1, 3]) + struct.pack(">HH", reg, 2)))
    time.sleep(0.25)
    r = s.read(200)
    i = r.find(b"\x01\x03")
    if i < 0 or len(r) < i + 7:
        return None
    lo, hi = struct.unpack(">2H", r[i + 3:i + 7])
    return struct.unpack(">f", struct.pack(">HH", hi, lo))[0]


def inject(s, text, settle=0.9, tries=6):
    """Send one G-code line to register 3000, RETRYING UNTIL THE FC16 IS ACKNOWLEDGED.

    ⭐⭐ ROOT CAUSE, measured 2026-09-05: ~25% of write frames never arrive intact, and the correlation
    is perfect -- 13/13 landed writes had a valid FC16 ack, 5/5 lost writes had NO valid ack. The
    controller never received them. It is a LINK problem, not the controller dropping lines, and it is
    immune to pacing and to bus quiet time. Every ack is also preceded by 6-11 bytes of junk that is not
    ours; the controller is a Modbus MASTER by default, so its own polling frames appear to collide with
    ours. => THE ACK IS THE CHEAP TRUTH: check it and resend, rather than reading the variable back.

    Returns True if the write was acknowledged.
    """
    payload = (text + "\n").encode("ascii")
    if len(payload) > MAX_PAYLOAD:
        raise SystemExit("%d bytes exceeds the firmware's %d-byte limit" % (len(payload), MAX_PAYLOAD))
    if len(payload) % 2:
        payload += b"\x00"
    # LITTLE-ENDIAN within each register: FIRST character in the LOW byte.
    regs = [payload[i] | (payload[i + 1] << 8) for i in range(0, len(payload), 2)]
    body = (bytes([1, 0x10]) + struct.pack(">HHB", REG_INJECT, len(regs), len(regs) * 2)
            + b"".join(struct.pack(">H", r) for r in regs))
    echo = bytes([1, 0x10]) + struct.pack(">HH", REG_INJECT, len(regs))
    for _ in range(tries):
        s.reset_input_buffer()
        s.write(frame(body))
        time.sleep(0.35)
        r = s.read(256)
        i = r.find(echo)
        if i >= 0 and len(r) >= i + 8 and struct.unpack("<H", r[i + 6:i + 8])[0] == crc16(r[i:i + 6]):
            time.sleep(max(0.0, settle - 0.35))
            return True
        time.sleep(0.15)                      # frame collided -- back off and resend
    return False


class Latched(Exception):
    """The controller will not accept a line even after retries."""


def poll_for(s, reg, want, window=3.0, match=True):
    """Poll until reg equals `want` (match=True) or differs from it (match=False). Returns the value.

    ⛔ POLL, NEVER A SINGLE TIMED READ. Execution latency is ~440 ms, so a read at 0.5 s regularly beats
    the line and reports a failure that did not happen. Measured 2026-09-05: that false failure made
    set_var re-inject, and the DUPLICATE landed AFTER the next expression and overwrote its result --
    which is why `[3+3]` appeared to "sometimes fail" while `[5+5]` passed. The controller was fine
    every time; the tool was corrupting its own measurement.
    """
    t0 = time.time()
    v = None
    while time.time() - t0 < window:
        v = read_f32(s, reg)
        if v is not None:
            hit = abs(v - want) < 0.01
            if hit == match:
                return v
        time.sleep(0.05)
    return v


def set_var(s, var, value, tries=4):
    """Write a numeric value and confirm it landed, polling rather than guessing a delay."""
    reg = 6500 + 2 * (var - 500)
    value = float(value)
    for attempt in range(tries):
        inject(s, "#%d = %s" % (var, value), settle=0.0)
        v = poll_for(s, reg, value, window=3.0)
        if v is not None and abs(v - value) < 0.01:
            if attempt:
                # ⚠ A RETRY WAS NEEDED, so a duplicate of this line may still be in flight. Let it
                # drain BEFORE anything else is injected, or it will land on top of the next result.
                time.sleep(2.0)
            return True
    return False


def probe(s, expr):
    """Evaluate one expression. Raises Latched if a plain numeric write will not stick."""
    if not set_var(s, SCRATCH, SENTINEL):
        raise Latched("a plain numeric write to #%d would not stick after retries" % SCRATCH)
    # The sentinel must be STABLE before the expression goes out -- a late duplicate arriving after it
    # would restore the sentinel and be misread as "the expression did not assign".
    time.sleep(1.0)
    if abs((read_f32(s, REG_READ) or 0) - SENTINEL) > 0.01:
        raise Latched("sentinel was not stable before injecting %r" % expr)
    inject(s, "#%d = %s" % (SCRATCH, expr), settle=0.0)
    v = poll_for(s, REG_READ, SENTINEL, window=3.0, match=False)
    if v is not None and abs(v - SENTINEL) < 0.5:
        # ⭐ SOME EXACT LINES NEVER EXECUTE, DETERMINISTICALLY. `#916 = [3+3]` never assigns; `#917 =
        # [3+3]`, `#916 =[3+3]` and `#916 = [3+3] ` all do. Same expression, same semantics -- only the
        # bytes differ. The rule is UNKNOWN (a CRC-low-byte theory was tested by prediction and refuted:
        # 0xFB and 0xFF each appear in both a failure and a pass). ⇒ Retry with a TRAILING SPACE, which
        # is semantically identical and byte-different. Do this before concluding anything about the
        # expression itself, or a perfectly valid one gets recorded as rejected.
        inject(s, "#%d = %s " % (SCRATCH, expr), settle=0.0)
        v = poll_for(s, REG_READ, SENTINEL, window=3.0, match=False)
    if v is not None and abs(v - SENTINEL) < 0.5:
        # No assignment within the window. Either a harmless no-op, or it errored and latched.
        time.sleep(1.0)
        if not set_var(s, SCRATCH, 4242.0, tries=2):
            raise Latched("%r raised a syntax error and LATCHED the channel "
                          "(canary write refused afterwards)" % expr)
        return None
    return v


def main():
    args = [a for a in sys.argv[1:]]
    port = args.pop(0)
    if args and args[0] == "--file":
        exprs = [l.strip() for l in open(args[1]) if l.strip() and not l.startswith("#")]
    else:
        exprs = args
    import serial
    s = serial.Serial(port, 115200, 8, "N", 1, timeout=1.0)
    try:
        for e in exprs:
            try:
                v = probe(s, e)
            except Latched as err:
                print("\n   !! " + "=" * 66)
                print("   !! LATCHED at %r -- %s" % (e, err))
                print("   !! Everything from here on would be a STALE value, not a measurement.")
                print("   !! Press Reset AT THE PENDANT. It cannot be cleared over Modbus.")
                print("   !! " + "=" * 66)
                return 1
            print("   %-18s -> %s" % (e, "NO ASSIGNMENT (silent -- check the pendant)"
                                      if v is None else v))
        inject(s, "#%d = 0" % SCRATCH)
    finally:
        s.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
