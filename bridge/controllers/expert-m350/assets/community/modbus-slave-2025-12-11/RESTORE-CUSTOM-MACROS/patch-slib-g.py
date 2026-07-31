#!/usr/bin/env python3
"""patch-slib-g.py - re-apply CNC-FAIRY's slib-g.nc customizations after a firmware flash.

A flash installs a fresh FACTORY slib-g.nc, wiping these edits. Run this against the freshly
flashed slib-g.nc on SYSDISK to put them back. Targets are matched by CONTENT (not line numbers)
so it survives a new firmware's line shuffles, and it is idempotent (safe to run twice).

All three edits live in O502's FIXED-probe branch only - the floating and first-fixed probe
paths are left untouched.

  1. Probe A/B jog strip:  'G53X#10Y#11A#13B#14C#15' -> 'G53X#10Y#11'
     Factory jogs A/B toward 0 during the approach; with an unhomed B that crawls the XY move.
  2. Fixed-probe signal -> P2 L1:  '#26 = #1075' -> '#26 = 2'  and  '#28 = #1077' -> '#28 = 1'
     Factory #1075/#1077 config is mis-resolved on this machine, so the probe never triggers.
  3. Tool-length write (N18):  '#[1430 + [#1300-1]] = #31' -> '#[1430 + [#1300-1]] = [#31 - #2500]'
     #2500 = the setter-to-spoilboard reference, set once by CALIBRATE. Matched comment-less so it
     hits N18 (regular fixed) and NOT the commented N17 (first-fixed) line.

Usage:
    python patch-slib-g.py "\\\\192.168.0.99\\SYSDISK\\slib-g.nc"
    python patch-slib-g.py S:/slib-g.nc
Writes a one-time .prepatch backup next to the file before editing.
"""
import sys
import os
import shutil


def _code(line):
    return line.rstrip("\r\n")


def patch(path):
    lines = open(path, "rb").read().decode("latin1").splitlines(keepends=True)
    changes = []

    # 1) strip the rotary jog from the fixed-probe approach
    hits = [i for i, l in enumerate(lines) if _code(l) == "G53X#10Y#11A#13B#14C#15"]
    if hits:
        i = hits[0]
        lines[i] = "G53X#10Y#11" + lines[i][len(_code(lines[i])):]
        changes.append("strip rotary jog @ line %d" % (i + 1))
    elif any(_code(l) == "G53X#10Y#11" for l in lines):
        changes.append("strip rotary jog: already applied")
    else:
        changes.append("!! strip rotary jog: target NOT FOUND (inspect manually)")

    # 2) fixed-probe signal/level -> P2 L1 (preserve any trailing comment)
    for old, new, label in (("#26 = #1075", "#26 = 2", "signal"),
                            ("#28 = #1077", "#28 = 1", "level")):
        hits = [i for i, l in enumerate(lines) if _code(l).startswith(old)]
        if hits:
            i = hits[0]
            c = _code(lines[i])
            lines[i] = new + c[len(old):] + lines[i][len(c):]
            changes.append("P2L1 %s @ line %d" % (label, i + 1))
        elif any(_code(l).startswith(new + " ") or _code(l) == new for l in lines):
            changes.append("P2L1 %s: already applied" % label)
        else:
            changes.append("!! P2L1 %s: target '%s' NOT FOUND" % (label, old))

    # 3) N18 tool-length write -> subtract #2500 (comment-less line only = N18, not N17)
    hits = [i for i, l in enumerate(lines) if _code(l) == "#[1430 + [#1300-1]] = #31"]
    if hits:
        i = hits[0]
        lines[i] = "#[1430 + [#1300-1]] = [#31 - #2500]" + lines[i][len(_code(lines[i])):]
        changes.append("#2500 reference @ line %d" % (i + 1))
    elif any(_code(l) == "#[1430 + [#1300-1]] = [#31 - #2500]" for l in lines):
        changes.append("#2500 reference: already applied")
    else:
        changes.append("!! #2500 reference: target NOT FOUND")

    return "".join(lines).encode("latin1"), changes


def main():
    if len(sys.argv) != 2:
        print("usage: python patch-slib-g.py <path-to-slib-g.nc>")
        sys.exit(2)
    path = sys.argv[1]
    if not os.path.isfile(path):
        print("not found: %s" % path)
        sys.exit(1)
    out, changes = patch(path)
    bak = path + ".prepatch"
    if not os.path.exists(bak):
        shutil.copyfile(path, bak)
        print("backup -> %s" % bak)
    open(path, "wb").write(out)
    print("applied:")
    for c in changes:
        print("  " + c)
    if any(c.startswith("!!") for c in changes):
        print("WARNING: one or more targets not found - inspect slib-g.nc by hand.")
        sys.exit(3)
    print("done. reboot the controller to load the patched slib-g.nc.")


if __name__ == "__main__":
    main()
