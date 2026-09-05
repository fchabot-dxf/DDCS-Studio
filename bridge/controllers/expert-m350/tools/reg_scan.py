#!/usr/bin/env python3
"""reg_scan.py — sweep the Expert's Modbus register space. Reads only; writes nothing.

Two modes:
  --ascii              decode every block as ASCII and print printable runs (find text buffers)
  --dump <file>        save the whole sweep as "reg value" lines, for diffing two states

⭐ Built to answer: CAN THE PC SEE THE CONTROLLER'S ERROR STATE? The owner's point, 2026-09-05:
*"problem is you cant see if an error is blocking."* Every wrong finding that night came from reading a
stale value as a measurement, which only happens because the error is invisible from here.

Registers are word-swapped/little-endian on this controller (see FINDINGS), so the ASCII decode swaps
byte order within each register — the same convention register 3000 uses for G-code injection.

Usage:
    python reg_scan.py COM6 --ascii 0 20000
    python reg_scan.py COM6 --dump before.txt 6500 10600
"""
import struct
import sys
import time
import re

CHUNK = 100


def crc16(b):
    c = 0xFFFF
    for x in b:
        c ^= x
        for _ in range(8):
            c = (c >> 1) ^ 0xA001 if c & 1 else c >> 1
    return c


def read_block(s, start, n):
    body = bytes([1, 3]) + struct.pack(">HH", start, n)
    s.reset_input_buffer()
    s.write(body + struct.pack("<H", crc16(body)))
    time.sleep(0.06)
    r = s.read(3 + 2 * n + 2)
    i = r.find(b"\x01\x03")
    if i < 0 or len(r) < i + 3 + 2 * n:
        return None
    return r[i + 3:i + 3 + 2 * n]


def main():
    import serial
    a = sys.argv[1:]
    port = a[0]
    mode = a[1]
    out = a[2] if mode == "--dump" else None
    rest = a[3:] if mode == "--dump" else a[2:]
    lo, hi = int(rest[0]), int(rest[1])

    def open_port():
        return serial.Serial(port, 115200, 8, "N", 1, timeout=0.2)

    s = open_port()
    dump = open(out, "w") if out else None
    live = dead = 0
    try:
        for addr in range(lo, hi, CHUNK):
            b = None
            for attempt in range(2):
                try:
                    b = read_block(s, addr, CHUNK)
                    break
                except Exception as e:                      # FTDI drops the handle occasionally
                    print("   (port error at %d: %s -- reopening)" % (addr, e), flush=True)
                    try:
                        s.close()
                    except Exception:
                        pass
                    time.sleep(0.5)
                    s = open_port()
            if not b:
                dead += 1
                continue
            live += 1
            if dump:
                words = struct.unpack(">%dH" % CHUNK, b)
                for k, v in enumerate(words):
                    dump.write("%d %d\n" % (addr + k, v))
            else:
                txt = bytes(b[i ^ 1] for i in range(len(b)))  # swap within each register
                for m in re.finditer(rb"[\x20-\x7e]{6,}", txt):
                    print("   reg %-6d %r" % (addr + m.start() // 2,
                                              m.group().decode("latin-1")), flush=True)
        print("\n   blocks answered: %d   silent: %d" % (live, dead), flush=True)
    finally:
        if dump:
            dump.close()
        s.close()


if __name__ == "__main__":
    main()
