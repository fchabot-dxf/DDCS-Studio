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


def inject(s, text, settle=0.9):
    payload = (text + "\n").encode("ascii")
    if len(payload) > 246:
        raise SystemExit("%d bytes exceeds the firmware's 246-byte limit" % len(payload))
    if len(payload) % 2:
        payload += b"\x00"
    # LITTLE-ENDIAN within each register: FIRST character in the LOW byte.
    regs = [payload[i] | (payload[i + 1] << 8) for i in range(0, len(payload), 2)]
    s.reset_input_buffer()
    s.write(frame(bytes([1, 0x10]) + struct.pack(">HHB", REG_INJECT, len(regs), len(regs) * 2)
                  + b"".join(struct.pack(">H", r) for r in regs)))
    time.sleep(settle)
    s.read(256)


class Latched(Exception):
    """The controller will not accept a line even after retries."""


def set_var(s, var, value, tries=4):
    """Write a NUMERIC value and CONFIRM it landed, retrying. Returns True if confirmed.

    ⭐ SINGLE INJECTIONS ARE DROPPED INTERMITTENTLY. Measured 2026-09-05: nine numeric writes in a row,
    the 1st and the 9th silently vanished, the middle seven landed, with the pendant green and READY
    throughout. There is no error and no NAK -- the FC16 write is ACKed and the line is simply gone.
    ⇒ Never trust an un-verified injection. This is the single most expensive fact learned that night:
    every wrong finding traced back to reading a stale value left by a dropped line.
    """
    reg = 6500 + 2 * (var - 500)
    for _ in range(tries):
        inject(s, "#%d = %s" % (var, value))
        time.sleep(0.5)
        v = read_f32(s, reg)
        if v is not None and abs(v - float(value)) < 0.01:
            return True
    return False


def probe(s, expr):
    """Evaluate one expression. Raises Latched if a plain numeric write will not stick.

    The sentinel is written AND CONFIRMED, with retries. Only then is the expression injected, so a
    surviving sentinel afterwards means the EXPRESSION did not assign -- not that the channel is down.
    """
    if not set_var(s, SCRATCH, SENTINEL):
        raise Latched("a plain numeric write to #%d would not stick after retries" % SCRATCH)
    inject(s, "#%d = %s" % (SCRATCH, expr))
    # ⛔ 1.8s, NOT 0.9. THE LATCH IS NOT INSTANTANEOUS. Measured 2026-09-05: `[2 ** 3]` raised a syntax
    # error, but a canary fired ~0.5s later SLIPPED THROUGH and reported the channel healthy, so the
    # expression was recorded as a harmless no-op. It is a syntax error -- photographed. A canary that
    # checks too early gives a FALSE ALL-CLEAR, which is worse than no canary at all.
    time.sleep(1.8)
    v = read_f32(s, REG_READ)
    if v is not None and abs(v - SENTINEL) < 0.5:
        # The sentinel survived, so the expression did not assign. TWO very different causes:
        #   (a) a harmless no-op, and the channel is still fine, or
        #   (b) IT RAISED A SYNTAX ERROR AND LATCHED, so every later line is silently dropped.
        # ⛔ Telling them apart is not optional. Measured 2026-09-05: `[7 MOD 3]` errored and latched,
        # and the batch cheerfully reported "no assignment" for the NEXT expression too -- which had
        # never executed at all. A canary write settles it.
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
