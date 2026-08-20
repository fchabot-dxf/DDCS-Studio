"""
JOB HISTORY: STOP THE FALSE "STALLED" ON A NO-MODBUS BRIDGE, AND LINK REPEAT SENDS BY CONTENT (t2020).

Two things, unit-tested directly against the real Poller/Ops classes (a real LocalFolderBackend on a temp dir,
stub transfer + beacon source — no real hardware, no real Modbus):

1. A tracked job (has beacons) claimed while `config.enable_slave` is False must resolve immediately to
   "delivered" (naming the real reason), never enter the watch loop, and never become "stalled" — a controller
   incapability (or an admin toggle correctly left off for V4.1) must not read as a machine fault. Proven
   against BOTH configs: `enable_slave=False` -> the new path; `enable_slave=True` (Expert's own config) ->
   the EXISTING tracked/watch path, byte-for-byte unchanged (asserts `poller.active` is populated exactly as
   before, not the new short-circuit).
2. Two `submit_job` calls carrying the SAME `content_hash` produce two DIFFERENT jobIds (job identity stays a
   fresh timestamp per send, on purpose) but their finished history records share the SAME `content_hash` — the
   field a UI can join on to answer "last time this ran: N min". A DIFFERENT hash stays distinct.

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
        # t2105 — this file's own tests are about what happens AFTER a job claims (tracked/deliver-only,
        # enable_slave), not about reachability itself; stay reachable so the claim gate never blocks them.
        return True

    def deliver(self, nc, name):
        self.calls.append((nc, name))
        return r"\\stub\cncdisk\%s" % name


class _StubBeacons:
    """A BeaconSource that never produces a beacon — the shape SimBeaconSource takes in real production
    when the Modbus slave never starts (no feed() call, ever)."""
    def reset(self, marker=None):
        pass

    def latest(self):
        return None


def _make_poller(tmp_root, enable_slave):
    backend = LocalFolderBackend(tmp_root)
    cfg = Config(local_root=tmp_root, expert_dest=r"\\bench\cncdisk", enable_slave=enable_slave)
    return Poller(backend, _StubTransfer(), _StubBeacons(), cfg, log=lambda *a: None), backend, cfg


def _submit(backend, cfg, name, nc, mapping=None, content_hash=None):
    ops = Ops(backend, cfg)
    return ops.submit_job(name, nc, mapping, content_hash)


# ── (1) the false "stalled" gate ────────────────────────────────────────────────────────────────────────────

def test_no_modbus_link_delivers_untracked_instead_of_entering_the_watch_loop():
    """enable_slave=False + a tracked job (has beacons) -> resolves to 'delivered' immediately at claim time,
    never enters poller.active, and the history record names the real reason — not a fabricated 'stalled'."""
    tmp = tempfile.mkdtemp()
    try:
        poller, backend, cfg = _make_poller(tmp, enable_slave=False)
        tracked_map = {"total_beacons": 5, "total_est_time_s": 120, "marker": 111}
        r = _submit(backend, cfg, "part.nc", "G0 X0\nM30\n", tracked_map)
        assert r["tracked"] is True, r   # the map itself IS a tracked map — confirms the test setup is real

        poller.tick()   # idle -> claim

        assert poller.active is None, "a job claimed with no Modbus link must NOT enter the watch loop"
        status = backend.get_status(r["jobId"])
        assert status["state"] == "delivered", status
        assert any("no Modbus link" in e for e in status["events"]), status["events"]
        hist = backend.list_history()
        assert len(hist) == 1 and hist[0]["final_state"] == "delivered", hist
        assert hist[0]["duration_s"] is None, hist[0]   # never started watching -> no fabricated duration
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_expert_behaviour_unchanged_enable_slave_true_still_enters_the_watch_loop():
    """The EXACT same tracked job, same everything, except enable_slave=True (Expert's own config) — must
    take the EXISTING path: enters poller.active and is NOT immediately resolved. Proves the new branch only
    fires when there is genuinely no Modbus link, never touching Expert's own behaviour."""
    tmp = tempfile.mkdtemp()
    try:
        poller, backend, cfg = _make_poller(tmp, enable_slave=True)
        tracked_map = {"total_beacons": 5, "total_est_time_s": 120, "marker": 111}
        r = _submit(backend, cfg, "part.nc", "G0 X0\nM30\n", tracked_map)

        poller.tick()   # idle -> claim

        assert poller.active is not None, "enable_slave=True must still enter the watch loop, unchanged"
        assert poller.active["job_id"] == r["jobId"], poller.active
        assert poller.active["total"] == 5, poller.active
        status = backend.get_status(r["jobId"])
        assert status["state"] == "delivered", status   # "delivered -> awaiting beacons", not yet running/stalled
        assert not any("no Modbus link" in e for e in status["events"]), status["events"]
        assert backend.list_history() == [], "no terminal record yet — the job is still active, exactly as before"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_deliver_only_job_is_unaffected_by_enable_slave_either_way():
    """A deliver-only job (no beacons) must behave identically regardless of enable_slave — the new gate only
    ever applies to a job that actually asked to be tracked."""
    for enable_slave in (True, False):
        tmp = tempfile.mkdtemp()
        try:
            poller, backend, cfg = _make_poller(tmp, enable_slave=enable_slave)
            r = _submit(backend, cfg, "probe.nc", "G0 X0\nM30\n")   # no map -> deliver-only
            assert r["tracked"] is False, r
            poller.tick()
            assert poller.active is None, poller.active
            status = backend.get_status(r["jobId"])
            assert status["state"] == "delivered", status
            assert any("deliver-only" in e for e in status["events"]), status["events"]
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


# ── (1b) the "delivering" window is OBSERVABLE during the write (t2066) ──────────────────────────────────────

def test_delivering_state_is_visible_during_the_write_then_becomes_delivered():
    """The take-over prompt must be able to tell an ACTIVE write from a stale finished job. Until t2066 no queue
    state meant "writing right now" — delivered/running/stalled are all POST-write and persist durably, so a
    forgotten job read as "in flight" forever. The poller now marks 'delivering' right before the synchronous
    deliver() and overwrites it after. Prove a reader sees 'delivering' MID-WRITE, then 'delivered' once done."""
    tmp = tempfile.mkdtemp()
    try:
        poller, backend, cfg = _make_poller(tmp, enable_slave=True)
        job = _submit(backend, cfg, "part.nc", "G0 X0\nM30\n", {"total_beacons": 5, "marker": 111})

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
    """Two submissions carrying the SAME content_hash (as send.js would compute for the identical program,
    tracked or not) get two DIFFERENT jobIds — identity stays a fresh timestamp per send, unchanged — but
    their finished history records share the SAME content_hash, the field a UI joins on for 'last time'."""
    tmp = tempfile.mkdtemp()
    try:
        poller, backend, cfg = _make_poller(tmp, enable_slave=True)
        h = "abc123" * 10 + "abcd"   # a distinctive, fixed 64-hex-char stand-in for a real SHA-256
        r1 = _submit(backend, cfg, "bracket.nc", "G0 X0\nM30\n", None, content_hash=h)
        poller.tick()   # deliver-only (no map) -> immediately "delivered" + history recorded
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
        poller, backend, cfg = _make_poller(tmp, enable_slave=True)
        r1 = _submit(backend, cfg, "a.nc", "G0 X0\nM30\n", None, content_hash="hash-of-program-a")
        poller.tick()
        r2 = _submit(backend, cfg, "b.nc", "G0 X0 F500\nM30\n", None, content_hash="hash-of-program-b")
        poller.tick()

        hist = {h["jobId"]: h for h in backend.list_history()}
        assert hist[r1["jobId"]]["content_hash"] != hist[r2["jobId"]]["content_hash"]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_content_hash_survives_on_a_deliver_only_job_not_only_a_tracked_one():
    """The dispatch's own point: linking must work for ANY job, not only beacon-tracked ones. mapping is
    None going in (no beacons ticked) — content_hash must still ride through to the history record."""
    tmp = tempfile.mkdtemp()
    try:
        poller, backend, cfg = _make_poller(tmp, enable_slave=True)
        r = _submit(backend, cfg, "utility.nc", "#520=5\nM30\n", None, content_hash="deadbeef" * 8)
        poller.tick()
        hist = backend.list_history()
        assert len(hist) == 1 and hist[0]["content_hash"] == "deadbeef" * 8, hist
        assert hist[0]["total_beacons"] is None, hist[0]   # confirms this really was the deliver-only path
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- no-Modbus jobs deliver honestly instead of faking 'stalled' (Expert's own tracked path proven "
          "byte-for-byte unchanged), and two sends of one content_hash link in History under distinct jobIds "
          "while a different program's hash stays distinct, tracked or deliver-only")
