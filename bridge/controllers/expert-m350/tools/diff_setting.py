#!/usr/bin/env python3
r"""diff_setting.py — PHASE-2 differential param mapper for the DDCS Expert `setting` file.

The `setting` file is 1000x little-endian f64 where array index == DDCS param #
(see ../FINDINGS.md / ../PROFILE_BUILD_TASK.md). To learn which index a panel param maps to,
you change ONE param on the panel and see which index moved:

    1) python diff_setting.py snap                 # save a baseline of the LIVE setting
    2) <operator changes ONE param on the panel, then Save>          (human, at the machine)
    3) python diff_setting.py diff                 # diff live vs the latest baseline -> moved index

READ-ONLY over SMB: it only reads `\\192.168.0.99\SYSDISK\setting`; the human makes panel changes.
Baselines are written locally under tools/.phase2/ (gitignored) so they don't clutter the capture tree.

`snap` re-reads and stores the current live file. `diff` reports every index whose f64 value changed
(index, old, new, delta) — usually exactly one when a single param was toggled. Pass an explicit
baseline path as the 2nd arg to diff against a specific snapshot (e.g. a committed capture's setting).
"""
import os
import struct
import sys
from datetime import datetime, timezone

LIVE = r"\\192.168.0.99\SYSDISK\setting"
SNAP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".phase2")


def _read_params(path):
    with open(path, "rb") as f:
        raw = f.read()
    if len(raw) % 8:
        raise SystemExit(f"! {path}: {len(raw)} B is not a whole number of f64s")
    return struct.unpack("<%dd" % (len(raw) // 8), raw), raw


def _latest_snap():
    if not os.path.isdir(SNAP_DIR):
        return None
    snaps = sorted(f for f in os.listdir(SNAP_DIR) if f.startswith("setting.") and f.endswith(".bin"))
    return os.path.join(SNAP_DIR, snaps[-1]) if snaps else None


def cmd_snap(stamp):
    os.makedirs(SNAP_DIR, exist_ok=True)
    _params, raw = _read_params(LIVE)
    dest = os.path.join(SNAP_DIR, f"setting.{stamp}.bin")
    with open(dest, "wb") as f:
        f.write(raw)
    print(f"snapshot -> {dest}  ({len(raw)} B, {len(raw)//8} params)")
    print("Now change ONE param on the panel + Save, then: python diff_setting.py diff")


def cmd_diff(baseline):
    baseline = baseline or _latest_snap()
    if not baseline:
        raise SystemExit("! no baseline — run `python diff_setting.py snap` first (or pass a path).")
    if not os.path.exists(baseline):
        raise SystemExit(f"! baseline not found: {baseline}")
    old, _ = _read_params(baseline)
    new, _ = _read_params(LIVE)
    print(f"baseline: {baseline}")
    print(f"live:     {LIVE}")
    if len(old) != len(new):
        print(f"! length differs: baseline {len(old)} vs live {len(new)} params")
    n = min(len(old), len(new))
    moved = [(i, old[i], new[i]) for i in range(n) if old[i] != new[i]]
    if not moved:
        print("no differences — did the operator Save the param change on the panel?")
        return
    print(f"\n{len(moved)} index(es) changed:")
    print(f"  {'param#':>6}  {'old':>16}  {'new':>16}  delta")
    for i, o, nv in moved:
        print(f"  #{i:<5} {o:16.6g}  {nv:16.6g}  {nv - o:+g}")


def main():
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") if False else None
    # Date.now-free stamp: derive from the live file's mtime so reruns are deterministic per change.
    try:
        mt = os.path.getmtime(LIVE)
        stamp = datetime.fromtimestamp(mt, timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    except OSError:
        stamp = "live"
    cmd = sys.argv[1] if len(sys.argv) > 1 else "diff"
    if cmd == "snap":
        cmd_snap(stamp)
    elif cmd == "diff":
        cmd_diff(sys.argv[2] if len(sys.argv) > 2 else None)
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
