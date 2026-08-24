# TRANSPORT — the gateway listens on every road at once

**Status: SPEC FOR REVIEW. Nothing here is built.** Written 2026-08-24 after a live diagnosis; the human asked
for the design to be read and argued before a line changes, because this is the transport layer for a machine
that cuts metal.

Every claim below is marked **OBSERVED** (read in the code or measured on this machine) or **INFERRED**.

---

## 1. WHAT HAPPENED

The human ran the gateway on their PC and opened Studio on their phone. Both sign into the same Google account;
the workspace files have the same name. The phone said:

> Studio cannot see a gateway for this machine on your Drive

**OBSERVED — the cause:**

- `config.py:14` — `backend: str = "local"`, whose own comment reads `"local" (test) | "r2" (dev's bucket) |
  "drive" (user's own Drive)`. **The shipped default is the transport its own comment calls a test fixture.**
- `bridge.py:37-41` — `_publish_heartbeat()` builds the payload then calls `backend.put_heartbeat(hb)`, so
  **presence is published wherever JOBS go.**
- `local_folder.py:98-102` — that writes `<root>/gateway/heartbeat.json`, a file only that PC can read.
- `H:\My Drive\DDCS Bridge` is **empty** (`total 0`), which is what the phone correctly reported.
- Three separate `_bridge_data` roots exist on this machine (`ddcs-pc-bridge/bridge-app/`,
  `ddcs-studio-project/`, `Downloads/`) because `config.py:15` sets `local_root = "./_bridge_data"` —
  **relative to the working directory**, so the job store depends on how the app was launched.

⇒ Nothing was broken. **The two ends were on different roads, and nothing said so.**

---

## 2. ⭐ THE HUMAN'S TWO CUTS, WHICH ARE THE DESIGN

> *"the heart beat is never local"* — and — *"gateway send is local but its also always cloud enabled"*

**A heartbeat is not a job.** It is a presence announcement, and announcing presence into a folder only you can
read is definitionally pointless. On one-box nobody needs one at all — Studio reaches the gateway over
`localhost:8765`.

**And sending is not either/or.** A gateway should listen on every road available to it. Then:

| | today | after |
|---|---|---|
| one-box, no account | works | works, unchanged, no account needed |
| phone + PC | **silently impossible** | works |
| both | pick one, lose the other | both |

⭐ **The setting disappears.** "Use Drive" stops being a transport switch and becomes what it always was — an
auth action, *Connect Google Drive*. Nobody has to learn the word "backend", and the human's original failure
**cannot recur, because there is no wrong setting to be in.**

### ⭐ RULED — the toggle IS the login

Human, 2026-08-24: *"the toggle become the login conmection."*

⇒ There is **no Use-Drive checkbox at all**. One control: **Connect / Disconnect Google Drive**.
**Connected = the cloud road is open. Disconnected = local only.** Nothing else expresses the choice, and
nothing can disagree with it.

⛔ Do NOT keep the checkbox "for explicitness" or ship it disabled. Two controls for one state is exactly the
two-homes divergence that produced the original bug: a signed-in account and a `backend` field that could
silently disagree about whether the cloud road existed.

⚠ **Three consequences that follow, and each needs building deliberately:**

- **The connect button must say what it ENABLES, not just what it authenticates.** "Connect Google Drive" is an
  auth verb; the user is actually choosing *can other devices send to this machine*. The label and its hint
  carry that, or the setting is invisible again in a new way.
- **Disconnecting is now destructive-ish.** It closes a road jobs may be in flight on — which is open question
  §4 arriving from the other direction. Disconnect must state what it will do to in-flight remote jobs, and
  must not be a silent toggle.
- **Auth failure is now a transport outage.** A token expiring is no longer "cloud sending is unavailable", it
  is *this machine just became unreachable from every other device*. It has to be reported that way, on both
  ends, rather than as a login notice.

---

## 3. THE DESIGN — a fan-out facade

**OBSERVED:** everything already goes through ONE object from `make_backend(config)`, and that object has
exactly **13 methods** (`local_folder.py`). So this is a facade, not a rewrite.

```
MultiBackend — implements the same 13 methods, routes by KIND

  READS       list_inbox · list_statuses · list_history · list_commands
              → UNION across active transports, each item TAGGED with its origin

  WRITES      put_status · append_history · delete_job · clear_command
              → routed back to the transport the job CAME FROM

  BROADCAST   put_heartbeat · put_cncdisk_index
              → written to ALL shared transports

  PASSTHROUGH put_job · get_job · get_status
              → origin-addressed; see §4
```

⭐ **The heartbeat fix stops being a fix and becomes a consequence.** It lands in BROADCAST, so presence is
published wherever presence can be seen, with no special case. That is the test that the cut is in the right
place: the previous fix dissolves.

---

## 4. ⚠ THE REAL DESIGN WORK — a job must remember where it came from

Status has to return to whoever sent the job. A phone that sends through Drive and gets its status written to a
folder on the PC has been told nothing.

**OBSERVED:** every job already writes a `<job_id>.map.json` beside its `.nc` (`bridge.py:280`).
⇒ **Origin belongs in that file.** Durable across a gateway restart, no new file, no in-memory map to lose.

⛔ **Do NOT encode origin in the job id.** Ids appear in the UI, in history and in the human's own screenshots;
making them carry routing data means a rename or a copy silently reroutes a job's status.

⚠ **Open — needs a ruling before building:** what happens to a job whose origin transport has gone away
(Drive disconnected mid-run)? Candidates: write status locally and mark it undelivered; retry with backoff;
refuse. **This must be decided, not discovered.**

---

## 5. ⚠ COSTS AND OPEN QUESTIONS — argue these before building

1. **Drive polling costs quota.** `POLL_FLOOR_S` already exists for exactly this (`config.py` comment: the
   backend that knows its own quota declares it). **INFERRED:** a disconnected Drive should poll zero, not
   poll-and-fail.
2. **Two inboxes need an arrival-order rule.** There is already a queue; what is undefined is how two jobs
   arriving in the same tick order themselves. State the rule; do not let it emerge.
3. **`local_root` is relative and must stop being.** Three job stores on one machine is already the bug, and a
   fan-out makes "which folder" matter more, not less. Resolve against a fixed base.
4. ⚠ **Does a visible gateway imply a usable one?** Today invisibility at least matched impotence. Once
   presence is broadcast, a phone can see a gateway it cannot send to (Drive connected for presence, but the
   human has not signed the gateway in for jobs). ⇒ **The heartbeat payload already carries `backend`**
   (**OBSERVED:** `admin.js:114` renders `d.backend` from the descriptor, and `bridge.py:38` builds the
   heartbeat from `ops.descriptor()`), so the client can say exactly what is true. It must.
5. **Security is unexamined.** Two roads in means two attack surfaces for something that moves G-code to a
   machine. **INFERRED, needs a real answer:** what stops a job appearing in the inbox from a source the owner
   did not intend?

---

## 6. ⛔ WHAT THIS IS NOT

- **Not a reason to delete the local backend.** One-box (Studio and gateway on the same PC, no account, no
  network) is a permanent supported setup and a local folder is exactly right for it.
- **Not a change of default.** The default stops mattering, which is better than changing it.
- **Not related to the machine-identity bug**, which is separate and still open: the gateway link keys on
  `fileSavedStem()` — the `.ddcs` **filename** (**OBSERVED:** `send.js:155`, `driveJobs.js:202`). Rename the
  workspace file and the link silently dies. A machine's identity should be the `machine` row that already
  travels inside the `.ddcs`, not what the file happens to be called.

---

## 7. VERIFY

- a job sent from the phone runs, and its status appears **on the phone**
- a job sent from the PC runs with Drive connected, and status appears **on the PC**
- one-box with no account: unchanged, and **no Drive polling happens at all**
- the gateway is visible from the phone while jobs are local, and the phone **says so** rather than offering a
  send that cannot work
- kill Drive mid-run and observe what §4's open question was ruled to do
- ⚠ **on the human's real two-device setup**, not only in a harness — this failure was invisible to every test
  in the suite
