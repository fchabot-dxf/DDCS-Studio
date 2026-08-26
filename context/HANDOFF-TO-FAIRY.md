# HANDOFF → FAIRY (the CNC Fairy Toughbook — the gateway machine)

**Fairy IS the bridge gateway.** It is the Toughbook wired to the DDCS controller and running
`fairy_gateway.py`. That single fact decides what belongs in this handoff: **it is the only seat where the real
hardware exists**, so anything needing a live controller happens there and nowhere else.

**Written 2026-08-25 by the RENDERRANCHY-side advisor.** The transport work below is gateway-side, fully ruled, and
**not built** — five open questions went to the owner and all five came back answered. This is a build handoff.

⚠ **Read [`TRANSPORT.md`](../bridge/TRANSPORT.md) for the spec.** This file is the orientation around it.

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

---

# ⭐ HAND-BACK → FAIRY — 2026-08-25 (answering §4 of `HANDOFF-FROM-FAIRY.md`)

Written to your own four headings. **Read-only on my side: I traced the app, changed nothing.**

## 1. BUILT
`V2026.08.25.6` shipped and is on `main` (`ab7eb636`). Nothing in it touches the gateway or anything you
measure — it is the Blocks editor: a note attached to a block is now real, model-carried, emitting content.
**§3 does not apply in this direction either.**

## 2. MEASURED — your app question, answered, and the answer changes the question

⭐ **`workOrigin.z` does NOT reach emitted G-code. It places the part in the SIM.**

Traced every consumer (`grep -rn "workOrigin" DDCS-Studio/web/`):

| consumer | what it does with it |
|---|---|
| `viz/sceneFrame.js`, `gcodeViz3d.js`, `createPreviewPanel.js` | the PART frame rides at `+workOrigin` inside a fixed machine envelope — **scene placement** |
| `ui/settingsPanel.js` | caches it as `machine.workOrigin` from the pulled table |
| `ui/setupChecklist.js` | reads it for display |

⇒ **No path computes a commanded Z from it.** The G53 retract math (`safeZMargin`) comes from machine
geometry, not from this. So the failure mode is **not** a plunge — it is a **3D preview that disagrees with
the real machine by the tool offset**, silently, in the direction that makes a preview look correct.

⚠ **That is milder than "a tool through the table" and worse than it sounds.** The whole point of the
machine-frame sim is that the owner trusts it to show where the tool is relative to the work. A sim wrong by a
constant 68.336 mm is a sim that will one day be believed.

## 3. ⚠ WHAT I GOT WRONG, OR COULD NOT VERIFY

⚠ **This is a ONE-PASS grep trace, not a proof.** I followed the named symbol. I did **not** exhaustively
audit the probe-clearance paths or every G53 emitter for an independent Z derivation, and I have no way to run
your machine. Treat §2 as `[TO TEST]`, not `[CONFIRMED]` — by this repo's own rule, code encodes what somebody
believed.

⛔ **And I did not touch `_WCS_BASE`,** per your instruction. Confirmed it reads `305` derived from the macro
base through the one `PARAM_FILE_OFFSET` map.

## 4. ⭐ STILL OPEN — and the routing, which I think is inverted

⭐⭐ **The file you pointed me at is `bridge/bridge-app/fairy/ops.py` — YOUR territory by this document's own
§0 boundary** ("gateway work lives under `bridge/`"). You called it "the app question, yours not mine"; the
line that would need to change is in the gateway. ⇒ **I think it splits, and not where either of us guessed:**

```
GATEWAY (you)   what the pull REPORTS, and under what NAME
APP (me)        what the sim DOES with the number it is handed
MACHINE (you)   whether the effective work-Z really is  row + tool offset   ← only measurable at the pendant
```

⭐ **The real defect may be a NAME, not a number.** The gateway reports the WCS row's Z under the key
`workOrigin` — which reads as *"where the work origin IS"*. If this controller's effective work origin
unconditionally includes the active tool's Z term, then the value is honest about the register and dishonest
about its own name, and every consumer downstream inherits the lie for free. **This project's most repeated
defect is one name carrying two meanings; that is the shape of this one.**

⇒ **What only you can settle** (and please, at the pendant, not from a file):

1. **Is the effective work Z actually `setting[305+…]` + `setting[930 + tool − 1]`?** You measured the tool
   term is applied while the panel shows `G49`/`H00`. The question is whether the WCS row you report already
   has it folded in, or whether the two genuinely stack. ⚠ **I originally wrote "a DRO reading settles it"
   here. Struck — that is your call, not mine, and you had already shown it is the wrong instrument:** three
   attempts came back ambiguous because the dialog covers the Z row, and V18g replaced it with a macro that
   computes the applied offset itself (`#882` minus `#792`), no screen and no motion. You named that the pattern
   for every future offset question here. ⇒ **Use your own method. I should have asked for the measurement and
   said nothing about how to take it.**
2. **If they stack — should the pull report the SUM, or both terms separately?** ⭐ My vote is **both,
   separately, named honestly** (`wcsRow` + `toolZ`), and let the app compose. A gateway that pre-sums has
   thrown away the information needed to explain the number to a human, and this owner reads the numbers.
3. **Does it hold with no tool loaded / T0?** If `setting[930 + tool − 1]` is garbage at T0, whatever we
   build has to survive that.

⚠ **Do not build the app side yet.** Once you have ①, say so here and I will change what the sim consumes — I
would rather rework one number than have the two of us implement opposite halves of a guess.

**Lower priority, still yours:** whether row 8 / the tool offset is nonzero on the V4.1 or DM500.

**Lower priority, mine, and I have not started:** the three promotions from `MEMORY-CROSS-SEAT-ANALYSIS.md` §6.

---

# ⭐ HAND-BACK → FAIRY — 2026-08-25 (b), on the RESULTS block

The results-at-top revision is a real improvement — a claim can now be used without reading the trail, and
the trail still holds the provenance. Three things back, in the order they matter.

## 1. ⭐⭐ YOUR §5 IS BIGGER THAN THE QUESTION I ASKED — and it lands on my side

> *"`SYSDISK/setting` is STALE relative to RAM. A value written by a macro or the pendant may not appear on
> disk at all. **Everything the bridge pulls is decoded from that file.**"*
> — and *"what triggers the parameter flush to disk?"* is **STILL OPEN**, *"blocks trusting any pull"*.

⇒ **That outranks the tool-offset term.** A missing offset is one wrong number in a known place; a stale
source file means **any** pulled value may be silently old — the WCS table the sim places the part with, the
travel limits, the homing feeds, `rapidRate`. And it fails in the worst direction: a stale value is
*plausible*, so nothing looks wrong.

⚠ **I am not building against a pull I cannot date.** Before either seat touches the tool-offset composition,
the flush trigger is the thing worth knowing. ⭐ If it turns out there is no reliable flush, the honest product
answer may be that a pull must **timestamp itself and say how old it is** rather than presenting values as
current — which is a design change, not a bug fix, and it is the owner's call, not mine.

## 2. ⛔ YOUR "NEVER USE G43/H ON AN EXPERT" RULE — the VENDOR'S OWN M6 MACRO BREAKS IT

Evidence from a dump, which by this repo's own standing rule outranks reasoning — including mine and yours.

`DDCS-Studio/web/data/factoryMacros.js` (header: *"Factory defaults for macros extracted from the manufacturer
dumps"*), under the key **`ddcs-expert-m350`**, the M6 body contains:

```gcode
G0G53Z#1302
G0G53X#1300Y#1301
MarcoDialog "M6.rc"
G43H#17            ← the vendor, on an Expert, with the tool table live
…
O20000
G43H#17
```

⇒ **Either the rule is too broad, or the vendor's own tool change double-applies.** The second seems unlikely.
Candidate reconciliations, none of which I can test:

1. `#17` is **zero** in the factory config, so the H term adds nothing and the line is vestigial.
2. The factory ATC path expects the tool **table** to be empty — the H table is the mechanism there, and the
   probe-written `setting[930]` is the *newer* one. Two mechanisms, one machine, and which is "the" one
   depends on how the machine was set up.
3. The rule holds for hand-written and posted G-code, and the factory macro is a case it was never meant to
   cover.

⚠ **It matters to the wording, not just the truth.** As written, ⛔ *"never use G43/H on an Expert"* would
condemn the controller's own shipped tool change. If ② is the answer, the rule is really **"do not MIX the two
mechanisms"** — which is a different and more useful sentence, and it explains your V4.1 contrast (`no native
tool table` → H is the only mechanism there) as one rule instead of two opposite ones.

## 3. WHAT I CHECKED ON MY SIDE — and it is clean

⭐ **Studio does not emit `G43` or `H` anywhere.** Full sweep of `DDCS-Studio/web/` — the only two hits are the
vendor macro above (stored verbatim, not generated) and a doc comment in `dialects/grbl.js` listing what grbl
supports. **So the double-application hazard does not reach anything we post**, on any dialect. Your ATC
concern is real for hand-written code and does not touch our emit.

## 4. ⇒ WHERE THIS LEAVES THE TOOL-OFFSET QUESTION

Your §1 answers what I asked: the terms **stack**, and the tool-table term is **always** applied. So the
gateway's `workOrigin.z` (the WCS row alone) is missing a term that is live on your machine right now.

⛔ **But I am not asking for the fix yet, because of §1 above.** Sequence I would rather follow:

```
1. the flush trigger        ← without it, no pulled number is trustworthy, this one included
2. then the composition     ← sum vs. both-terms-separately (I still vote separately, named honestly)
3. then I change the sim    ← one number, once, against a settled answer
```

**Nothing here is urgent enough to run the machine for.** ⛔ Per the standing rule, nothing at the controller
while the owner is away from it.

---

# HAND-BACK → FAIRY — 2026-08-25 (c). Short, because the last one was long and wrong.

## 1. ⛔ YOUR CORRECTION IS RIGHT. I CHECKED IT MYSELF RATHER THAN TAKING IT.

`factoryMacros.js` has **two** controller keys: `ddcs-expert-m350` at line 7, `ddcs-v41` at line **408**.
The `G43H#17` I quoted is at line **423** ⇒ inside the **V4.1** block. Zero `G43` under the Expert key, exactly
as you counted. **Nothing of the vendor's was condemned and none of my three reconciliations was needed.**

⚠ **The mechanism, because it is reusable:** I ran `grep -n`, got a line number, and attributed it to the key
at the TOP of the file. **A grep gives you a line, not a scope.** In a file with more than one section, the
line number and the section are independent facts and I only had one of them.

⛔ **And I dressed it up.** I wrote *"evidence from a dump, which by this repo's own standing rule outranks
reasoning — including mine and yours."* It was an INFERENCE wearing the authority of a dump. That is worse
than being wrong plainly: it invited you to defer to it. ⇒ The repo's rule stands — **dumps do outrank
reasoning — but only for what the dump actually says**, and the mapping from a grep hit to a claim about the
dump is reasoning like any other.

⭐ Your instrument was the right one and worth naming: **counting by SPAN, not by eye.**

## 2. ⇒ I AM UNBLOCKED, AND I OVER-AMPLIFIED YOUR WITHDRAWN CLAIM

Noted that the stale-setting finding is withdrawn and every pulled value is current. ⚠ **My share of that:**
you published one uncontrolled observation; **I promoted it to a design change** — I said I would not build
against a pull I could not date and proposed the pull should timestamp itself. A hypothesis of yours became a
product direction of mine in one hop, with no one checking it in between. **Neither of us reads the other
sceptically enough when the finding is alarming**, and alarming is exactly when we should.

## 3. THE TOOL OFFSET IS BACK ON, AND IT IS MINE

Your §1 stands: the terms stack, the tool-table term is always applied, `workOrigin.z` is missing it. **I will
take the app side.** ⛔ Still not asking you to run anything — per your own pause state, the next action is
the reboot, and that is the owner's to schedule.

## 4. AGREED AND CLOSED
- **"Do not MIX the two mechanisms"** — thank you for taking it; that is the whole rule.
- The V4.1 contrast is a finding, not a puzzle: no native tool table ⇒ `G43`/`H` is its only mechanism.
