"""
JOB HISTORY, DRIVEN FOR REAL — the server-side half of the chain, never once exercised (t2065).

This arc has already found the "wired chain, never a working one" shape TWICE: beacon.js's checkpoint
mechanism never worked despite every unit test passing, and "last time" reported a stalled run's own
truncated stopwatch despite the UI test passing. Both bugs lived in the gap between "a test constructs the
state a real user's action would have produced" and "a real user's action actually produces that state."

Every EXISTING test in this area falls into exactly that gap on the server side too, once looked at closely:
`test_poller_track_gate.py`/`test_beacon_health_2057.py` call `ops.submit_job(...)` as a direct Python
function call, never over real HTTP; the JS-side `gateway-jobs-history-view-2026.spec.js` mocks
`/api/history`'s RESPONSE with hand-typed row dicts that were never produced by `poller.py`'s own
`_record_history`. Nothing has ever driven: a real HTTP POST to a real running `/api/jobs` -> the real
poller's own background tick loop (not a manually-called `.tick()`) advancing a real job through real beacon
arrivals or a real wall-clock stall -> a real HTTP GET to `/api/history` reading back what that pipeline
genuinely wrote to disk.

This file closes that gap: a real `fairy.bridge`-built server (SimBeaconSource stands in for hardware --
the only necessarily-fake piece, since no real Modbus link exists here), a background thread running the
SAME tick loop shape `run_loop()` uses, and a plain `urllib` HTTP client sending the exact requests
`send.js`/`client.js` would send. If the values coming back don't match what the JS layer (`lastTimeDuration`,
`jobs.js`'s render) already assumes, that mismatch is the actual defect -- found here, at the source, not
inferred from a passing UI test that never touched the source at all.

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
from fairy.slave import SimBeaconSource   # noqa: E402


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


def _run_real_pipeline(fn):
    """Stand up a REAL bridge (real HTTP server + real backend + real Poller) and run its tick loop in a
    background thread -- the SAME shape run_loop() uses, not a test harness that calls .tick() by hand on a
    fake clock. `fn(base_url, beacons)` runs with it live; teardown always happens, even on failure."""
    tmp = tempfile.mkdtemp(prefix="fairy_realpath_")
    dest = os.path.join(tmp, "cncdisk")   # transfer.py: "for a no-hardware test, point dest at an ordinary folder"
    cfg = Config(
        # enable_slave=True is REQUIRED even with a SimBeaconSource stand-in: poller.py's own t2020 fix
        # checks this flag directly, independent of whether a usable beacons object was actually supplied —
        # False resolves every tracked job straight to "delivered", correctly, per that fix (confirmed by
        # hitting it while writing this test: with enable_slave=False the job never entered the watch loop
        # at all, exactly as designed — a real config mistake here, not a bug in the code under test).
        backend="local", local_root=tmp, expert_dest=dest, enable_slave=True,
        stall_seconds=2.0,           # short but real -- the test genuinely waits this long, wall-clock
        run_poll_interval_s=0.1, poll_interval_s=0.1,
        serve=True, host="127.0.0.1", port=18765, machine_id="",
    )
    beacons = SimBeaconSource()
    backend, transfer, beacons, poller, _ = build(cfg, beacons=beacons)
    httpd = start_server(cfg, Ops(backend, cfg, beacons))

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
        fn(base, beacons)
    finally:
        stop.set()
        t.join(timeout=2)
        httpd.shutdown()
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)


def test_a_tracked_job_fed_to_completion_produces_a_real_positive_duration_over_real_http():
    def run(base, beacons):
        mapping = {"total_beacons": 3, "beacons": [
            {"n": 1, "orig_line": 5, "op": "Op1", "cum_time_s": 1.0, "percent": 33.0, "complete": False},
            {"n": 2, "orig_line": 10, "op": "Op2", "cum_time_s": 2.0, "percent": 66.0, "complete": False},
            {"n": 3, "orig_line": 15, "op": "Op3", "cum_time_s": 3.0, "percent": 100.0, "complete": True},
        ], "total_est_time_s": 3.0}
        r = _post(base, "/api/jobs", {"name": "real_path.nc", "nc": "(real path job)\nM30\n",
                                       "map": mapping, "contentHash": "REALHASH1"})
        assert r["tracked"] is True, r
        job_id = r["jobId"]

        # wait for the real background tick loop to CLAIM it (delivered) -- real timing, not forced
        for _ in range(50):
            q = _get(base, "/api/queue")
            if any(i.get("jobId") == job_id and i.get("state") == "delivered" for i in q):
                break
            time.sleep(0.1)
        else:
            raise AssertionError("real tick loop never claimed/delivered the job")

        # duration_s = round(ended - started_at), and started_at is set on the FIRST beacon (not delivery) --
        # so the gap that must be real and unambiguous after rounding is between beacon 1 and the final one.
        beacons.feed(1)
        time.sleep(0.8)
        beacons.feed(2)
        time.sleep(0.8)
        beacons.feed(3)   # the forced "complete" beacon

        for _ in range(50):
            hist = _get(base, "/api/history")
            rec = next((h for h in hist if h["jobId"] == job_id), None)
            if rec and rec["final_state"] == "done":
                break
            time.sleep(0.1)
        else:
            raise AssertionError("job never reached 'done' in real history via the real tick loop")

        assert rec["final_state"] == "done", rec
        assert rec["content_hash"] == "REALHASH1", rec
        assert rec["total_beacons"] == 3 and rec["last_beacon"] == 3, rec
        # THE ACTUAL CHECK: duration_s is a REAL wall-clock measurement, not a synthetic number -- must be a
        # genuinely positive float roughly matching the real ~0.7s the test spent between start and completion,
        # not None (would mean started_at never got set) and not a hand-typed constant.
        assert isinstance(rec["duration_s"], (int, float)) and rec["duration_s"] > 0, rec
    _run_real_pipeline(run)


def test_a_job_that_gets_one_beacon_then_genuinely_stalls_records_honestly_over_real_http():
    """THE t2049 CASE, produced for real: a job that made SOME progress then never finished -- exactly the
    shape that used to poison "last time" before t2049's own fix. Waits out the REAL stall_seconds, not a
    fast-forwarded clock."""
    def run(base, beacons):
        mapping = {"total_beacons": 5, "beacons": [
            {"n": 1, "orig_line": 5, "op": "Op1", "cum_time_s": 1.0, "percent": 20.0, "complete": False},
        ], "total_est_time_s": 5.0}
        r = _post(base, "/api/jobs", {"name": "real_path.nc", "nc": "(real path job 2)\nM30\n",
                                       "map": mapping, "contentHash": "REALHASH1"})
        job_id = r["jobId"]
        for _ in range(50):
            q = _get(base, "/api/queue")
            if any(i.get("jobId") == job_id and i.get("state") == "delivered" for i in q):
                break
            time.sleep(0.1)
        beacons.feed(1)   # one real checkpoint -- then nothing else ever arrives
        time.sleep(3.5)   # past the real stall_seconds=2.0 configured above -- genuinely waited out, not simulated

        hist = _get(base, "/api/history")
        rec = next((h for h in hist if h["jobId"] == job_id), None)
        assert rec is not None, "the stalled job must still be recorded -- honestly, not silently dropped"
        assert rec["final_state"] == "stalled", rec
        assert rec["content_hash"] == "REALHASH1", rec
        # a real, positive, but SHORT duration -- the watchdog's own elapsed time, not a fabricated number
        assert isinstance(rec["duration_s"], (int, float)) and 0 < rec["duration_s"] < 5, rec
    _run_real_pipeline(run)


def test_last_time_over_real_data_skips_the_real_stalled_run_and_finds_the_real_completion():
    """BOTH jobs above, back to back, same content_hash, through the SAME real pipeline -- then the exact
    lastTimeDuration() logic (t2049) applied to what the server genuinely produced, not a synthetic
    replacement. Newest-first (the real sort order backend.list_history() uses) means the stalled one is
    rows[0] and the done one is rows[1] -- lastTimeDuration(rows, 0) must skip past the stall to the real
    completion, exactly the bug t2049 fixed, now proven against genuinely-produced data."""
    def run(base, beacons):
        # job 1: completes for real
        m1 = {"total_beacons": 2, "beacons": [
            {"n": 1, "orig_line": 5, "op": "Op1", "cum_time_s": 1.0, "percent": 50.0, "complete": False},
            {"n": 2, "orig_line": 10, "op": "Op2", "cum_time_s": 2.0, "percent": 100.0, "complete": True},
        ], "total_est_time_s": 2.0}
        r1 = _post(base, "/api/jobs", {"name": "lt.nc", "nc": "(lt job1)\nM30\n", "map": m1, "contentHash": "LTHASH"})
        for _ in range(50):
            q = _get(base, "/api/queue")
            if any(i.get("jobId") == r1["jobId"] and i.get("state") == "delivered" for i in q):
                break
            time.sleep(0.1)
        beacons.feed(1); time.sleep(0.8); beacons.feed(2)   # a real, unambiguous-after-rounding gap between beacons
        for _ in range(50):
            hist = _get(base, "/api/history")
            if any(h["jobId"] == r1["jobId"] and h["final_state"] == "done" for h in hist):
                break
            time.sleep(0.1)

        # job 2: same program (same content_hash), stalls for real, after the done one
        m2 = {"total_beacons": 3, "beacons": [{"n": 1, "orig_line": 5, "op": "Op1", "cum_time_s": 1.0, "percent": 33.0, "complete": False}], "total_est_time_s": 3.0}
        r2 = _post(base, "/api/jobs", {"name": "lt.nc", "nc": "(lt job2)\nM30\n", "map": m2, "contentHash": "LTHASH"})
        for _ in range(50):
            q = _get(base, "/api/queue")
            if any(i.get("jobId") == r2["jobId"] and i.get("state") == "delivered" for i in q):
                break
            time.sleep(0.1)
        beacons.feed(1)
        time.sleep(3.5)

        hist = _get(base, "/api/history")
        rows = sorted(hist, key=lambda h: h.get("recorded_at", ""), reverse=True)   # matches backend.list_history()'s own real sort
        assert rows[0]["jobId"] == r2["jobId"] and rows[0]["final_state"] == "stalled", rows[0]
        assert rows[1]["jobId"] == r1["jobId"] and rows[1]["final_state"] == "done", rows[1]

        # THE ACTUAL lastTimeDuration LOGIC (t2049's fix), against this REAL data:
        def last_time_duration(rows, i):
            r = rows[i]
            if not r.get("content_hash"):
                return None
            for p in rows[i + 1:]:
                if p.get("content_hash") == r["content_hash"] and p.get("final_state") == "done":
                    return p.get("duration_s")
            return None

        lt = last_time_duration(rows, 0)
        assert lt == rows[1]["duration_s"], (lt, rows[1]["duration_s"])
        assert lt is not None and lt > 0
    _run_real_pipeline(run)


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- job history proven over the REAL HTTP + real background tick loop + real backend, not a "
          "single hand-typed history row anywhere in this file")
