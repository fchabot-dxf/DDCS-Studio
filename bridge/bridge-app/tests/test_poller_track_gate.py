"""
JOB HISTORY: THE "DELIVERING" WINDOW IS OBSERVABLE, AND REPEAT SENDS LINK BY CONTENT (t2020/t2066).

Unit-tested directly against the real Poller/Ops classes (a real LocalFolderBackend on a temp dir, a stub
transfer -- no real hardware):

1. The take-over prompt must be able to tell an ACTIVE write from a stale finished job -- the poller marks
   "delivering" right before the synchronous deliver() and overwrites it after; a reader mid-write must see
   "delivering", not a state that looks identical to a job finished minutes ago.
2. Two `submit_job` calls carrying the SAME `content_hash` produce two DIFFERENT jobIds (job identity stays a
   fresh timestamp per send, on purpose) but their finished history records share the SAME `content_hash` — the
   field a UI can join on to answer "last time this ran: N min". A DIFFERENT hash stays distinct.

t2649 (BACKLOG #78) — was ALSO the tracked/deliver-only-under-no-Modbus distinction (three tests: a tracked
job with the Modbus slave off resolving to "delivered" instead of a fabricated "stalled", Expert's own
tracked/watch path staying byte-for-byte unchanged, and deliver-only being unaffected either way). The beacon
mechanism those tests existed to gate is REMOVED (owner-directed 2026-09-04, never demonstrably ran end-to-
end) — every job is now what "deliver-only" already was, so the distinction those three tests proved no
longer exists to prove. Removed with it, not weakened in place.

Run standalone:  python bridge/bridge-app/tests/test_poller_track_gate.py
(No pytest infra in this repo; plain asserts + a PASS print. Also importable as test_* for a future runner.)
"""
import os
import shutil
import sys
import tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))          # bridge-app (for `fairy`)
from fairy.backend.local_folder import LocalFolderBackend    # noqa: E402
from fairy.config import Config                               # noqa: E402
from fairy.ops import Ops                                     # noqa: E402
from fairy.poller import Poller                                # noqa: E402


class _StubTransfer:
    """deliver() never touches real hardware — just records what it was asked to send."""
    def __init__(self):
        self.calls = []

    def reachable(self):
        # t2105 — this file's own tests are about the delivering-state window and content-hash linking, not
        # reachability itself; stay reachable so the claim gate never blocks them.
        return True

    def deliver(self, nc, name):
        self.calls.append((nc, name))
        return r"\\stub\cncdisk\%s" % name


def _make_poller(tmp_root):
    backend = LocalFolderBackend(tmp_root)
    # t2107 — expert_dest must now be a REAL, reachable directory: Ops.submit_job() refuses at the door
    # otherwise (the local half of the no-send policy, checked against the real filesystem regardless of
    # what the stub Transfer's own .reachable() says — that stub only gates the POLLER's claim, not submit).
    dest = os.path.join(tmp_root, "cncdisk")
    os.makedirs(dest, exist_ok=True)
    cfg = Config(local_root=tmp_root, expert_dest=dest)
    return Poller(backend, _StubTransfer(), cfg, log=lambda *a: None), backend, cfg


def _submit(backend, cfg, name, nc, mapping=None, content_hash=None):
    ops = Ops(backend, cfg)
    return ops.submit_job(name, nc, mapping, content_hash)


# ── (1) the "delivering" window is OBSERVABLE during the write (t2066) ──────────────────────────────────────

def test_delivering_state_is_visible_during_the_write_then_becomes_delivered():
    """The take-over prompt must be able to tell an ACTIVE write from a stale finished job. Until t2066 no queue
    state meant "writing right now" — delivered/failed are both POST-write and persist durably, so a
    forgotten job read as "in flight" forever. The poller now marks 'delivering' right before the synchronous
    deliver() and overwrites it after. Prove a reader sees 'delivering' MID-WRITE, then 'delivered' once done."""
    tmp = tempfile.mkdtemp()
    try:
        poller, backend, cfg = _make_poller(tmp)
        job = _submit(backend, cfg, "part.nc", "G0 X0\nM30\n")

        seen = {}   # a transfer that snapshots the state a concurrent reader (the launcher) would see MID-WRITE

        class _SnoopTransfer:
            def reachable(self):
                return True   # t2105 — this test is about the mid-write status snapshot, not reachability

            def deliver(self, nc, name):
                st = backend.get_status(job["jobId"])       # what /api/queue would report during the copy
                seen["mid"] = st["state"] if st else None
                return r"\\stub\cncdisk\%s" % name

        poller.transfer = _SnoopTransfer()

        poller.tick()   # claim -> mark 'delivering' -> deliver() (snapshots here) -> 'delivered'

        assert seen.get("mid") == "delivering", f"a reader mid-write must see 'delivering', saw {seen!r}"
        assert backend.get_status(job["jobId"])["state"] == "delivered", backend.get_status(job["jobId"])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ── (2) content-hash linking ────────────────────────────────────────────────────────────────────────────────

def test_two_sends_of_the_same_content_hash_link_in_history_different_jobids():
    """Two submissions carrying the SAME content_hash (as send.js would compute for the identical program)
    get two DIFFERENT jobIds — identity stays a fresh timestamp per send, unchanged — but their finished
    history records share the SAME content_hash, the field a UI joins on for 'last time'."""
    tmp = tempfile.mkdtemp()
    try:
        poller, backend, cfg = _make_poller(tmp)
        h = "abc123" * 10 + "abcd"   # a distinctive, fixed 64-hex-char stand-in for a real SHA-256
        r1 = _submit(backend, cfg, "bracket.nc", "G0 X0\nM30\n", None, content_hash=h)
        poller.tick()   # claim -> deliver -> "delivered" + history recorded
        r2 = _submit(backend, cfg, "bracket.nc", "G0 X0\nM30\n", None, content_hash=h)
        poller.tick()

        assert r1["jobId"] != r2["jobId"], "two sends must still get distinct job ids"
        hist = backend.list_history()
        assert len(hist) == 2, hist
        assert hist[0]["content_hash"] == h and hist[1]["content_hash"] == h, hist
        assert hist[0]["jobId"] != hist[1]["jobId"], hist
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_a_different_program_gets_a_different_hash_and_does_not_link():
    """The negative case, named explicitly per the dispatch: two DIFFERENT programs (a different hash, as a
    real feed-rate change would produce) must NOT share a content_hash — no accidental linking."""
    tmp = tempfile.mkdtemp()
    try:
        poller, backend, cfg = _make_poller(tmp)
        r1 = _submit(backend, cfg, "a.nc", "G0 X0\nM30\n", None, content_hash="hash-of-program-a")
        poller.tick()
        r2 = _submit(backend, cfg, "b.nc", "G0 X0 F500\nM30\n", None, content_hash="hash-of-program-b")
        poller.tick()

        hist = {h["jobId"]: h for h in backend.list_history()}
        assert hist[r1["jobId"]]["content_hash"] != hist[r2["jobId"]]["content_hash"]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_content_hash_survives_on_every_job():
    """content_hash must ride through to the history record for any job, tracked or not — a distinction that
    no longer even exists (t2649), so this simply confirms it still rides through at all."""
    tmp = tempfile.mkdtemp()
    try:
        poller, backend, cfg = _make_poller(tmp)
        r = _submit(backend, cfg, "utility.nc", "#520=5\nM30\n", None, content_hash="deadbeef" * 8)
        poller.tick()
        hist = backend.list_history()
        assert len(hist) == 1 and hist[0]["content_hash"] == "deadbeef" * 8, hist
        assert hist[0]["final_state"] == "delivered", hist[0]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- the 'delivering' window is observable mid-write, and two sends of one content_hash link in "
          "History under distinct jobIds while a different program's hash stays distinct")
