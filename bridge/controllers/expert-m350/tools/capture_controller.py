#!/usr/bin/env python3
"""capture_controller.py — READ-ONLY snapshot of a DDCS controller's reachable files (over SMB).

PHASE-1 (unattended) tool. Power the controller on, run this once, walk away. It mirrors everything
under the given SMB source root(s) into a local, timestamped folder with a manifest (size + sha256).
It **only reads** the controller — it never writes to the share — so it is safe to leave running.

Why: we have rich V4.1 dumps but ZERO raw Expert data (only PDFs). Landing the real Expert `setting`,
`uservar`, CNCDISK, and firmware here lets the controller-profile param map (see ../PROFILE_BUILD_TASK.md)
be built OFF-SITE, with no machine needed.

Usage (Windows, on the fairy machine, Expert powered on):
    # 1) list the controller's shares:
    net view \\\\192.168.0.99
    # 2) capture each share you find (repeat --src), landing it in assets/ for commit:
    python capture_controller.py --src "\\\\192.168.0.99\\CNCDISK" --out ../assets/capture

Then commit the captured `setting` / `uservar` (and note the share/paths in ../FINDINGS.md).
"""
import argparse
import hashlib
import json
import os
import shutil
import sys
from datetime import datetime, timezone


def _sha256(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(chunk), b""):
            h.update(b)
    return h.hexdigest()


def capture_root(src, out_root, manifest, errors):
    """Mirror one source root (read-only) into out_root/<label>/… ; record each file in the manifest."""
    src = os.path.normpath(src)
    label = os.path.basename(src.rstrip("\\/")) or "root"
    for dirpath, _dirs, files in os.walk(src):
        rel_dir = os.path.relpath(dirpath, src)
        for name in files:
            srcf = os.path.join(dirpath, name)
            rel = os.path.normpath(os.path.join(label, rel_dir, name))
            destf = os.path.join(out_root, rel)
            try:
                os.makedirs(os.path.dirname(destf), exist_ok=True)
                shutil.copy2(srcf, destf)          # reads src, writes the LOCAL copy only (never the share)
                size = os.path.getsize(destf)
                manifest.append({"path": rel.replace("\\", "/"), "size": size, "sha256": _sha256(destf)})
                print(f"  + {rel}  ({size} B)")
            except OSError as e:
                errors.append({"path": srcf, "error": str(e)})
                print(f"  ! skip {srcf}: {e}", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser(description="READ-ONLY snapshot of a DDCS controller's SMB files.")
    ap.add_argument("--src", action="append", required=True, help="source SMB root, e.g. \\\\192.168.0.99\\CNCDISK (repeatable)")
    ap.add_argument("--out", default="capture", help="output folder (local; a UTC-stamped subfolder is created)")
    args = ap.parse_args()

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_root = os.path.join(args.out, stamp)
    os.makedirs(out_root, exist_ok=True)

    manifest, errors = [], []
    for src in args.src:
        if not os.path.exists(src):
            errors.append({"path": src, "error": "source not reachable"})
            print(f"! source not reachable: {src}", file=sys.stderr)
            continue
        print(f"== capturing {src} ==")
        capture_root(src, out_root, manifest, errors)

    summary = {
        "captured_utc": stamp,
        "sources": args.src,
        "file_count": len(manifest),
        "total_bytes": sum(m["size"] for m in manifest),
        "errors": errors,
        "files": manifest,
    }
    with open(os.path.join(out_root, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    with open(os.path.join(out_root, "manifest.txt"), "w", encoding="utf-8") as f:
        for m in manifest:
            f.write(f"{m['size']:>12}  {m['sha256'][:16]}  {m['path']}\n")
        if errors:
            f.write("\n# unreadable:\n")
            for e in errors:
                f.write(f"#   {e['path']}: {e['error']}\n")

    print(f"\nDone: {len(manifest)} files, {summary['total_bytes']} B -> {out_root}")
    if errors:
        print(f"{len(errors)} source(s)/file(s) unreadable (see manifest).", file=sys.stderr)


if __name__ == "__main__":
    main()
