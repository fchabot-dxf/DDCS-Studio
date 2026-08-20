"""
JOB-RULES.md §2's third claim check (t2105).

THE DEFECT THIS CLOSES: poller._maybe_claim gated on role and on expert_dest being CONFIGURED, never on it
being REACHABLE. With the mill switched off, the job was claimed, removed from the inbox, transfer.deliver()
raised OSError, and the existing except-branch called delete_job -- the job was DESTROYED because a machine
was switched off. Driven against the REAL Poller/Transfer/LocalFolderBackend classes throughout, asserting the
actual outcome (is the job still in the inbox, does transfer.deliver ever get called) -- a test that only
checked a config flag would pass with the destruction still happening.

⛔ §3's startup reconciliation (discard-on-restart + per-job failed statuses) is NOT covered here on purpose:
it shipped in an earlier draft of this turn's work, then the human RULED IT DROPPED entirely (JOB-RULES.md §3
now carries it as [DROPPED] with the reasoning — nothing auto-starts on a DDCS, so a surviving job is late,
not dangerous, and §5's phone rule already makes the window it would matter in a few minutes wide at most).
Reverted along with the tests that covered it; this file is deliberately left proving only the claim gate.

Run standalone:  python bridge/bridge-app/tests/test_reachability_claim_gate_2105.py
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
from fairy.poller import Poller                                 # noqa: E402
from fairy.transfer import Transfer, controller_disk_reachable   # noqa: E402


class _StubBeacons:
    def reset(self, marker=None):
        pass

    def latest(self):
        return None


def _make(expert_dest):
    """The REAL Transfer class throughout -- reachability is checked against the REAL filesystem
    (os.path.isdir), not a stubbed answer, so these tests prove the actual mechanism, not a mock of it."""
    tmp = tempfile.mkdtemp()
    backend = LocalFolderBackend(tmp)
    cfg = Config(local_root=tmp, expert_dest=expert_dest, enable_slave=True)
    transfer = Transfer(cfg)
    poller = Poller(backend, transfer, _StubBeacons(), cfg, log=lambda *a: None)
    return poller, backend, cfg, tmp


def _submit(backend, cfg, name="part.nc", nc="G0 X0\nM30\n"):
    return Ops(backend, cfg).submit_job(name, nc)


# ── the actual defect, closed ────────────────────────────────────────────────────────────────────────────────

def test_unreachable_controller_leaves_the_job_queued_not_destroyed():
    """⭐ THE core property, and the REALISTIC shape of it: the mill was ON when the job was submitted (so
    submit_job's own t2107 gate let it through — this test is about the CLAIM gate specifically, the window
    BETWEEN a good submit and a tick that finds the mill gone), then goes off before the poller ever ticks.
    The job must survive the tick, sitting exactly where it was."""
    tmp = tempfile.mkdtemp()
    dest = os.path.join(tmp, "cncdisk")
    os.makedirs(dest)
    try:
        poller, backend, cfg, root = _make(dest)
        try:
            r = _submit(backend, cfg)
            assert "jobId" in r, r   # sanity: submit succeeded while the mill was reachable
            assert backend.list_inbox() == [r["jobId"]], "sanity: the job is queued before the tick"

            shutil.rmtree(dest)   # the mill goes off / the share vanishes, right before the poller looks

            poller.tick()

            assert backend.list_inbox() == [r["jobId"]], \
                "the job must still be QUEUED after the tick -- not claimed, not deleted, not destroyed"
            assert backend.get_status(r["jobId"]) is None, \
                "never claimed at all -- no status should exist yet (a real claim would have written one)"
        finally:
            shutil.rmtree(root, ignore_errors=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_reachable_controller_still_delivers_normally():
    """The common case must be unaffected: a real, existing directory delivers exactly as before t2105."""
    tmp = tempfile.mkdtemp()
    dest = os.path.join(tmp, "cncdisk")
    os.makedirs(dest)
    try:
        poller, backend, cfg, root = _make(dest)
        try:
            r = _submit(backend, cfg)
            poller.tick()
            assert backend.list_inbox() == [], "a reachable controller must still claim and drain the inbox"
            assert os.path.exists(os.path.join(dest, "part.nc")), "the file must actually land on the (real) disk"
        finally:
            shutil.rmtree(root, ignore_errors=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_the_job_survives_repeated_ticks_while_the_mill_stays_off():
    """Not just the FIRST tick — the inbox is the queue, and a mill that stays off must never destroy a job
    no matter how many times the poller ticks over it (JOB-RULES.md §6: no retry ceiling, because there is
    no retry — this is just 'not claiming', repeated). Submitted while reachable (t2107's own gate would
    otherwise refuse it before it ever reached the inbox), then the mill goes off for good."""
    tmp = tempfile.mkdtemp()
    dest = os.path.join(tmp, "still_on_for_now")
    os.makedirs(dest)
    try:
        poller, backend, cfg, root = _make(dest)
        try:
            r = _submit(backend, cfg)
            assert "jobId" in r, r
            shutil.rmtree(dest)
            for _ in range(10):
                poller.tick()
            assert backend.list_inbox() == [r["jobId"]], "still queued after 10 ticks with the mill off"
        finally:
            shutil.rmtree(root, ignore_errors=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_ops_and_poller_agree_about_reachability_because_they_share_the_one_function():
    """The claim gate and the UI's own controller_connected must never be able to disagree — both delegate to
    controller_disk_reachable(), proven directly rather than assumed from reading the two call sites."""
    tmp = tempfile.mkdtemp()
    dest = os.path.join(tmp, "cncdisk")
    os.makedirs(dest)
    try:
        cfg_reachable = Config(local_root=tmp, expert_dest=dest)
        cfg_unreachable = Config(local_root=tmp, expert_dest=os.path.join(tmp, "gone"))
        backend = LocalFolderBackend(tmp)
        assert Ops(backend, cfg_reachable).controller_reachable() is True
        assert Transfer(cfg_reachable).reachable() is True
        assert Ops(backend, cfg_unreachable).controller_reachable() is False
        assert Transfer(cfg_unreachable).reachable() is False
        assert controller_disk_reachable("") is False, "blank dest must never read as reachable"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items()
                           if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- the reachability claim gate never destroys a job for a mill that is switched off, the "
          "common (reachable) case is unaffected, and Ops/the Poller agree about reachability because they "
          "share ONE function.")
