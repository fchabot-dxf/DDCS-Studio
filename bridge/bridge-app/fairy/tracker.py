"""tracker.py — pure function: (job_id, name, state, events) -> status object (PROTOCOL §5).

No side effects. The Poller hands the result to Backend.put_status.

t2649 (BACKLOG #78) — was (map, last_beacon, state) -> status, decoding a bare beacon number into percent/
op/line/ETA via the per-job map the beacon mechanism produced (PROTOCOL §2). The beacon mechanism is REMOVED
(owner-directed 2026-09-04, never demonstrably ran end-to-end — see BACKLOG #78's own evidence table) and its
replacement (live Modbus position/job-state polling, BACKLOG #79, t2647) is PROCESS-WIDE, not per-job — it has
no map, no per-job percent/op/line/ETA to attach to a status object. So this collapses to exactly what a
DELIVER-ONLY job's status always was: identity + state + a plain event log.
"""
from datetime import datetime, timezone


def _now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_status(job_id, name, state, events):
    return {
        "jobId": job_id,
        "name": name,
        "state": state,
        "updated_at": _now(),
        "events": list(events),
    }
