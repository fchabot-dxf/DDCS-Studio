# PROTOCOL — the contract between `web/` and `fairy/`

The two apps never talk directly; they rendezvous through the R2 bucket. This file is the seam both
sides must obey. Change it deliberately — a mismatch silently breaks the bridge.

---

## 1-2. [REMOVED t2649, BACKLOG #78] The beacon checkpoint mechanism and its per-job map

⛔ **REMOVED entirely, owner-directed 2026-09-04: "beacons dont work remove them."** The instrumenter (`web/`'s
own JS port + `checkpoint_insert.py`) rewrote the user's `.nc` to insert `#251=111`/`#250=<n>` + `MSETDATA[…]`
checkpoints at safe retracts; a Modbus SLAVE on the gateway watched for them and decoded a bare beacon number
into percent/op/line/ETA via a per-job JSON map. **The evidence, preserved here so nobody repeats the
mistake it recorded:**

> ⚠⚠ **"Proven on the machine 2026-06-06" was WIRE-FRAME evidence, never FEATURE evidence.** `CHECKPOINT_TEST.nc`
> proved `MSETDATA[250,1,0,2,16,300]` transports 2 bytes wedge-free — a genuine, real fact about the transport.
> It was NOT proof the beacon FEATURE worked end to end: instrumenting a real job, watching checkpoints fire,
> decoding the map, and showing progress was never once exercised, anywhere, by anything (BACKLOG #78's own
> evidence table — the ONLY beacon test that existed, `test_beacon_health_2057.py`, covered exclusively the
> SAD path: a bad/busy COM port reporting its own honest failure). The wire worked; the feature never ran.

⇒ **The replacement is BACKLOG #79 — live Modbus position/run-state/line-number polling** (registers
`10002`/`16062`, confirmed on the owner's own machine, `expert-m350/FINDINGS.md` 2026-09-05). It is
continuous rather than checkpoint-based, needs no per-job map, and — the real win — **never rewrites the
user's own `.nc` file at all.** See master.py's `PositionPoller` / `Ops.job_tracking_status()`.

---

## 3. R2 bucket layout
| Key | Writer | Reader | Meaning |
|---|---|---|---|
| `inbox/<jobId>.nc` | web | fairy | job waiting to be delivered (the **queue**) |
| `inbox/<jobId>.map.json` | web | fairy | optional per-job metadata (`content_hash`, `source`, `machine_id`) — never a progress-watch request (t2649) |
| `status/<jobId>.json` | fairy | web | job state (see §5) |
| `gateway/heartbeat.json` | fairy | web | gateway liveness + descriptor (`machine_id`, `name`, `last_seen`) — so the cloud console knows if the gateway is awake (CONFIGS §6) |
| `history/<jobId>.json` | fairy | web | finished-job log: `name`, `final_state`, `delivered_at`, `recorded_at`, `content_hash` — the History view (durable; written on every terminal outcome) |

- **`jobId`** is **lexicographically sortable** = creation order, e.g. `20260606T143207-bracket_v3`.
  The queue is "`LIST inbox/` sorted ascending" → strict FIFO.
- `web` PUTs to `inbox/`; `fairy` LISTs `inbox/` and takes the **oldest**.
- **Every job is delivered the same way** (t2649, BACKLOG #78 — was two types, TRACKED/DELIVER-ONLY, split
  on whether the beacon mechanism should watch it; that split is gone with the mechanism). Deliver, mark
  `delivered`, done — a `.map.json`'s presence no longer changes what happens to the job.
- **No bucket retention (decided 2026-06-07).** There is no `archive/`/`kept/`. fairy **deletes
  `inbox/<jobId>.*` the instant delivery succeeds**. Rationale: the file now lives on the **controller's
  CNCDISK**, which is where a same-session re-run comes from anyway (re-select + Start on the panel); days
  later the operator regenerates. So the controller is the de-facto retention; a bucket copy buys nothing.
  Deleting on delivery is also the idempotency mechanism (a delivered job is gone from the queue) **and** an
  operational-safety win: a crashed/restarted fairy can't re-deliver a job mid-cut.
  Only `status/<jobId>.json` (metadata — no G-code) persists, as the web tracker's mirror.

---

## 4. [REMOVED t2649, BACKLOG #78] "Single active job"

⛔ Existed ONLY because the beacon frame carried no job id, so at most one job could be watched at a time.
With the beacon mechanism removed there is nothing to watch — every claim delivers and reaches a terminal
state (`delivered`/`failed`) synchronously, within the same tick that claimed it:

```
fairy loop:
  if inbox not empty:
     jobId = oldest in inbox
     read inbox/<jobId>.nc (+ .map.json if present)
     copy the .nc  →  Expert CNCDISK     (deliver)
     DELETE inbox/<jobId>.*              (delivered → controller has it; see §3)
     status = "delivered" (terminal)     -- or "failed" on a refusal/delivery error
```

Multiple jobs can be claimed and delivered across successive ticks with nothing held "active" between them.

---

## 5. Status object (`status/<jobId>.json`, fairy → web)
```json
{
  "jobId": "20260606T143207-bracket_v3",
  "name": "bracket_v3.nc",
  "state": "delivered",
  "updated_at": "2026-06-06T14:32:07Z",
  "events": [ "claimed 20260606T143207-bracket_v3", "writing to controller", "delivered → Expert" ]
}
```
**States:** `queued` (in inbox, web's view) → `delivering` (the write is in progress — see JOB-RULES.md) →
`delivered` (terminal, on Expert disk) · or `failed` (identity/delivery/IO refusal, terminal).

t2649 (BACKLOG #78) — was also `last_beacon`/`total_beacons`/`percent`/`op`/`line`/`eta_s`, all decoded from
the beacon mechanism's own per-job map. Removed with it: `delivered` is now always terminal, so there is no
"live" number left for this object to carry — live job state (BACKLOG #79) is a separate, process-wide
Modbus poll, not attached to any one job's status object. See `Ops.job_tracking_status()`.

`web` polls `status/<jobId>.json` for the tracker.

---

## 6. What is fixed vs free
- **Free (either app can evolve as long as both agree here):** the map fields, the R2 key names, the status
  fields. Bump a `"protocol": 1` field on objects if we ever break compatibility.

---

## 7. CNCDISK file explorer + command channel
A view of the controller's CNCDISK (and the ability to tidy it) from the web app. fairy is the only PC
cabled to the controller, so it publishes the listing and executes the actions.

| Key | Writer | Reader | Meaning |
|---|---|---|---|
| `cncdisk/index.json` | fairy | web | listing of the controller's CNCDISK (refreshed on a cadence) |
| `commands/<cmdId>.json` | web | fairy | a file-management command for fairy to execute (then delete) |

**`cncdisk/index.json`:**
```json
{ "path": "\\\\192.168.0.99\\CNCDISK", "updated_at": "2026-06-07T13:00:00Z",
  "files": [ { "name": "bracket_v3.nc", "size": 18422, "mtime": 1781000000 } ] }
```
(On an unreachable controller it carries `"files": []` + an `"error"` string instead of failing.)

**`commands/<cmdId>.json`** — `{ "op": "delete", "target": "old.nc" }`. fairy LISTs `commands/`, runs each,
then deletes it (processed once, good or bad — a poisoned command can't wedge the loop). After any change
it republishes `cncdisk/index.json`, so the file vanishing from the listing is the web app's confirmation.

**Safety (enforced on fairy — this is the only web→controller action):**
- **Op allowlist = `{delete}` only.** Never an op that runs/starts G-code. Reject anything else.
- **`target` must be a bare filename that already exists** on CNCDISK — no path separators, no traversal.
- fairy stays outbound-only (it *polls* `commands/`); the **web Worker's token gates who can write**
  `commands/`. fairy logs every command it executes.
- Proven live on the V4.1 (2026-06-07): list + traversal-refused + safe delete.
