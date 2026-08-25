# HANDOFF → FAIRY (the CNC Fairy Toughbook — the gateway machine)

**Fairy IS the bridge gateway.** It is the Toughbook wired to the DDCS controller and running
`fairy_gateway.py`. That single fact decides what belongs in this handoff: **it is the only seat where the real
hardware exists**, so anything needing a live controller happens there and nowhere else.

**Written 2026-08-25 by the RENDERRANCHY-side advisor.** The transport work below is gateway-side, fully ruled, and
**not built** — five open questions went to the owner and all five came back answered. This is a build handoff.

⚠ **Read [`TRANSPORT.md`](TRANSPORT.md) for the spec.** This file is the orientation around it.

---

## 0. BEFORE ANYTHING — the machine-switch mechanics

⛔ **THE LOOP STATE DOES NOT TRAVEL.** `.handoff/` and its epoch are per-machine. A session on Fairy starts a
**fresh** handoff loop; it does not inherit the turn counter from the RENDERRANCHY (the desk machine). Do not try to
reconcile the two — they are separate loops that happen to share a repo.

**What DOES travel is the branch**, and it is current as of this writing: everything is pushed to
`wizards-as-data-blocks` and to `main`, working tree clean. `git pull` and you have all of it.

⛔⛔ **AND THE SAFETY RULE THAT OUTRANKS EVERY TASK BELOW: this machine is connected to a real CNC.** No write
operations to the controller when the owner is not physically present. Reading state, reading the disk,
inspecting config — all fine. Anything that could move an axis or alter what a running job does is gated on a
person standing there. **A test that passes on a bench is not the same as a test that passes on a machine with
a tool in the spindle.**

---

## 0b. WHAT ONLY THIS SEAT CAN DO

The RENDERRANCHY (the desk machine) has no controller, so these have been deferred here rather than guessed at:

- **The whole transport verification** (§7) — a second device sending to a real gateway is the entire point,
  and the original failure was invisible to every test in the suite.
- **Anything reading the real controller** — the DDCS ground-truth rule is to verify against the machine and
  the factory dumps, not against wizard code that encodes assumptions.
- **Whether a comment character is actually safe in a `.nc`** — a RENDERRANCHY backlog item asked for the
  replacement-character list to be derived from real dumps rather than reasoning. That derivation belongs here.
- **The gateway's own config** — `backend`, the Drive connection, `local_root` — all live on this machine.

---

## 1. THE ONE-PARAGRAPH VERSION

The owner ran the gateway on their PC and opened Studio on their phone. Same Google account, same workspace
name. The phone said *"Studio cannot see a gateway for this machine on your Drive"* — and it was right.
`config.py:14` ships `backend: str = "local"`, whose own comment calls that transport a test fixture, and
`_publish_heartbeat()` publishes presence **wherever jobs go** — so on a local backend the gateway announces
itself into a folder only that PC can read. Nothing was broken. **The two ends were on different roads and
nothing said so.**

---

## 2. WHAT THE OWNER RULED — do not re-litigate these

| | ruling |
|---|---|
| **Heartbeat** | *"the heart beat is never local"* — presence is not a job. It goes where presence can be SEEN. |
| **Transports** | *"gateway send is local but its also always cloud enabled"* — listen on every road at once. Not either/or. |
| **The toggle** | *"the toggle become the login conmection"* — there is NO Use-Drive checkbox. Connect/Disconnect Google Drive IS the setting. |
| **Job whose road vanishes mid-run** | record status LOCALLY, mark UNDELIVERED, forward when the road reopens. Never lose the record of what a machine did. |
| **Arrival order** | FIFO by when the GATEWAY observed it, never by a timestamp inside the job. |
| **`local_root`** | resolve against a fixed base. ⛔ do NOT auto-merge the three existing `_bridge_data` folders. |
| **Visible-but-unusable** | the client MUST say which transport a gateway is on. The heartbeat already carries `backend`. |
| **Security** | *"dont worry about permissions at all"* — ruled OUT of scope, with its boundary recorded in TRANSPORT.md §5b. |

---

## 3. THE SHAPE — it is a facade, not a rewrite

**OBSERVED:** everything already passes through ONE object from `make_backend(config)`, with exactly **13
methods**. So "both roads at once" is a fan-out over an existing seam:

```
READS       union across transports, each item TAGGED with its origin
WRITES      routed back to the transport the job CAME FROM
BROADCAST   presence and the disk index → ALL shared transports
```

⭐ **The heartbeat fix then stops being a fix and becomes a consequence** — it lands in BROADCAST. When a
previous fix dissolves into the new structure, that is the sign the cut is in the right place.

⭐ **And the setting disappears rather than changing.** Connected ⇒ the cloud road is open. Nobody learns the
word "backend", and the owner's original failure cannot recur because there is no wrong setting to be in.

---

## 4. ⚠ THE REAL DESIGN WORK, AND THE TRAPS

**A job must remember where it came from**, or status returns to the wrong place. Every job already writes a
`<job_id>.map.json` beside its `.nc` — origin belongs there. ⛔ **NOT in the job id**: ids appear in the UI, in
history and in the owner's own screenshots, so a rename or copy would silently reroute status.

**Three traps, each recorded because it is not obvious:**

- ⛔ **`local` is NOT a legacy path to delete.** One-box — Studio and gateway on the same PC, no account, no
  network — is a permanent supported setup, and the local folder is the PRIMARY road for it. Under the fan-out
  it is used *regardless* of cloud state: same-machine jobs go local (instant, no quota), remote jobs go cloud.
  **Drive quota is then only ever spent on jobs that actually need to travel.**
- ⚠ **`local_root = "./_bridge_data"` is RELATIVE**, so the job store depends on the launch directory. Three
  such folders already exist on the owner's machine. A fan-out makes "which folder" matter more, not less.
- ⚠ **Auth failure becomes a transport outage.** Once login IS the setting, an expiring token is no longer
  "cloud sending unavailable" — it is *this machine just became unreachable from every other device*, and both
  ends must say so.

---

## 5. SEPARATE, STILL OPEN — the machine identity bug

**Not part of the transport work, and worth its own turn.** `readGatewayHeartbeat(fileSavedStem())` keys the
gateway link on the **`.ddcs` FILENAME** (`send.js:155`, `driveJobs.js:202`). Rename your workspace file and
the link silently dies; two devices with the same machine but differently-named files never see each other.

⇒ A machine's identity should be the `machine` row that already travels INSIDE the `.ddcs`
(`{name, controllerId}`, a declared `BACKUP_STORES` row), not what the file happens to be called. ⚠ That row
carries a NAME, not an id — so renaming the machine would break it too. A minted stable id is the real answer.

---

## 6. HOW THIS SEAT SHOULD WORK — what earned its keep on RENDERRANCHY

- **Verify the premise before building on it.** Four of the advisor's own premises were wrong this session and
  the worker caught every one by checking. A dispatch is a hypothesis, not an instruction.
- **Measure, don't reason.** Three separate jobs got SMALLER after measuring. The transport diagnosis itself
  came from `ls` on an empty folder, not from reading code.
- **Report before fixing when the question is "why".** Two turns of report-only produced better fixes than
  building would have.
- **Full suite when the change is shared.** It caught two silent defects in the undo work that inspection
  missed — an edit type that was being dropped entirely, and a race.
- **If a turn grows past its one job, stop and report.** That rule exists because the advisor once queued
  eleven amendments behind a single turn marker.

---

## 7. VERIFY — on the owner's REAL two-device setup

⚠ This failure was invisible to every test in the suite, and would have stayed invisible.

- a job sent from the phone runs, and its status appears **on the phone**
- a job sent from the PC with Drive connected: status appears **on the PC**
- one-box with no account: unchanged, and **zero Drive polling**
- the gateway is visible from the phone while jobs are local, and the phone **says so** rather than offering a
  send that cannot work
- kill Drive mid-run and observe what §5b ruling ① says should happen
