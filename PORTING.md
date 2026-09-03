# PORTING.md — the porting arc, tracked

> ⚠ **THE ARC WAS REFRAMED AT t1531 (scout t1530): "port the corpus" → "MAKE THE EVIDENCE EXECUTABLE".**
> Measurement inverted the premise. V4.1 is **already ported** — a full dialect module, one of exactly
> two `POST_VERIFIED` (hardware-verified) posts, touched by 54 specs, maintained continuously through
> the whole parametric arc. What is missing is the **instrument**: the dialect's confirmations live in
> code comments ("CONFIRMED against probe-fix.nc"), and **prose does not go red** — 0 of 91 tracked
> factory `.nc` macros are read by any spec, for any target. That is a smaller, safer, almost entirely
> offline arc than the one that was planned.

> The living progress record for **the porting arc** (the plan's arc 3, committed).
> Maintained by the **advisor** at each pass-back — read this file for "where is the port right now"
> without digging through HANDOFF/WORK-LOG. The in-repo *design* record (stages, gates, caps — as
> data) will live in the repo once the scout lands it; this file is the human-readable ledger.

**Order of targets:** DDCS **V4.1 FIRST** (maintenance-mode target, last firmware 2024-05-11),
then DM500/V3-class, then grbl-class (= unroll). Every parametric op ports once; wizards follow.
**Discipline:** per-target verify instruments; one PILOT op proven end-to-end (emit · sim ·
round-trip · verify) before any fleet port — the corner-gated-pilot rule.

**Scratch-var freedom is per-post, not global** (migrated from memory, t2585 — verified at HEAD `2f6f9149`).
`varMap`'s "grounded FREE" means only *Studio-emit-free* (zero references across every wizard/CAM emit + the
goldens) — it does not prove a var is free of the **target controller's own firmware macro locals**, and that
band differs per post. Concrete, already-hit case: the Expert's Hop-cap scratch (`#42`/`#43`, globally free in
`varMap`) is firmware-**unsafe** on V4.1, whose executable macros write `#0-148`; V4.1's own `safeHop` uses
`#190`/`#191` instead, native-vetted free in V4.1's `#149-489` band (`DDCS-Studio/web/wizards/dialects/ddcs-v41.js:33,43,47-48`).
Before baking a scratch var into a new per-post atom, verify it against **that** target's own documented
firmware-local band — the same standard already applied to V4.1 — not just `varMap`'s emit-scoped "free." The
risk is real only when a firmware macro (G31/M-code/subprogram) executes between the write and the read; pure
arithmetic/G0/G53 in between is safe, but picking a firmware-band-clear var is the belt-and-suspenders default
for anything safety-critical.

---

## Status: V4.1 ARC **CLOSED** (S1–S5) · DM500 stage 1 MEASURED (thin, not POST_VERIFIED) · S5 ran on real hardware

The scout's own stage plan, declared as data in `DDCS-Studio/web/data/portingArc.js` (the
`slotCapabilityArc` shape) and pinned by `tests/porting-arc-scout-1530.spec.js` (9 factual claims,
all green) so the design cannot rot before it is built.

| # | Stage | State | What it is |
|---|-------|-------|------------|
| 0 | Kickoff scout | ✅ **landed** t1530 | Inverted the premise. 5 forks parked, all ruled at t1531. |
| — | Design ruling | ✅ **landed** t1531 | See the ruling table below. |
| S1 | **Corpus oracle** | ✅ **landed** t1532 · V2026.08.02.3 | The 91 factory `.nc` macros become oracles *read at runtime* — following `controller-import-one-door-1221`, which already does this for the settings corpus (the existence proof: it is a known shape, not a new mechanism). Pilot **WCS zero-at-current** (already reproduces `zeroxy.nc`/`zeroz.nc` byte-for-byte), then **corner** as second subject. Plus the residue census (below). |
| S2 | Normalisation policy | ✅ **landed** t1534 | Factory G-code is **unspaced**, Studio emits **spaced**. ✅ **SETTLED t1531 — V4.1 accepts spaced** (user-attested). The oracle still compares normalised (the corpus is unspaced, so normalisation is what makes comparison possible), but the delta is an **answered** row, not an open question. S5 confirms it for free. |
| S3 | Caps completeness | ✅ **landed** t1534 | 3 caps live outside `DEFAULT_CAPS`, confirmed **latent not live** (every consumer truthy-tests; zero `=== false` comparisons). |
| S4 | Named unknowns | ✅ **landed** t1534 | `readActiveWcs` / `hmiPrompt` / ATC tables — all fold to `[]` honestly today. |
| S5 | Live round-trip | ✅ **ran** t1538/t1542 — see § "S5 — THE LIVE ROUND-TRIP" below | RAN on a real V4.1 bench unit. This row used to say "⏳ human-gated" after the run actually happened — a stale copy of a fact this file's own S5 section (and `portingArc.js`'s own `PORTING_STAGES['live-roundtrip'].landed` field) already stated correctly; t2012 fixed the table rather than re-derive it mechanically (no checker exists for this file, unlike `ARCHITECTURE.md`'s own test suite — building one is a bigger act than this fix). The section below is the one place with the full measured results; `portingArc.js` is the one machine-readable source. |
| — | DM500 stage 1 | ✅ **measured** t1536 · tier ruled t1537 | Same S1–S4 stages. **Guard:** rows carry their evidence tier on their face, and DM500 does **not** enter `POST_VERIFIED` on offline agreement alone. |
| — | grbl-class | ⏳ | **UNROLL** — confirmed against caps: grbl has no `#vars` at all; grblHAL's O-word flow cannot stream. |

## The t1531 rulings

| Fork | Ruled | Why |
|---|---|---|
| **arc-reframe** | **A — reframe to "make the evidence executable"** | Holding the port framing re-does finished work; widening to all 7 posts multiplies a mechanism never once run. **Condition:** the "already ported" claim itself must stop being prose — see the residue census. |
| **pilot-choice** | **A — WCS zero-at-current** | The corner-gated-pilot rule governed the *wizards-as-data* port, which is complete. A pilot for an **evidence instrument** must be an op that *has* evidence; corner has no factory file. Corner is S1's **second subject**, so op-richness is still proven early. |
| **spacing** | **A + ✅ SETTLED** — compare normalised; the delta is an **answered** row | ✅ **The user attested it t1531: V4.1 accepts spaced.** Evidence tier **user-attested** (stronger than an assumption, weaker than a captured bench trace — the `trigEvidence` tier discipline applied to a parser). Consequence, recorded so nobody re-opens it: **Studio's spaced emit is legal on V4.1**, so no act in this arc needs to consider emitting unspaced, and S5 confirms it for free rather than gating on it. |
| **a-axis-wcs** | **A for this arc + B as a real backlog item** | Not a V4.1 question (both dialects behave identically) — but the user runs a 4th axis, so it is a genuine gap, declared as data where a future act will find it. |
| **arc-order-after-v41** | **A — DM500 next, through the same stages** | The S1 instrument is the cheapest discriminator between "likely parametric" and "measured". Guarded by the `POST_VERIFIED` rule above. |

### The residue census (the condition on the reframe)

The scout's "the port is done" rested on a **sampled** residue — ~33 Expert-literal lines across 16
files, the sampled ones judged passthrough-semantics or gated absences rather than bypasses. A sample
is prose too. S1 turns it into a **census**: every line classified in data
(`passthrough-semantic` / `gated-absence` / `actual-bypass`) with the count **pinned**, so
*"already ported"* becomes a claim that can go red. Any actual bypass found **is** port work and
lands inside this arc.

## Cross-target floor (t1529 amendment, answered)

| Target | `#vars` | Expressions | `IF`/`WHILE` | Trig | Verdict |
|---|---|---|---|---|---|
| **DDCS Expert M350** | ✅ | ✅ | ✅ | COS/SIN attested; SQRT/ATAN community-referenced (V13-gated) | **parametric** — shipped |
| **DDCS V4.1** | ✅ | ✅ | ✅ | same shape as Expert | **parametric** — already ported, instrument pending |
| **DDCS V3 / DM500** | likely | likely | likely | same trig shape as V4.1 | **likely parametric, UNMEASURED** — 18-file installer tree vs V4.1's 209-file firmware+SMB capture. Named loudly. |
| **grbl / grblHAL** | ❌ none | — | O-word flow cannot stream | — | **UNROLL** (confirmed against caps, not re-derived) |

## The scout's four questions (t1529 dispatch)

1. **Branch peek** — `wizard-porting-work` @ 76348158 (predates the whole parametric arc):
   salvage vs superseded, disposition (cherry-pick / mine-for-design / archive-tag).
2. **Evidence floor** — what V4.1 ground truth exists in-repo (bridge/controllers/, community
   corpus, factory dumps) and what does NOT — the Expert arc ran on M350 dumps as its truth; V4.1's
   equivalent must be named, or its absence named LOUDLY. A verify instrument cannot be an assumption.
3. **Dialect delta as data** — variable bands, macro syntax, probing surface, caps: Expert→V4.1
   declared as a caps/post table the existing postGating reads, not prose.
4. **Arc-as-data + pilot** — stage structure the way `slotCapabilityArc.js` carried the slot arc;
   a nominated pilot op family with the argument for it.
5. **Cross-target breadth pass** _(added by amendment, user-driven)_ — ONE row per candidate target
   against the parametric FLOOR (`#vars` · expressions in coordinate words · `IF`/`WHILE` · trig+SQRT
   · free-register band), verdict **PARAMETRIC vs UNROLL**, every row tagged by evidence tier
   (attested dump / manual / community-referenced / unknown). Cheap and shallow on purpose — it exists
   so the **arc ORDER** is ruled on evidence rather than on the assumption that V3/DM500 is closest.
   An honest `unknown` beats a guess; name what would settle it.

### The parametric floor (why a target may or may not take the macros)

```
 has #vars + expressions in coord words + IF/WHILE ?
   YES → parametric ports; the delta is DIALECT (bands, syntax, feature subset)
   NO  → UNROLL: same toolpath, emitted as literal G-code computed at build time
 side conditions that SHAPE a port without blocking it:
   · no trig/SQRT      → geometry bakes at build (the V13-gate lesson: the slot's bearing baked)
   · small free band   → less can stay live on the pendant
```

Either way there is a floor: a controller that cannot do parametric still gets the **same toolpaths**,
just as fixed G-code rather than pendant-editable macros.

## Sizing expectation (advisor estimate, pre-scout)

Meaningfully smaller than the parametric arc — that arc *built* the machinery (envelopes, affine
frames, @work, freezes, bridges); this one *reuses* it. Rough guess: a quarter to a third of the
effort for V4.1, bounded properly by the scout. The two risks that could grow it: a weak V4.1
evidence floor, and a larger-than-expected dialect distance.

## Landed acts

_(newest at the bottom: turn · release · what landed · gate result)_

- **t1530** — _no release (scout, no product code)_ — the arc scouted as data (`portingArc.js`, 5 stages,
  5 forks) + 9 claims pinned by spec. **Inverted the arc's premise.** Branch `wizard-porting-work`
  found conclusively superseded (asserted against its own map, not sampled) → **archive-tagged
  `archive/wizard-porting-work` and deleted** (advisor, t1531). Scout spec green, smoke 71/71.
- **t1531** — _advisor ruling, no code_ — all 5 forks ruled (table above); arc renamed; residue-census
  condition attached; S1 dispatched. The **spacing fork settled the same turn** by user attestation.
- **t1532** — **V2026.08.02.3** — **S1 corpus oracle.** The factory `.nc` macros are oracles now:
  the pilot (WCS zero-at-current) reproduces `zeroxy.nc`/`zeroz.nc` **byte-exact**, `zeroall.nc`'s
  4th-axis gap asserted both directions; corner as second subject at **stated reduced fidelity** — its
  probe/move primitives byte-tested against `probe-float.nc`/`probe-fix.nc`, while its WCS-write step is
  asserted as a **checked structural difference** from `probe-vertex.nc` (same G92 semantic, different
  formula — Studio writes after retract, the factory writes at the trigger point) rather than skipped.
  **Residue census CLOSED**: all 33 Expert-literal lines individually traced to their consumer —
  8 passthrough (chased through every call site), 15 WCS-selector passthrough (confirmed inert by
  reading V4.1's own function body), 5 comment-only, 2 gated absences, 1 safe default, 2 in a function
  nothing imports. **Zero actual bypasses** — so "already ported" is now a claim that can go red.
  Scout `PREMISE 6` (asserting no factory oracle existed) went red the instant the oracle landed, exactly
  as designed, and was restated in the same act to name the oracle. Suite 2404/0; advisor gate 0 failed.

- **t1534** — **V2026.08.02.4** — **S2 + S3 + S4, the V4.1 offline arc CLOSED.** `V41_ORACLE_NORMALISATIONS`
  (built by reading what the oracle *actually* does — strip-CRLF, drop-blank-comment, collapse-whitespace,
  each with its evidence tier; two candidate normalisations **refused** and kept as a named export),
  `V41_NAMED_ABSENCES` (the `hmiPrompt` row corrected by reading the file rather than its name: it is
  compiled GUI-builder C source, so the lift is narrower than "confirm the syntax"), and `DEFAULT_CAPS`
  completed with `inputRead` / `atc` / `helicalArc`. Two drifted copies of the normaliser de-duplicated.
  ⭐ **The seat corrected the advisor**: my amendment said default these to the Expert-full value (`true`);
  measured, that flips 6 posts on `inputRead` and 4 on `atc` from `undefined` to `true` — a real behaviour
  change that fails the neutrality test my own dispatch demanded. It shipped `false`, proved it, and
  explicitly left the ruling to me. **Ruled t1537: `false` stands as correct design** — `DEFAULT_CAPS` now
  holds two patterns, full-by-default for the original seven (Expert is the richest common case, lesser
  posts opt out) and **safe-floor for rare/uncertain caps**, where an undeclared key means *nobody has
  said* and the honest reading of that is not *yes*.
- **t1536** — _no release (measurement only)_ — **DM500 stage 1.** `DM500_ORACLE_FINDINGS`, one row per
  factory file, run against the dialect rather than reasoned from memory. See the ruling below.

## The t1537 ruling — DM500's evidence tier

**Measured (t1536), against the 8-file `install/` corpus — 2 of which are empty:**

| Idiom | Result |
|---|---|
| probeMove · readMachine · ifGoto · dwell · spindleOff · label · goto · endProgram | ✅ **byte-exact after normalisation** — verified by *running* the dialect against corpus text (and `ifGoto` matches across *both* of the corpus's own inconsistent spacing styles) |
| `setWorkOffset` | ⚠ **structural difference** — Studio's position-independent `[#dro-value]` form vs `defprobe.nc`'s precomputed-sum form. Same class as V4.1's corner finding, not a new problem |
| `probe.nc`'s `#402/#403/#404` auto-datum triplet | **no Studio equivalent** (already scoped out in the dialect's own comment) |
| `gotoz` · `safez` · `slib` — the M98-into-firmware-O-number canned-cycle library | **no Studio equivalent** — Studio computes inline (confirmed: zero `M98`/`O9xxx` references in `holecycle.js`) |
| `m30.nc` · `null.nc` | **empty files** — named as unknowns, not guessed |

**RULING — tier: `corpus-attested (thin)`. DM500 does NOT enter `POST_VERIFIED`.**

The upgrade from the scout's *"likely parametric, unmeasured"* is real and earned: eight core idioms now
reproduce **byte-exact against the factory's own macros**, which is a stronger claim than any amount of
manual-reading. But three things bound it, and all three are visible above: the corpus is an **installer
tree, not a live capture** (8 files vs V4.1's 91 and Expert's 335); **a quarter of it is empty**; and
nothing here is hardware-confirmed. `POST_VERIFIED` is a promise to someone standing at a machine, and
offline agreement — however exact — is not that promise. The guard from the t1531 ruling holds unchanged.

### ⚠ Flagged for a future act, NOT taken here: the flow-cap may UNDER-declare

`slib.nc` uses `WHILE`/`DO`/`END`, but the dialect declares `caps.flow: 'goto'`. So Studio could not
reproduce that macro byte-for-byte even if it tried — and more importantly, **the factory itself
demonstrates flow richer than we credit the controller with**. That is a caps *under*-declaration, which
is the opposite of the over-claim the arc has been guarding against, and it is exactly the kind of thing
that must not stay in prose.

**Not changed here, deliberately**: raising a flow cap changes what Studio *emits* for DM500 — emit-class
work with its own bridge, its own act, and a heavier seat. It is recorded as a declared finding with the
evidence (`slib.nc`) named, so whoever picks up DM500 stage 2 starts from it.

## S5 — THE LIVE ROUND-TRIP, RUN ON HARDWARE (2026-08-02)

A **V4.1 bench unit** (firmware `2025-04-04-012-NOR`, no motors or drives attached — nothing could
move) was connected over SMB. The kit ran; the user read the screen, and results came back through
`sysdisk\uservar`. This is the stage the arc always said could not be agent-scheduled, and it is done.

| Probe | Verdict | Evidence |
|---|---|---|
| **Spaced G-code** | ✅ **bench-confirmed** | ran to completion — Studio's emit format is legal. Upgrades the t1531 user-attested row. |
| **`SQRT`** | ✅ **works** | `[SQRT[9] * 100]` returned exactly **300** — computed, not merely parsed |
| **`ATAN` Inverse Trig** | ✅ **works (DDCS V4.1 only, two-arg format)** | Strictly requires comma-separated two-argument syntax: `ATAN[dy, dx]` (e.g., `#190 = ATAN[1, 1]` returns 45°). Single-arg or `/` division forms throw `Unrecognized file format`. (Attested for DDCS V4.1: Yt Liu) |
| **`IF`/`GOTO`** | ✅ **works** | `IF #191==0GOTO1` branches. Unspaced `IF#191==0GOTO1` freezes standard mode — requires Macro Mode (DDCS V4.1 parameter `#122` enabled or `macro_` filename prefix, e.g., `macroMillCylinder.nc`). |
| **`WHILE`** | ✅ **works in Macro Mode** | Standard G-code mode lacks loop stack. Enabled on DDCS V4.1 via parameter `#122` or `macro_` filename prefix (e.g., `macro_test.nc`). |
| **`#a=#a+1`** | ✅ works | bare form, no brackets |
| Error reporting | ✅ **names the offending line** | every failure — a good diagnostic surface for this target |
| `#490/#491/#492` | machine coordinates | confirmed against the screen's Mach column |

### What it settles

- **The CAM slot's baked bearing is now justified by hardware.** The t1508 scout ruled it on the
  weakest evidence tier; the controller cannot compute `atan2` under any name we tried, so the
  decision stands on a machine saying no rather than on inference.
- **`caps.flow: 'goto'` is CORRECT** for what Studio emits. The DM500 "we may be under-declaring"
  theory (t1537) is closed — and closed with an error message behind it, not a freeze.
- **`SQRT` working** is the function three shipped boundaries were waiting on (raster ramp
  distance-to-centre, rest-machining corner clip, pocketfill's rest half) — on this controller.

### ⚠ Scope of the claim

All of the above is **attested for V4.1 only**. The M350 is a different firmware build, and which
math functions are linked is a build decision, not a family trait — the Expert's own notes record
its imports as including `sqrt` **and** `atan` while *lacking* `cos`/`sin`, the opposite pattern.
This is sibling evidence for the M350 and nothing stronger.

### Open questions — posted to the community, deliberately not chased

1. **Does `WHILE` work inside an `M98`/firmware-macro context?** The factory's own
   `macroMillCylinder.nc` uses it freely. Untested, and academic for us either way — Studio emits
   user programs, where it demonstrably does not work.
2. **Is there an arctangent under a name we did not try?** Five were tested. `COS`/`SIN` remain
   untested entirely.

`assets/community/FORUM-POST-macro-questions.md` carries both questions with reproducible cases.

### ⚠ A false alarm, recorded because the correction matters

The recording act first logged this as an **urgent defect in shipped emit** — that `ifGoto` produced
the freezing unspaced form. It does not: every dialect's `ifGoto` template begins `IF ` with the
space, and `ddcs-v41.js` renders exactly the form the bench proved works. The claim was inferred
from the symptom without reading the emitter; one grep settled it. Corrected before it hardened.

**The rule it re-teaches:** a defect claim about *shipped* code deserves the same evidence bar as a
capability claim — arguably higher, because it triggers work. Measure the emitter, don't infer it
from a failure whose cause was a hand-written test file.

### Process notes worth keeping

- Every wrong conclusion this session came from **one test with a confound**, and each was corrected
  by the user pushing back: ATAN was overstated before the single-operand retest isolated it, and
  `WHILE` was called both "unsupported" and "under-declared" before four variants settled it.
- Two runs were wasted on **nested parentheses inside comments** — the trap the worker's own kit was
  explicitly checked against, reintroduced by advisor-generated files that skipped that check. The
  check belongs in the generator, not in the reviewer's memory.
