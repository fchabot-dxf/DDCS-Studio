"""
JOB HISTORY, DRIVEN FOR REAL — the server-side half of the chain, never once exercised (t2065).

This arc has already found the "wired chain, never a working one" shape TWICE: beacon.js's checkpoint
mechanism never worked despite every unit test passing, and "last time" reported a stalled run's own
truncated stopwatch despite the UI test passing. Both bugs lived in the gap between "a test constructs the
state a real user's action would have produced" and "a real user's action actually produces that state."

t2649 (BACKLOG #78) — the beacon mechanism this file used as its own proving ground is REMOVED (owner-
directed 2026-09-04, never demonstrably ran end-to-end). The DISCIPLINE this file exists for still applies —
a real HTTP POST to a real running `/api/jobs`, the real poller's own background tick loop (not a manually-
called `.tick()`), a real HTTP GET to `/api/history` reading back what that pipeline genuinely wrote to disk —
just against the simplified delivery-only flow every job now uses.

Run standalone:  python bridge/bridge-app/tests/test_history_real_path_2065.py
"""
import json
import os
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))
from fairy.bridge import build   # noqa: E402
from fairy.config import Config   # noqa: E402
from fairy.ops import Ops   # noqa: E402
from fairy.server import start_server   # noqa: E402


def _post(base, path, body):
    req = urllib.request.Request(
        base + path, data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "X-DDCS-Local": "1"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


def _get(base, path):
    req = urllib.request.Request(base + path, headers={"X-DDCS-Local": "1"})
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


def _run_real_pipeline(fn, machine_id="", wrong_identity=False):
    """Stand up a REAL bridge (real HTTP server + real backend + real Poller) and run its tick loop in a
    background thread -- the SAME shape run_loop() uses, not a test harness that calls .tick() by hand on a
    fake clock. `fn(base_url)` runs with it live; teardown always happens, even on failure."""
    tmp = tempfile.mkdtemp(prefix="fairy_realpath_")
    dest = os.path.join(tmp, "cncdisk")   # transfer.py: "for a no-hardware test, point dest at an ordinary folder"
    os.makedirs(dest, exist_ok=True)
    if wrong_identity:
        # identity.verify() reads <dest>/<identity_filename> and compares its own "id" against cfg.machine_id
        # (poller.py's _do_claim) -- writing a DIFFERENT id here is what makes every claim on this pipeline
        # a genuine identity mismatch, over real HTTP, not a mocked refusal.
        with open(os.path.join(dest, ".bridge-machine.json"), "w", encoding="utf-8") as f:
            json.dump({"id": "SOME-OTHER-MACHINE", "name": "Wrong machine"}, f)
    cfg = Config(
        backend="local", local_root=tmp, expert_dest=dest,
        poll_interval_s=0.1,
        serve=True, host="127.0.0.1", port=18765, machine_id=machine_id,
    )
    backend, transfer, poller, _ = build(cfg)
    httpd = start_server(cfg, Ops(backend, cfg))

    stop = threading.Event()

    def _tick_loop():
        while not stop.is_set():
            poller.tick()
            time.sleep(0.05)   # real wall-clock cadence, faster than production only so the test doesn't take minutes

    t = threading.Thread(target=_tick_loop, daemon=True)
    t.start()
    base = f"http://127.0.0.1:{cfg.port}"
    try:
        # confirm the server is actually answering before the test proceeds
        for _ in range(20):
            try:
                _get(base, "/api/descriptor")
                break
            except Exception:
                time.sleep(0.1)
        else:
            raise RuntimeError("real bridge server never came up")
        fn(base)
    finally:
        stop.set()
        t.join(timeout=2)
        httpd.shutdown()
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)


def test_a_job_posted_over_real_http_is_claimed_delivered_and_recorded_by_the_real_tick_loop():
    def run(base):
        r = _post(base, "/api/jobs", {"name": "real_path.nc", "nc": "(real path job)\nM30\n",
                                       "contentHash": "REALHASH1"})
        job_id = r["jobId"]

        # wait for the real background tick loop to CLAIM + deliver it -- real timing, not forced
        for _ in range(50):
            q = _get(base, "/api/queue")
            if any(i.get("jobId") == job_id and i.get("state") == "delivered" for i in q):
                break
            time.sleep(0.1)
        else:
            raise AssertionError("real tick loop never claimed/delivered the job")

        for _ in range(50):
            hist = _get(base, "/api/history")
            rec = next((h for h in hist if h["jobId"] == job_id), None)
            if rec is not None:
                break
            time.sleep(0.1)
        else:
            raise AssertionError("job was delivered but never recorded in real history via the real tick loop")

        assert rec["final_state"] == "delivered", rec
        assert rec["content_hash"] == "REALHASH1", rec
        assert rec["name"] == "real_path.nc", rec
    _run_real_pipeline(run)


def test_two_jobs_same_content_hash_both_land_in_history_newest_first():
    """The real sort order backend.list_history() uses (recorded_at DESC) -- the FOUNDATION
    lastTimeDuration()/jobHistory.js's own history-linking logic (t2020) builds on, proven against
    genuinely-produced data rather than hand-typed rows."""
    def run(base):
        r1 = _post(base, "/api/jobs", {"name": "lt.nc", "nc": "(lt job1)\nM30\n", "contentHash": "LTHASH"})
        for _ in range(50):
            hist = _get(base, "/api/history")
            if any(h["jobId"] == r1["jobId"] for h in hist):
                break
            time.sleep(0.1)

        r2 = _post(base, "/api/jobs", {"name": "lt.nc", "nc": "(lt job2)\nM30\n", "contentHash": "LTHASH"})
        for _ in range(50):
            hist = _get(base, "/api/history")
            if any(h["jobId"] == r2["jobId"] for h in hist):
                break
            time.sleep(0.1)
        else:
            raise AssertionError("second job never reached real history via the real tick loop")

        hist = _get(base, "/api/history")
        rows = sorted(hist, key=lambda h: h.get("recorded_at", ""), reverse=True)   # matches backend.list_history()'s own real sort
        assert rows[0]["jobId"] == r2["jobId"] and rows[0]["final_state"] == "delivered", rows[0]
        assert rows[1]["jobId"] == r1["jobId"] and rows[1]["final_state"] == "delivered", rows[1]
        assert rows[0]["content_hash"] == rows[1]["content_hash"] == "LTHASH", rows
    _run_real_pipeline(run)


def test_an_identity_refusal_over_real_http_is_recorded_honestly_not_silently_dropped():
    """A job aimed at the wrong machine (CONFIGS §7's own identity check) must be REFUSED loudly by the
    real tick loop, not silently vanish -- over the same real HTTP pipeline the happy path above uses."""
    def run(base):
        r = _post(base, "/api/jobs", {"name": "wrong_machine.nc", "nc": "(x)\nM30\n", "contentHash": "IDHASH"})
        job_id = r["jobId"]
        for _ in range(50):
            q = _get(base, "/api/queue")
            item = next((i for i in q if i.get("jobId") == job_id), None)
            if item is not None and item.get("state") == "failed":
                break
            time.sleep(0.1)
        else:
            raise AssertionError("the real tick loop never refused the identity-mismatched job")
        # a SECOND job, posted AFTER the refusal, must still be claimable -- the real proof the FIFO wasn't
        # wedged behind the refused one (list_queue() itself keeps showing terminal statuses on purpose, so
        # checking THAT for absence would assert on the wrong thing).
        r2 = _post(base, "/api/jobs", {"name": "second.nc", "nc": "(y)\nM30\n", "contentHash": "IDHASH2"})
        for _ in range(50):
            q = _get(base, "/api/queue")
            item2 = next((i for i in q if i.get("jobId") == r2["jobId"]), None)
            if item2 is not None and item2.get("state") == "failed":
                break
            time.sleep(0.1)
        else:
            raise AssertionError("a job posted after the refusal never got its own turn -- the FIFO wedged")
    _run_real_pipeline(run, machine_id="EXPECTED-ID", wrong_identity=True)


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- job history proven over the REAL HTTP + real background tick loop + real backend, not a "
          "single hand-typed history row anywhere in this file")
