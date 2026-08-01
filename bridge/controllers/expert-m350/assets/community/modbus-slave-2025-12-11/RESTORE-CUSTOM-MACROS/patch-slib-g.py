#!/usr/bin/env python3
"""patch-slib-g.py - re-apply CNC-FAIRY's fixed-tool-setter fixes to slib-g.nc after a firmware flash.

A flash installs a fresh FACTORY slib-g.nc, wiping these edits. Run this against the freshly flashed
slib-g.nc on SYSDISK. Content-matched (survives a new firmware's line shifts) and idempotent.

All edits are in O502's FIXED-probe path; floating and first-fixed paths are left alone. The fixed
signal lines stay FACTORY (`#26=#1075`, `#28=#1077`) - the port/level come from config vars
`#1075`/`#1077` (set by SETPROBE.nc / sysstart), NOT hardcoded here (a `#28=1` literal tripped a
DDCS parser syntax error).

  1. Strip rotary from the approach XY move:  G53X#10Y#11A#13B#14C#15 -> G53X#10Y#11
     Keeps A/B/C out of the coordinated move so it does not crawl when B is unhomed.
  2. DELETE the rapid descent line  G53Z#637  entirely.
     *** THIS WAS THE REAL BUG. *** The rapid dropped the tool THROUGH the setter before any G31 ran,
     and a rapid ignores the probe input - so it never stopped. Removing it lets the G31 probe the
     whole descent from the safe Z (#641) and stop on touch, exactly like the standalone CALIBRATE.
  3. Tool-length write (N18):  #[1430 + [#1300-1]] = #31  ->  = [#31 - #2500]
     #2500 = the setter->spoilboard reference (set once by CALIBRATE). Matched comment-less so it hits
     N18 (regular fixed) and NOT the commented N17 (first-fixed).
  4. Re-probe base:  O502's loop line  #20=#500  ->  #20=160
     Factory re-probes from #500 (10 mm/min) halving down = a painful crawl. 160 makes the single
     re-probe (with #631=2) land ~80 mm/min, matching CALIBRATE. Only the O502 copy (the one with a
     trailing comment) is changed; the O501/O503 homing copies are left alone.

Usage:
    python patch-slib-g.py "\\\\192.168.0.99\\SYSDISK\\slib-g.nc"
    python patch-slib-g.py S:/slib-g.nc
Writes a one-time .prepatch backup before editing.
"""
import sys
import os
import shutil


def _code(line):
    return line.rstrip("\r\n").split(";")[0].split("//")[0].rstrip()


def patch(path):
    lines = open(path, "rb").read().decode("latin1").splitlines(keepends=True)
    changes = []

    # 1) strip rotary from the fixed-probe approach XY move
    hits = [i for i, l in enumerate(lines) if _code(l) == "G53X#10Y#11A#13B#14C#15"]
    if hits:
        i = hits[0]
        nl = lines[i][len(lines[i].rstrip("\r\n")):]
        lines[i] = "G53X#10Y#11" + nl
        changes.append("strip rotary jog @ line %d" % (i + 1))
    elif any(_code(l) == "G53X#10Y#11" for l in lines):
        changes.append("strip rotary jog: already applied")
    else:
        changes.append("!! strip rotary jog: target NOT FOUND")

    # 2) DELETE the rapid descent line
    hits = [i for i, l in enumerate(lines) if _code(l) == "G53Z#637"]
    if hits:
        i = hits[0]
        del lines[i]
        changes.append("deleted rapid descent (was line %d)" % (i + 1))
    else:
        changes.append("rapid descent: already removed")

    # 3) N18 tool-length write -> subtract #2500 (comment-less line only = N18, not N17)
    hits = [i for i, l in enumerate(lines) if _code(l) == "#[1430 + [#1300-1]] = #31"
            and ";" not in l and "//" not in l]
    if hits:
        i = hits[0]
        nl = lines[i][len(lines[i].rstrip("\r\n")):]
        lines[i] = "#[1430 + [#1300-1]] = [#31 - #2500]" + nl
        changes.append("#2500 reference @ line %d" % (i + 1))
    elif any(_code(l) == "#[1430 + [#1300-1]] = [#31 - #2500]" for l in lines):
        changes.append("#2500 reference: already applied")
    else:
        changes.append("!! #2500 reference: target NOT FOUND")

    # 4) O502 re-probe base #20=#500 -> #20=160 (the O502 copy carries a trailing ; comment;
    #    the O501/O503 homing copies do not - leave those alone)
    hits = [i for i, l in enumerate(lines)
            if _code(l) == "#20=#500" and (";" in l or "//" in l)]
    if hits:
        i = hits[0]
        core = lines[i].rstrip("\r\n")
        nl = lines[i][len(core):]
        lines[i] = "#20=160" + core[len("#20=#500"):] + nl  # keep the ; comment
        changes.append("re-probe base 160 @ line %d" % (i + 1))
    elif any(_code(l) == "#20=160" for l in lines):
        changes.append("re-probe base: already applied")
    else:
        changes.append("!! re-probe base: target NOT FOUND")

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
        print("WARNING: a target was not found - inspect slib-g.nc by hand.")
        sys.exit(3)
    print("done. reboot to load, then run SETPROBE.nc (port/level/feed/2-touches).")


if __name__ == "__main__":
    main()
