"""
A CORRUPT OR UNREADABLE JOB MUST NEVER TAKE THE DAEMON DOWN (t2111).

THE DEFECT THIS CLOSES: poller._claim's very first line, backend.get_job(job_id), was completely
unwrapped. A corrupt local .map.json raises json.JSONDecodeError (a ValueError subclass) or
FileNotFoundError; the Drive backend raises DriveError, a RuntimeError -- NEITHER is an OSError, so
neither was caught by anything in _claim. The exception escaped _claim, escaped tick(), and reached
run_loop()'s try/except, which catches only KeyboardInterrupt -- so it propagated straight through the
finally block (shutting the HTTP server down) and killed the whole process. A single malformed job or one
bad Drive response took the entire gateway offline.

THE FIX: _claim now wraps its whole body (_do_claim) in one try/except Exception. On any escape, it fails
THAT job honestly -- status "failed" with the reason, then delete_job, the exact same shape the existing
delivery-failure branch already uses -- logs it loudly, and returns so tick() (and the next tick's claim)
is completely unaffected. Not a bare swallow: the failure is logged, sounded, and recorded in the job's own
status; only the ONE bad job is affected.

⭐ VERIFIED THE REAL SYMPTOM, not that an exception type changed: a real Poller, a real LocalFolderBackend,
a genuinely corrupt map.json on disk. Assert the poller SURVIVES the tick AND keeps claiming a later, valid
job afterwards -- proving the FIFO doesn't wedge on the bad entry either.

Run standalone:  python bridge/bridge-app/tests/test_claim_survives_bad_job_2111.py
"""
import os
import shutil
import sys
import tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))
from fairy.backend.local_folder import LocalFolderBackend    # noqa: E402
from fairy.config import Config                                # noqa: E402
from fairy.poller import Poller                                 # noqa: E402
from fairy.transfer import Transfer                              # noqa: E402


class _StubBeacons:
    def reset(self, marker=None):
        pass

    def latest(self):
        return None


def _make():
    tmp = tempfile.mkdtemp()
    dest = os.path.join(tmp, "cncdisk")
    os.makedirs(dest)
    backend = LocalFolderBackend(tmp)
    cfg = Config(local_root=tmp, expert_dest=dest, enable_slave=True)
    transfer = Transfer(cfg)
    poller = Poller(backend, transfer, _StubBeacons(), cfg, log=lambda *a: None)
    return poller, backend, cfg, tmp


# ── the actual defect, closed ────────────────────────────────────────────────────────────────────────────────

def test_a_corrupt_map_json_does_not_crash_the_tick():
    """⭐ THE core property: the exact realistic corruption (bad JSON on disk, e.g. a half-written map or a
    hand-edited file) must not raise out of tick() at all."""
    tmp = tempfile.mkdtemp()
    try:
        poller, backend, cfg, root = _make()
        try:
            backend.put_job("job1", b"G0 X0\nM30\n", mapping={"total_beacons": 3, "marker": 111})
            map_path = os.path.join(backend.inbox, "job1.map.json")
            with open(map_path, "w", encoding="utf-8") as f:
                f.write("{not valid json at all")   # the corruption

            poller.tick()   # must NOT raise -- this is the whole point
        finally:
            shutil.rmtree(root, ignore_errors=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_the_bad_job_is_failed_honestly_not_left_wedging_the_fifo():
    """Not a silent swallow: the bad job must be REMOVED from the inbox (so the FIFO can't wedge behind it
    forever) and its status must record a failure with a reason -- exactly the existing delivery-failure
    shape, applied to a claim-time parse failure."""
    tmp = tempfile.mkdtemp()
    try:
        poller, backend, cfg, root = _make()
        try:
            backend.put_job("job1", b"G0 X0\nM30\n", mapping={"total_beacons": 3, "marker": 111})
            map_path = os.path.join(backend.inbox, "job1.map.json")
            with open(map_path, "w", encoding="utf-8") as f:
                f.write("{not valid json at all")

            poller.tick()

            assert backend.list_inbox() == [], "the corrupt job must be removed, not left wedging the FIFO"
            status = backend.get_status("job1")
            assert status is not None, "a failure must be recorded, not silently dropped"
            assert status["state"] == "failed", status
        finally:
            shutil.rmtree(root, ignore_errors=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_the_poller_keeps_claiming_after_a_bad_job_not_just_surviving_one_tick():
    """⭐ THE property the dispatch named explicitly: SURVIVES and KEEPS CLAIMING afterwards. A bad job must
    not poison the poller for jobs that come after it -- a later, VALID job must still deliver normally on
    a subsequent tick."""
    tmp = tempfile.mkdtemp()
    try:
        poller, backend, cfg, root = _make()
        try:
            backend.put_job("job1-bad", b"G0 X0\nM30\n", mapping={"total_beacons": 3, "marker": 111})
            with open(os.path.join(backend.inbox, "job1-bad.map.json"), "w", encoding="utf-8") as f:
                f.write("{not valid json at all")

            poller.tick()   # eats job1-bad
            assert backend.list_inbox() == [], "job1-bad must be gone after the first tick"

            backend.put_job("job2good", b"G0 X1\nM30\n")   # deliver-only, no mapping needed
            poller.tick()   # must still work -- the poller was not left in a broken state

            assert backend.list_inbox() == [], "the good job after the bad one must still be claimed and delivered"
            assert os.path.exists(os.path.join(cfg.expert_dest, "job2good.nc")), \
                   "the good job must actually land on disk -- proof the poller kept working, not just kept ticking"
        finally:
            shutil.rmtree(root, ignore_errors=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_a_non_oserror_exception_from_get_job_also_cannot_escape():
    """Named directly, not just implied by the JSON case: the dispatch specifically flagged DriveError (a
    RuntimeError, NOT an OSError) as the other real-world shape of this defect. A stub backend that raises
    a plain RuntimeError from get_job proves the fix catches ANY exception, not just ValueError/OSError."""
    tmp = tempfile.mkdtemp()
    try:
        poller, backend, cfg, root = _make()
        try:
            class _BoomBackend:
                def list_inbox(self):
                    return ["boom-job"]

                def get_job(self, job_id):
                    raise RuntimeError("simulated DriveError: inbox/boom-job.nc not found")

                def put_status(self, job_id, status):
                    pass

                def delete_job(self, job_id):
                    pass

            poller.backend = _BoomBackend()
            poller.tick()   # must NOT raise, even though get_job raises a plain RuntimeError, not OSError
        finally:
            shutil.rmtree(root, ignore_errors=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items()
                           if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- a corrupt map or a non-OSError backend failure fails that ONE job honestly and the "
          "poller keeps claiming afterwards; nothing takes the daemon down.")
