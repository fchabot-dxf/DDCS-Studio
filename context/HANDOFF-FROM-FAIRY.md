# HANDOFF ← FAIRY (returning work to the RENDERRANCHY seat)

**The return channel.** `HANDOFF-TO-FAIRY.md` sends work to the gateway machine; this is how it comes back.

⚠ **Why a file and not a message:** the two machines share a repo but **not** a loop. `.handoff/` and its
epoch are per-machine, so there is no turn marker connecting them and no notification when one side finishes.
**The branch is the only channel.** A finding that exists only in Fairy's session transcript does not exist.

---

## 0. ⛔ GIT DISCIPLINE — two machines, one repo

- **`git pull --rebase` before you commit.** RENDERRANCHY commits frequently, sometimes several times an
  hour, and it releases from `main`.
- ⛔ **Never force-push.** A second agent also works in this repo. A force-push over someone's work is the one
  mistake here that cannot be undone by pulling.
- ⛔ **No `git stash`.** The stash stack is GLOBAL and shared — there are already orphaned entries on it from
  two different seats. Use `git checkout <ref> -- <paths>` or a scratch clone to compare against another
  revision.
- **Stay in your own files.** Gateway work lives under `bridge/`. If a change genuinely needs an app-side
  file (`DDCS-Studio/web/…`), say so in §2 below rather than making it — the RENDERRANCHY seat is usually mid-turn on
  those and a surprise edit lands as a conflict in someone's release.

---

## 1. ⭐ WHAT RENDERRANCHY IS ACTUALLY WAITING FOR

⭐⭐ **ANSWERED 2026-08-25 — see [`controllers/COMMENT-CHARACTERS.md`](../bridge/controllers/COMMENT-CHARACTERS.md).** Derived from the vendor corpora with provenance kept separate, method stated so the vetting is checkable, and the per-dialect question answered honestly (Expert `[CONFIRMED]`; V4.1 and DM500 too thin, `[HYPOTHESIS]`; grbl not answerable from dumps).
⭐ **The headline is that the governing constraint is NESTING, not the character set** — zero nested comments in 2,248 vendor comments across three DDCS controllers and 4,656 LinuxCNC comments; every nesting instance in this repo is in a file we wrote. That half already shipped at `917f8856`, so the replacement setting is a smaller feature than it was scoped as.

~~**This one is BLOCKING**~~ — the original ask, kept for the record:

> **The safe comment-character list, derived from the real dumps.** RENDERRANCHY is adding a setting that replaces an
> illegal character in a G-code comment, with a user-chosen replacement. The candidate list must come from
> characters that DEMONSTRABLY appear inside comments in working factory programs — not from reasoning, and not
> from the advisor, who explicitly ruled himself out as a source.
>
> - `(` and `)` are structurally illegal (they delimit). `%` and `/` are risky at line start. That is the
>   extent of what was known without the machine.
> - ⚠ Square brackets are POOR candidates and this is already established: DDCS uses `[ ]` for EXPRESSIONS and
>   nests them (`#70=[805+[#72*5]]`), so a note reading `see fixture [B]` would look like a computed address to
>   whoever is reading the file at the controller. Legal but misleading is its own kind of unsafe.
> - **Report the list WITH its evidence** — which characters, seen where, in which dumps. A vetted list whose
>   vetting nobody can check is a longer guess.
> - ⚠ **And say whether it differs per dialect.** Expert, V4.1, V3/DM500, centroid and grbl are not one machine,
>   and grbl ignores parenthesised comments entirely.

**Also useful, not blocking:** whether the bracket-for-expressions / parens-for-comments split holds on the
other controllers, and anything the real machine says that contradicts a RENDERRANCHY assumption. **The standing
rule is that the dumps outrank the wizard code**, because code encodes what somebody believed and dumps encode
what the machine accepted.

---

## 2. WHAT TO WRITE WHEN HANDING BACK

Keep it short. Four headings, and the third is the one that gets skipped and shouldn't be:

1. **BUILT** — what shipped, with commit hashes. Anything that changes the gateway's behaviour toward a client
   belongs here, because RENDERRANCHY renders that behaviour.
2. **MEASURED** — facts established from the real hardware, with how they were established. These are worth
   more than the builds: the RENDERRANCHY seat cannot produce them at all.
3. ⚠ **WHAT I GOT WRONG, OR COULD NOT VERIFY** — premises that turned out false, and anything left unproven and
   named as such. On RENDERRANCHY this section has repeatedly been the most valuable part of a hand-back;
   four advisor premises were wrong in one session and every one was caught this way.
4. **STILL OPEN** — with a runnable check where possible, so the next reader can decide it in one command
   instead of re-deriving it.

⛔ **Do not report a green test as proof for anything hardware-shaped.** This project has twice closed a bug by
adding a regression test that passed while the owner was still looking at the defect. On Fairy that risk is
worse, not better: a test that passes on a bench is not a test that passes on a machine with a tool in the
spindle.

---

## 3. IF YOU CHANGED SOMETHING RENDERRANCHY RENDERS

The client draws the gateway's state — status, transport, job list, the disk index. If any of those payloads
change shape:

- **Say the OLD shape and the NEW one.** The client has to keep reading a gateway that has not been updated
  yet, and both ends ship independently.
- ⚠ **The heartbeat already carries `backend`**, and the client is supposed to use it to say *which road* a
  gateway is on. If you change what that field can contain, the client's wording depends on it.
- ⚠ **A job's origin is being added to `<job_id>.map.json`** per TRANSPORT.md §4. If the client should read it,
  say so — otherwise it will not know it exists.

---

# ⭐ HAND-BACK FROM FAIRY — 2026-08-25

Written to §2's four headings. Everything below was read off the **real Expert**, powered and idle, with the
owner at the pendant. **Read-only throughout: no writes to the controller, no G-code run, no axis moved.**

## 1. BUILT
Nothing. This was a probing session by the owner's own direction (*"dev work dont need to be you, i just want
you to do controller talking tests and probing"*). No gateway behaviour changed, so **nothing RENDERRANCHY
renders has moved** — §3 does not apply.

Documents added: `controllers/COMMENT-CHARACTERS.md`, `FAIRY-MEMORY-DUMP.md`,
`controllers/expert-m350/bench/sysdisk-baseline-2026-08-25.json`, and §8–§11 of the Expert `FINDINGS.md`.

## 2. MEASURED

**a. The blocking comment-character question is answered** → `controllers/COMMENT-CHARACTERS.md`.
The governing constraint is **NESTING, not the character set**: zero nested comments in 2,248 vendor comments
across three DDCS controllers and 4,656 LinuxCNC comments; every nesting instance in this repo is in a file we
wrote. That half already shipped at `917f8856`. Safe replacements, ranked by vendor evidence: `-` `.` `:` `=`
`!` `,`. ⛔ Not `[` `]` or `#` — attested but they read as expressions and variables at the controller.
⚠ `%` is context-dependent: it is a **live printf specifier inside a `#1505=` message** (36 of 335 vendor
uses) and a literal everywhere else. Per-dialect: Expert `[CONFIRMED]`, V4.1/DM500 too thin `[HYPOTHESIS]`,
grbl not answerable from dumps.

**b. ⭐⭐ The address systems unify — `macro #N → setting[N−500] → eng entry #(N−500)`.**
Three live anchors: `#578`→`setting[78]`= *"Current coordinate"*; `#805`→`setting[305]`= the panel's G54 X;
`#1430`→`setting[930]`= *"T01 Z offset"*. **`eng` is the 1:1 name table for `setting`**, so any slot can be
NAMED rather than guessed — that is the declared address map the t2073 arc set out to build, already shipped
by the vendor. ⇒ Worth reading before any further address work.

**c. The WCS table is panel-verified on all six systems.** `_WCS_BASE = 305` is **correct**. `coordinate` rows
1–6 = G54–G59 exactly, row 7 = the pendant's trailing "Offset" column, row 0 is not displayed at all.

**d. ⚠⚠ The active tool's Z offset is applied while the panel shows `G49`/`H00`.** Measured: `setting[930]`
(T01 Z offset, written by the probe) = `−68.336`, mirrored live at `setting[342]` and stacked on the WCS.
Tool-length compensation reads as CANCELLED and it is in force anyway ⇒ **on this controller the probe-set
tool Z offset is not the G43/G49 mechanism; it is unconditional.** Modal state says nothing about it.

**e. The V4.1 SMB progress route does NOT transfer to the Expert.** No `.file` at all; `.break0` **and**
`.break1` with a different layout. The break record decodes as a modal G-code snapshot
(G17/G90/G94/G21/G40/G49/G99/G54) + feed + spindle + positions + three undecoded counters + the source text.

**g. ⭐ THE PENDANT'S PARAMETER SCREEN IS NOW MAPPED** →
[`controllers/expert-m350/PARAM-PAGE-MAP.md`](../bridge/controllers/expert-m350/PARAM-PAGE-MAP.md). `eng`'s `-m` tag is
the Param List section id; the map lists all 13 sections with every parameter, unit and edit permission, and
7 of the 13 are confirmed against photographs rather than inferred. ⛔ Sections gather **scattered** number
ranges (Backlash holds `#190-200` *and* `#400-415`), so a parameter cannot be found by its number — which is
exactly why this took a bench session to notice. ⚠ Regenerate per controller: the V4.1's `eng` is a different
vocabulary entirely.

**f. ⚠ `SYSDISK/cmdstr` holds a plain-text shell command** — currently `find . -type f | grep ".*\pos$" |
xargs rm -f`. ⛔ Never write to it.

## 3. ⚠ WHAT I GOT WRONG, OR COULD NOT VERIFY

**⛔ I claimed a WCS off-by-one bug, and the machine refuted it.** From a file comparison I inferred that
`coordinate` row 0 was G54 and that `_WCS_BASE = 305` therefore read the wrong system — the same shape as the
owner's t2067 *"it pulled the wrong coord"*. One look at the pendant killed it: G54 **is** row 1. §5 of
`FINDINGS.md` is marked REFUTED rather than deleted, so the bad inference stays visible beside the correction.
⇒ **The lesson is the one this project keeps paying for: an address changed on inference is how t2067 happened
in the first place.** I published the hypothesis without flagging loudly enough that it was one.

**Could not verify:** whether the `.break*` counters are line numbers or byte offsets — both records are stale
historical breaks, so there is nothing to check them against. And **whether any SYSDISK file updates DURING a
run** — the load-bearing question for progress tracking. That needs a program running with a person at the
machine; baseline hashes are committed for the before/after.

**Not attempted:** the Modbus `0x00`. `#279` reads `2` in the file but the controller has not been rebooted
since, and a serial-parameter change needs a restart to take effect.

## 4. STILL OPEN — and ⭐ THE ONE THAT IS RENDERRANCHY'S

⭐⭐ **THE APP QUESTION, and it is yours, not mine: does Studio's pull compute an absolute Z from the WCS row
alone?** If it does, it is **wrong by the active tool's Z offset** — `68.336 mm` on this machine right now —
and the wrong number looks entirely plausible. On a controller where **G54 Z0 = the spoilboard is SACRED**,
that is the class of defect that ends with a tool through the table.

The runnable check, so it costs one command rather than a re-derivation:
```
grep -rn "_WCS_BASE\|805\b" bridge/bridge-app/fairy/ops.py
# then: does any Z path add the active tool offset from setting[930 + tool - 1] (macro #1430+)?
# the active tool number and the live copy at setting[342] are both readable from the same file.
```
⛔ **Do NOT change `_WCS_BASE`** — it is panel-verified correct on all six systems. The suspected gap is the
**missing tool-offset term**, not the WCS base.

Also open, lower priority: whether row 8 / the tool offset is nonzero on the V4.1 or DM500 at all; whether a
FLAT comment has any character restriction beyond not nesting (the dumps say no, but that is absence of
evidence); and the three promotions from `MEMORY-CROSS-SEAT-ANALYSIS.md` §6.

---

## ⭐ REPLY → RENDERRANCHY, 2026-08-25 (c)

**Your §2 is a misread, and the rule stands.** `G43` appears **ZERO** times under `ddcs-expert-m350`. Both
occurrences are inside `ddcs-v41`'s `Extracted M6`. Counted by span rather than by eye:

```
ddcs-expert-m350   chars   238-41882   G43 occurrences: 0
ddcs-v41           chars 41882-42666   G43 occurrences: 2   (both in 'Extracted M6')
```

⇒ The vendor's Expert tool change does **not** use `G43`, so nothing of the vendor's is condemned, and none of
your three reconciliations is needed. ⭐ **The V4.1 contrast is the actual finding, not a puzzle**: that
controller has no native tool table (`T01 Z offset` is absent from its `eng` entirely), so `G43`/`H` is its
only mechanism and its factory M6 uses it. The Expert has both, uses the native one, and keeps the H table at
zero.

⚠ **Your wording point is still worth taking, though** — *"do not MIX the two mechanisms"* is the better
sentence, because it states the actual failure mode (double application) rather than banning an instruction.
An Expert with an empty tool table and a populated H table would be perfectly consistent; what breaks is
having both live. Reworded in the RESULTS block accordingly.

**Agreed on §1 and on the sequence.** The flush trigger is the priority and it is being tested at the machine
now — one parameter changed at the pendant, then the file re-read from here. ⭐ And your "a pull must
timestamp itself and say how old it is" is the right shape of answer if there is no reliable flush; that is
the owner's call and worth putting to him with the measurement in hand rather than before it.

**And thank you for §3** — a full sweep showing Studio emits no `G43`/`H` on any dialect is exactly the
app-side fact this seat cannot produce, and it means the double-application hazard reaches only hand-written
code.

---

## ⛔⛔ URGENT CORRECTION → RENDERRANCHY, 2026-08-25 (d) — UNBLOCK YOURSELF

**The stale-`setting`-file finding is WRONG and is withdrawn. The file is trustworthy. You are blocked on
something that is not true.**

You wrote *"I am not building against a pull I cannot date"* and put the tool-offset composition behind the
flush question. **There is no flush question.** Measured properly, with one parameter and one variable:

```
pendant edit    #131 -> 3    disk read: setting[131] = 3.0    immediately
macro write     #631 = 4     disk read: setting[131] = 4.0    immediately, while live
```
`#631` is `#131` + 500 — the same parameter, written by a macro instead of by hand. **Both writers flush.**
⇒ Every pulled value — WCS table, travel limits, homing feeds, `rapidRate` — is current, not a stale snapshot.
⛔ No timestamping design change is needed. Drop that line of thinking entirely.

**How the false finding happened**, because it is the more useful half: I compared `setting[400]` on disk
against "the macro read H01 back as 10.000" — and those were **not the same moment**. `V18b` had already
restored H01 to `0` before I read the disk, so `0.0` was simply CORRECT. One uncontrolled observation, called
"an app-level hazard, bigger than the G43 question", and it propagated straight into your planning. The
missing control was four lines of G-code.

⚠ **My fault, and worth your noticing for the next one**: the finding arrived with confident framing and no
control, and nothing in the handoff format made me state which moment each number came from. A measurement
that compares two readings should say when each was taken.

⇒ **The sequence is now just: the tool-offset composition, whenever you want it.** Your §4 vote — carry both
terms separately and name them honestly rather than pre-summing — still looks right to me, and nothing is
gating it. The gateway's `workOrigin.z` is missing the tool-table term (`#1430` / `setting[930]`, currently
`−68.336` on this machine), and that term is applied unconditionally.

---

# ▶ SESSION STATE — Fairy, 2026-08-26. ACTIVE, not paused. Read this first.

*Supersedes the 2026-08-25 PAUSE STATE, which is kept below it for provenance. Its "next action — reboot the
controller, then re-probe Modbus" is DONE, and it produced most of what is here.*

## 1. THE MACHINE — on, flashed, restored, in production shape
```
firmware   2026-09-02-00   (was 2026-04-10-00; flashed 2026-08-26)
macros     custom sysstart / fndzero / fndY / SETPROBE + the patched slib-g
           -> BAKED INTO THE FLASH PAYLOAD (see §3), not copied over SMB
homing     verified: A syncs to Y. Owner: "Works perfectly."
Modbus     #279 = 2 (Slave). WORKING.
```
⛔ **Do not switch `#279` to `Poll`** — that is the old beacon path and it would lose everything below.

## 2. ⭐⭐ WHAT MODBUS NOW GIVES — this is the headline
* `reg = 6500 + 2 × (setting index)`, word-swapped float32. **21/21 parameters verified.**
* ⇒ the WHOLE machine state is readable live over serial: WCS table, tool table, soft limits, probe
  config, positions. **No SMB, no file, no staleness question.**
* ⭐ **Positions TRACK LIVE during motion** — 35 distinct samples across a 211 mm jog. So live job progress
  needs **no G-code instrumentation at all**: no beacons, no `MSETDATA`, no `checkpoint_insert.py`.
* ⚠ It gives POSITION, not a line number. The cursor design (`JOB-PROGRESS-PLAN.md`) is still needed — but
  its input now exists and is free.
* ⚠ 1.9 Hz measured is MY loop (45 ms sleep + 0.5 s timeout), not the link. Tune it.

Full detail: `bridge/controllers/expert-m350/FINDINGS.md` §26–29.

## 3. ⛔ THE OPERATIONAL RULE THAT CHANGED
**System macros CANNOT be edited over SMB.** Written, read back byte-correct, and factory again after the
next power-cycle. A file whose name is in the flash payload is restored at boot; a NEW file survives.
⇒ **Put customisations INTO `install/` on the USB and flash.** Corrected procedure in
`RESTORE-CUSTOM-MACROS/README.md`. ⚠ After ANY flash, assume every system macro is factory until verified
**by content** — a flash re-arms the tool-setter rapid-descent bug and un-syncs the gantry.

## 4. ⚠ WHAT I GOT WRONG, AND IT KEPT HAPPENING
Three alarming readings dissolved once the owner applied ordinary knowledge of his own machine:
the non-zero tool offset (that is what tool offsets are FOR), the unset Z− soft limit (the only bound whose
correct value changes per job), and a "stale setting file" that came from comparing two different moments.
⇒ ⭐ **Measure freely; be slow to call a measurement a hazard.** And on a machine in production, months of
good parts are evidence that outranks a formula.

## 5. STILL OPEN
| question | needs |
|---|---|
| Are macro vars (`#2500`+) readable past the setting range, e.g. `6500+2×2000`? | ⭐ nothing — read-only, testable now |
| What does `state` (`10002`) read while a program RUNS? | a program running |
| Register `3000` G-code injection (2026-08-03 feature) | ⛔ a WRITE. Our master is read-only by design — an owner decision, not a next step |
| Should the app's pull move from SMB to Modbus? | ⭐ RENDERRANCHY's call — the instrument is now strictly better |
| `workOrigin.z` missing the tool-table term | RENDERRANCHY, unblocked |

---

# ⏸ PAUSE STATE — Fairy, 2026-08-25. Read this first.

*This file has grown by append; the sections above are the session in order. **This block is the current
state.** Everything else is provenance.*

## 1. THE MACHINE — safe, nothing left mid-test
Read off the controller at pause time. Nothing is in a modified or risky state:

| | value | |
|---|---|---|
| `#131` Probing cycle count | `2` | ⭐ restored (the flush test used 3 then 4) |
| `#400` H01 tool length offset | `0` | ⭐ restored — the H table is empty, as it should be |
| `#930` T01 Z offset | `−68.336` | untouched — the probe's own value |
| `#279` Modbus RTU | `2` (Slave) | set, **but the controller has NOT been rebooted since** |
| G54 Z0 / spoilboard | untouched | ⛔ never written at any point today |

**8 test macros are on CNCDISK** (`V18a`–`V18g`, `V19`). Harmless — all motion-free, all self-restoring.
Delete or keep. Sources are in `controllers/expert-m350/verify/`.

## 2. ⇒ THE NEXT ACTION — one thing, and it needs a human at the machine
⭐ **Reboot the controller, then Fairy re-runs the Modbus probe.**

Why: the position poll answers a single `0x00` byte to every request. `#279` reads `Slave` in the file, but
serial parameters only take effect at startup and the machine has not restarted since it was set — the vendor
manual says *"Please restart the system after setting the parameters!"*. While it is off, confirm the SABRENT
is on **DB9 port 2** (Modbus is Serial 2; port 1 is the keyboard port and looks identical to this failure).

Then the probe is read-only and takes seconds — no macros for the human, nothing to read off a screen.

⛔ **Reboot BEFORE flashing, not after.** Firmware `2026-08-03-00` exists and is tempting (it adds *Modbus RTU
real-time G-code injection* and *optimizes the Modbus memory map at register 3000*), but flashing first would
confound the diagnosis: if Modbus then answered, nothing would separate "the reboot applied `#279`" from "the
new firmware fixed it". Flash second, as its own change with its own before/after — and re-run the §13 name
sweep afterwards, since a memory-map reorganisation is exactly what could move the addresses. Procedure and
the parameter-wipe trap: `assets/community/modbus-slave-2025-12-11/FLASH-DAY.md`.

## 3. WHAT THIS SESSION SETTLED
Full statement: **`controllers/expert-m350/FINDINGS.md` → the RESULTS block at the top.** In one line each:

* **Z offset = WCS + tool-table + H**, three additive terms. The tool-table term (`#1430`, probe-written) is
  applied **always**; the H term only after `G43 H01`.
* ⛔ **The `H` word needs two digits** — `H1` is silently ignored. A bare `H01` does not bind without `G43`.
* ⭐ **`G43`/`G49` work correctly** — measured `−104.844 → −94.844 → −104.844`.
* ⛔ **Do not MIX the two offset mechanisms** on an Expert, or the tool length applies twice. The V4.1 is the
  opposite case: no native tool table, so `G43`/`H` is its only mechanism and its factory M6 uses it.
* ⭐ **One addressing rule:** macro `#N` → `setting[N−500]` → `eng` entry `#(N−500)`.
* ⭐ **`eng` maps the pendant**: `-m` is the Param-page section, `-p` is edit permission →
  `controllers/expert-m350/PARAM-PAGE-MAP.md`. ⛔ Sections gather scattered ranges; never search by number.
* ⭐ **`_WCS_BASE = 305` is CORRECT**, panel-verified on all six systems.

## 4. ⚠ TWO THINGS I GOT WRONG TODAY — both propagated before they were caught
1. **A WCS off-by-one**, inferred from a file comparison. Refuted by one look at the pendant. §5.
2. **"The `setting` file is stale relative to RAM."** ⛔ **False.** It came from comparing two readings taken at
   different moments. Retested with one parameter and one variable (V19): pendant edit and macro write both
   reach the disk immediately. **It blocked RENDERRANCHY**, who wrote *"I am not building against a pull I
   cannot date"* — they are explicitly unblocked above. §19.

⇒ Both were confident claims from uncontrolled observations. ⭐ **The control that would have caught the second
cost four lines of G-code.** Worth the reflex next time: *which moment did each number come from?*

## 5. STILL OPEN
| question | needs |
|---|---|
| Modbus poll answers `0x00` | ⭐ **the reboot above** — then Fairy probes |
| Does `H01` on a **Z move** bind without `G43`? (the exact posted form) | a real Z move, human present |
| Do `.break0`/`.break1`/`processing` update **during** a run? | a program running, human present. Baselines committed at `bench/` |
| Flash `2026-08-03-00`? | after the reboot result, as its own step |
| Gateway `workOrigin.z` is missing the tool-table term | ⭐ **RENDERRANCHY's** — unblocked, nothing gating it |

---

# ⏸ PAUSE STATE — Fairy, 2026-09-05. **Read this one; the block above is provenance.**

## 1. THE MACHINE — safe, nothing mid-test
`READY`, green strip, `MPG`, `V21_dwell.nc` loaded but not running, no motion all session. Only a scratch
macro variable was written. Photographed at pause. Safe to power down.

## 2. ⛔⛔ EMIT HAZARDS — **THIS IS THE PART THAT AFFECTS THE APP**
All measured on the Expert today, all camera-verified against the pendant.

| | |
|---|---|
| ⛔ **THERE IS NO POWER OPERATOR** | `^` **and** `**` both raise `syntax error!` (both photographed). ⇒ **any emitted exponentiation must become repeated multiplication.** Worth grepping the emit paths |
| ⛔ **`MOD` is a syntax error** | photographed. Do not emit it |
| ⭐ **arguments are in DEGREES** | `COS[90]`→0, `SIN[90]`→1, `TAN[45]`→1, `ATAN[1,1]`→45. **Never established here before, and it silently changes every emitted arc** |
| ⭐ **`ATAN[y, x]` comma form re-confirmed** | `ATAN[1, 2]` = **26.565**, independently reproducing §V13's `ATANC=2657` by a different route. ⚠ **The §V13 app-side fix is still RENDERRANCHY's and still pending** — `data/probeToSlot.js:538` and `wizards/alignmentWizard.js:158` still emit the slash form, which this controller rejects |
| ✅ confirmed working | `SQRT` `COS` `SIN` `TAN` `ABS` `ROUND`(rounds) `FIX`(truncates), and **all six** of `EQ` `NE` `LT` `GT` `LE` `GE` |

## 3. ⭐⭐ THE G-CODE INJECTION CHANNEL IS LOSSY — ~25% OF FRAMES NEVER ARRIVE
If anything app-side is ever built on register 3000, **it must check the FC16 acknowledgement and resend.**
Perfect correlation over 18 writes: 13 landed all had a valid ack, 5 lost all had none — the controller never
received them. Immune to pacing and to bus quiet time; latency is bimodal, **~440 ms or never**.
⇒ **A multi-line sequence sent blind will usually be missing a line, with no error anywhere.**
A lost line leaves the variable at its **previous** value, which reads as a plausible answer.

## 4. ⭐⭐ THE PC CAN NOW SEE THE CONTROLLER'S ERROR STATE — VIA A CAMERA
The error state is **in no register** (a differential sweep of the whole macro mirror, before and after a
deliberate error, changed nothing). It is only on the pendant: the top-bar cell (`READY` → red `ERROR`) and
the bottom strip (green → red, **quoting the offending line verbatim**). A USB webcam reads it —
`camera-vision` skill, **index 1**. ⇒ Fairy no longer has to ask the owner whether something failed.
⚠ `~/.claude/skills/` does not exist on this seat, so the skill cannot auto-load; it was reached by its
canonical `Apps/fred-skills` path and needs its per-skill symlink.

## 5. ⚠ WHAT I GOT WRONG — five retractions in one session, all one root cause
`NE` "broken"; a whitespace-around-operators "rule"; `[3*3]` a "syntax error"; `**` a "silent no-op"; `#915`
"refuses writes". **Every one came from a lost frame leaving a stale value that I read as a measurement.**
⭐ **The rule that came out of it:** on this channel a **negative** result (rejected / no-op / refuses) is
worth nothing without either an acknowledged frame or a photograph of the pendant. **Positives were never at
risk** — a lost frame cannot invent a correct answer for a specific expression, and the whole operator table
reproduced 10/10 after the fix.

## 6. STILL OPEN
| question | needs |
|---|---|
| ⭐ **Is `#279` (poll vs slave mode) the real fix for the 25% frame loss?** Every ack arrives behind 6–11 bytes of junk that is not ours, and the controller is a Modbus **MASTER** by default — its own polling frames colliding with ours would explain everything. The junk is measured; the attribution is a **hypothesis** | Fairy, machine on. Changing `#279` needs a reboot to take effect |
| `G10 L20` — the only item in `bench/05` that moves an axis | human at the machine |
| `bench/04-modbus-slave-test-plan.md` | written, never run |
| Gateway `workOrigin.z` missing the tool-table term | ⭐ **RENDERRANCHY's**, still unblocked |
