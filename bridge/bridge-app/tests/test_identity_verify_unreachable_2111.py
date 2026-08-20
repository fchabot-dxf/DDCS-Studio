"""
AN OFFLINE CONTROLLER MUST NEVER REPORT A "WRONG MACHINE" MESSAGE (t2111).

THE DEFECT THIS CLOSES: identity.read() swallows OSError and returns None on absent, corrupt, AND
unreachable alike -- it cannot tell them apart. verify() then turned that single None into "no identity
file on the controller (run provision)" no matter which of the three it actually was. Today that's inert
because machine_id is unset everywhere, but the moment it's configured (it's on the bench checklist), a
controller that is simply POWERED OFF starts reporting a message that reads as "this is the wrong
controller" -- the most misleading shape in the whole set, because ignorance (we could not check) gets
presented exactly like a KNOWN fact (we checked, and it disagrees).

THE FIX: verify() now probes controller_disk_reachable() (transfer.py's one shared source for this
question) BEFORE ever calling read(). Unreachable => ok=True, "unverified (controller unreachable)" --
skipped, same as the existing no-machine_id-configured case, never refused. "Refuse on a KNOWN mismatch,
never on ignorance." A genuinely reachable-but-unprovisioned controller (the disk answers, no identity
file on it) keeps its original, ACCURATE "no identity file (run provision)" message unchanged.

Run standalone:  python bridge/bridge-app/tests/test_identity_verify_unreachable_2111.py
"""
import os
import shutil
import sys
import tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))
from fairy import identity   # noqa: E402

FILENAME = ".bridge-machine.json"


def test_unreachable_controller_is_unverified_not_refused():
    """⭐ THE core property: a disk path that doesn't exist at all (mill switched off / share vanished) must
    read as ignorance (ok=True, skipped), never as a known mismatch."""
    tmp = tempfile.mkdtemp()
    gone = os.path.join(tmp, "does_not_exist")
    try:
        ok, reason = identity.verify(gone, FILENAME, "expected-machine-id")
        assert ok is True, (ok, reason)
        assert "unreachable" in reason.lower(), reason
        assert "wrong" not in reason.lower() and "mismatch" not in reason.lower(), \
            f"an unreachable controller must never produce mismatch-shaped wording: {reason!r}"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_reachable_but_unprovisioned_controller_still_refuses_accurately():
    """The genuinely-relevant case must be unchanged: the disk IS there, but no identity file was ever
    written -- this is a real, actionable 'run provision' situation, not ignorance, and must still refuse."""
    tmp = tempfile.mkdtemp()
    try:
        ok, reason = identity.verify(tmp, FILENAME, "expected-machine-id")
        assert ok is False, (ok, reason)
        assert "run provision" in reason, reason
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_reachable_and_mismatched_still_refuses_with_the_known_mismatch_message():
    """A genuinely wrong controller (disk reachable, file present, id disagrees) is the one case that SHOULD
    refuse with the mismatch wording -- must not be collapsed into the new unreachable branch."""
    tmp = tempfile.mkdtemp()
    try:
        identity.provision(tmp, FILENAME, "some-other-machine", "Some Other Mill")
        ok, reason = identity.verify(tmp, FILENAME, "expected-machine-id")
        assert ok is False, (ok, reason)
        assert "mismatch" in reason, reason
        assert "some-other-machine" in reason, reason
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_reachable_and_matching_still_verifies_ok():
    """The happy path must be unaffected by the new reachability check."""
    tmp = tempfile.mkdtemp()
    try:
        identity.provision(tmp, FILENAME, "expected-machine-id", "This Mill")
        ok, reason = identity.verify(tmp, FILENAME, "expected-machine-id")
        assert (ok, reason) == (True, "ok")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_no_machine_id_configured_is_still_unverified_regardless_of_reachability():
    """Pre-existing behaviour, must survive unchanged: with no expected_id, verification is skipped even
    against an unreachable disk -- the blank-config check must short-circuit before the new reachability
    probe, not race it."""
    ok, reason = identity.verify(os.path.join(tempfile.gettempdir(), "definitely-does-not-exist-2111"), FILENAME, "")
    assert (ok, reason) == (True, "unverified (no machine_id configured)")


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items()
                           if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- an unreachable controller is honestly unverified, never mismatch-shaped; a reachable "
          "but unprovisioned or genuinely mismatched controller still refuses exactly as before.")
