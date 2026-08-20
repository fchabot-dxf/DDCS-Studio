"""
Ops.detect_controller() must not cache IGNORANCE as knowledge (t2107).

THE DEFECT: detect_controller()'s cache is keyed on `dest` alone and invalidated only when `dest` CHANGES.
_fingerprint_sysdisk() returns family "unknown" the instant SYSDISK is not even a directory -- exactly the
state while the mill is off. So: gateway starts while the mill is off -> caches "unknown" -> mill comes on
-> cache hit on an unchanged dest -> returns "unknown" for the LIFE OF THE PROCESS. This is the human's own
normal setup (PC always on, only the CNC cycles). controller_family/controller_firmware/controller_profile_id
all stay null forever, so the Drive mismatch block never fires and ops.profile() serves the wrong baseline,
with no error anywhere.

Run standalone:  python bridge/bridge-app/tests/test_detect_controller_cache_2107.py
"""
import os
import shutil
import sys
import tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))
from fairy.backend.local_folder import LocalFolderBackend    # noqa: E402
from fairy.config import Config                                # noqa: E402
from fairy.ops import Ops                                      # noqa: E402


def test_an_unreachable_probe_is_NOT_cached_a_later_probe_sees_the_real_controller():
    """⭐ THE core property, driven exactly as the advisor's own instruction: probe unreachable (watch it
    return unknown), THEN make the disk exist with a real, fingerprintable SYSDISK, probe again, assert the
    family is now correct — not stuck at the first probe's ignorance."""
    tmp = tempfile.mkdtemp()
    try:
        cncdisk = os.path.join(tmp, "CNCDISK")
        sysdisk = os.path.join(tmp, "SYSDISK")   # _sysdisk_for swaps the trailing share name
        backend = LocalFolderBackend(tmp)
        cfg = Config(local_root=tmp, expert_dest=cncdisk)
        ops = Ops(backend, cfg)

        # FIRST probe: SYSDISK does not exist at all (the mill is off) — must read "unknown"
        r1 = ops.detect_controller()
        assert r1["family"] == "unknown", r1

        # the mill comes on: SYSDISK now exists and carries a real, unambiguous firmware file
        os.makedirs(sysdisk)
        with open(os.path.join(sysdisk, "ddcsv4.out"), "wb") as f:
            f.write(b"stand-in firmware bytes")

        # SECOND probe, dest UNCHANGED: this is exactly the case that used to return the FIRST probe's
        # stale "unknown" forever, because the cache only invalidates on a dest CHANGE.
        r2 = ops.detect_controller()
        assert r2["family"] == "v4.1", \
            f"detect_controller must re-probe once the disk becomes reachable, not trust the stale cache: {r2}"
        assert r2["firmware"] == "ddcsv4.out", r2
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_a_genuinely_ambiguous_but_REACHABLE_answer_still_gets_cached():
    """⛔ The fix must not become 'never cache' — that would re-introduce the exact quota/heaviness problem
    caching exists for (a fingerprint lists SYSDISK and may string-scan a firmware binary). A REACHABLE disk
    whose firmware is genuinely unrecognisable is a real, stable answer and must still be cached: prove it by
    deleting the disk AFTER the first probe and confirming the SECOND probe still returns the cached (not
    re-probed, now-unreachable-would-say-"unknown"-too-so-use-a-distinguishing-signal) result."""
    tmp = tempfile.mkdtemp()
    try:
        cncdisk = os.path.join(tmp, "CNCDISK")
        sysdisk = os.path.join(tmp, "SYSDISK")
        os.makedirs(sysdisk)
        with open(os.path.join(sysdisk, "unrecognisable.out"), "wb") as f:
            f.write(b"nothing in here matches any known signature")
        backend = LocalFolderBackend(tmp)
        cfg = Config(local_root=tmp, expert_dest=cncdisk)
        ops = Ops(backend, cfg)

        r1 = ops.detect_controller()
        assert r1["family"] == "unknown" and r1["firmware"] == "unrecognisable.out", r1

        # a distinguishing signal: after caching, remove the firmware file itself (leaving the dir) so a
        # RE-PROBE would report firmware=None, but the CACHED value still names "unrecognisable.out"
        os.remove(os.path.join(sysdisk, "unrecognisable.out"))
        r2 = ops.detect_controller()
        assert r2["firmware"] == "unrecognisable.out", \
            f"a genuinely-reachable ambiguous answer must be cached, not re-probed on every call: {r2}"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items()
                           if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- detect_controller() no longer caches an unreachable-disk 'unknown' for the life of the "
          "process, but still caches a genuinely reachable-but-ambiguous answer, exactly as it should.")
