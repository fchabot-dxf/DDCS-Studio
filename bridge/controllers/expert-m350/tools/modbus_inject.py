#!/usr/bin/env python3
"""modbus_inject.py — send one G-code line to a DDCS Expert over Modbus RTU register 3000.

The 2026-08-03-00 firmware added "Modbus RTU real-time G-code injection", buffered at register 3000,
ASCII, up to 246 bytes per payload. This is the FIRST capability in this project that can make the PC
command the machine, so the guard below is the point of the file, not decoration.

⛔ MOTION IS REFUSED IN CODE. A payload carrying a motion word, a G/M code, an axis letter or a feed/
spindle word is rejected before the port is opened. Removing that guard is a deliberate act, and it
must not be done to "just try something" — the project's standing rule is that delivery is automatic
and RUNNING is operator-pressed.

Usage:  python modbus_inject.py COM6 "#1505=-5000(MODBUS OK)"
"""
import re
import struct
import sys
import time

REG = 3000
MAX_PAYLOAD = 246

# Anything that could move an axis, start a spindle, or run a program. Deliberately over-broad:
# a false refusal costs a message, a false accept costs a machine.
FORBIDDEN = re.compile(
    r"(?<![A-Za-z0-9#\[])("
    r"G\d|M\d|"                  # any G or M code at all
    r"[XYZABCUVW]\s*[-+.\d#\[]|" # an axis letter followed by a value or expression
    r"[FS]\s*[-+.\d#\[]|"        # feed or spindle
    r"T\d"                       # tool change
    r")", re.IGNORECASE)


# ⛔ PROTECTED PARAMETER BLOCKS — macro-address ranges a write must never touch.
# "No motion" is NOT "safe": `#807 = 0` rewrites G54 Z, the spoilboard, with no motion word anywhere.
# Found 2026-08-26 by testing the motion guard against destructive-but-motion-free payloads; it let
# every one of them through. Ranges are MACRO addresses (setting index + 500).
PROTECTED = [
    (800, 844,  "the WCS table -- G54..G59. G54 Z0 IS THE SPOILBOARD AND IS SACRED"),
    (1390, 1449, "the tool table (X/Y/Z offsets) -- probe-written tool lengths"),
    (655, 670,  "the software limits"),
    (622, 626,  "home / machine-zero positions"),
    (735, 739,  "machine zero offsets"),
    (575, 577,  "probe input port and level"),
]


# ⛔ #2037 IS THE VIRTUAL PANEL BUTTON. Writing it presses a real key: Start 65864, Reset 65863,
# Pause 65865, plus feed/spindle overrides. It carries no G-code, no axis word and no protected
# parameter, so the other two checks call it INERT — found 2026-08-26 by dry-running a Start press
# through this very file. ⇒ A payload that can start the machine must never be reported as harmless.
BUTTONS = {65864: "START -- runs the loaded program", 65863: "RESET", 65865: "PAUSE",
           328: "start released", 1364: "feed override", 1367: "spindle override"}


def classify(text):
    """Return a list of warnings describing what this payload could do. Empty list = inert.

    ⭐ THIS ANNOUNCES, IT DOES NOT REFUSE. Owner-ruled 2026-08-26: *"i dont mind you controlling the
    machine, its just a machine"*, and then *"you can guard by using a warning that youll be using
    motion or variable that affect motion."* ⇒ The job of this function is that **nothing moves
    unannounced** — not that nothing moves.

    ⚠ It cannot tell WHERE THE OWNER IS. Presence is not inferable from which seat is talking
    (context/SEATS.md). Ask before sending anything this flags.
    """
    warns = []
    btn = re.search(r"#\s*2037\s*=\s*(-?\d+)", text)
    if btn:
        code = int(btn.group(1))
        warns.append("VIRTUAL BUTTON PRESS: #2037 = %d -- %s"
                     % (code, BUTTONS.get(code, "unknown code, effect UNKNOWN")))
        warns.append("this presses a PANEL KEY. If a program is loaded, START runs it.")
    hit = FORBIDDEN.search(text)
    if hit:
        warns.append("MOTION: contains %r -- this can MOVE THE MACHINE or start the spindle"
                     % hit.group(0))
    if re.search(r"#\s*\[", text):
        warns.append("COMPUTED ADDRESS '#[...]' -- the write target cannot be checked before sending")
    for m in re.finditer(r"#\s*(\d+)\s*=", text):
        n = int(m.group(1))
        for lo, hi, why in PROTECTED:
            if lo <= n <= hi:
                warns.append("WRITES #%d (%d-%d) -- %s" % (n, lo, hi, why))
    return warns


def announce(text):
    """Print what the payload will do. Returns True if it is inert."""
    warns = classify(text)
    if not warns:
        print("   inert: no motion word, no protected write")
        return True
    print("   !! " + "=" * 66)
    for w in warns:
        print("   !! " + w)
    print("   !! the owner should be AT the machine before this is sent")
    print("   !! " + "=" * 66)
    return False




def crc16(b):
    c = 0xFFFF
    for x in b:
        c ^= x
        for _ in range(8):
            c = (c >> 1) ^ 0xA001 if c & 1 else c >> 1
    return c


def frame(body):
    return body + struct.pack("<H", crc16(body))


def main():
    args = sys.argv[1:]
    dry = "--dry-run" in args
    args = [a for a in args if not a.startswith("--")]
    port, text = args[0], args[1]
    print("payload: %r" % text)
    announce(text)
    if dry:
        print("\n   --dry-run: nothing sent")
        return
    print()
    payload = (text + "\n").encode("ascii")
    if len(payload) > MAX_PAYLOAD:
        raise SystemExit(f"⛔ {len(payload)} bytes exceeds the firmware's {MAX_PAYLOAD}-byte limit")
    if len(payload) % 2:
        payload += b"\x00"
    # LITTLE-ENDIAN within each register: FIRST character in the LOW byte.
    # Proven 2026-08-26: packing big-endian delivered every byte pair reversed and the controller
    # answered "syntax error!:L1[1#05=55-00(OOMBDSUO )K]" -- the payload, swapped. Same convention as
    # the word-swapped float32s elsewhere on this controller; it is little-endian throughout.
    regs = [payload[i] | (payload[i + 1] << 8) for i in range(0, len(payload), 2)]

    import serial
    s = serial.Serial(port, 115200, 8, "N", 1, timeout=1.0)
    print(f"payload {len(payload)} B -> {len(regs)} registers @ {REG}\n   {text!r}\n")

    w = frame(bytes([1, 0x10]) + struct.pack(">HHB", REG, len(regs), len(regs) * 2)
              + b"".join(struct.pack(">H", r) for r in regs))
    s.reset_input_buffer(); s.write(w); time.sleep(0.4)
    r = s.read(256)
    print(f"   write  sent {w.hex()}")
    print(f"          recv {r.hex() if r else '(nothing)'}")
    i = r.find(b"\x01") if r else -1
    if i >= 0 and len(r) > i + 1:
        fn = r[i + 1]
        if fn & 0x80:
            print(f"          ⛔ exception code {r[i+2] if len(r) > i+2 else '?'}")
        elif fn == 0x10:
            print("          FC16 acknowledged (OK)")

    time.sleep(1.0)
    rr = frame(bytes([1, 3]) + struct.pack(">HH", REG, min(len(regs), 12)))
    s.reset_input_buffer(); s.write(rr); time.sleep(0.4)
    r2 = s.read(256)
    print(f"\n   readback recv {r2.hex() if r2 else '(nothing)'}")
    j = r2.find(b"\x01\x03") if r2 else -1
    if j >= 0:
        n = r2[j + 2]
        p = r2[j + 3:j + 3 + n]
        print(f"            as ASCII: {p.decode('latin-1')!r}")
    s.close()


if __name__ == "__main__":
    main()
