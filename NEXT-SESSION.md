# QUEUE (rewritten 2026-08-08, turn 1641) — the head is THE PLACEMENT ANCHOR

**DONE and reviewed, awaiting only the user's own save-and-insert test before the release bump:**
t1634 ATAN comma (880ef211) · t1636 the inert wizard / skim absorbed body (b6ddfc64) · t1638 a block
declares its own mouth (69ec46e7) · t1640 the formfield's Op Param mode (13acc0fe) · the studio's skim
fix (af391806). Five acts, unreleased. The RELEASE waits on the user; the WORK does not.

**HEAD OF QUEUE → the placement-anchor defect, written out below.** After it: the skim browser-verify,
then the save-dialog summary delete, then portingArc's stale atan row, then wizards-as-data resumes.

---

## ✅ DONE t1634 — the ATAN comma fix (kept for the record; hardware-driven, twin verified)

Hardware verdict (FINDINGS 4ba142ed): the Expert REJECTS the Fanuc slash form `ATAN[#52]/[#53]` —
the alignment angle macro has been UNPARSEABLE there. The comma form is hardware-proven on BOTH
controllers (Expert V13f = 2657; V4.1 S5o = 4500, S6g = 2656.5, order dy-over-dx CORRECT).

1. **Emit sites → comma**: `data/probeToSlot.js:538` and `wizards/alignmentWizard.js:158`
   (`#54=ATAN[#52]/[#53]` → `#54=ATAN[#52, #53]`; update each line's trailing comment honestly).
   ⓘ A dialect-declared `atan2` was proposed and RETRACTED: the line is already a declared `assign`
   block carrying an expression string (that IS the wizards-as-data form), and both macro-var
   controllers take the identical comma form — no second form exists to abstract over, so a dialect
   slot would be premature machinery (rule-of-three). RECORD in the evidence wording that the ATAN
   FORM IS DIALECT-SCOPED, so a future third target arrives with the reason already written down.
2. **Spec flips**: `alignment-superset.spec.js:69` and `cam-slot-sim.spec.js:164` — the pinned regex
   `ATAN\[#52\]\/\[#53\]` flips to the comma form (pin the NEW world, not a tautology).
3. **Evidence rows follow the behaviour** (the messages-rot rule): `data/trigEvidence.js` —
   `alignment-atan` resolves (shipped-unconfirmed → hardware-confirmed; the onNo fired and its "which"
   is answered: UNPARSEABLE, fixed by form-switch; update `decl`/`anchor` to the comma form) · the V41
   `ATAN: absent-so-far` entry is STALE — the comma form postdates it (S5o/S6g); rewrite to
   hardware-confirmed-with-comma, keeping the honest history of the six rejected names.
4. ⚠ **Five more specs consume the evidence/anchor** — check each for anchor asserts before assuming
   the two flips suffice: `trig-lift-plan-1466`, `slot-cam-pack-scout-1508`, `slot-capability-arc-1478`,
   `slot-live-frame-rotation-1514`, `probe-fixes`.
5. **Goldens**: grep stored goldens for the slash line; any that carry it move DELIBERATELY (named
   individually, the t1575 standard — this act intends emit movement on exactly the ATAN lines).
6. ⚠ **WIZARDS-AS-DATA COMPLIANCE (user-ruled: fix it in compliance now, do not redo later)** — the
   alignment TWIN (`user_alignment_data`) must emit the comma form too. Fork parity says the twin is
   byte-identical to the wizard, so a source fix SHOULD flow — VERIFY it, do not assume: assert the
   twin's emit carries `ATAN[#52, #53]`. If the twin has its own hand-copied ATAN string anywhere, that
   is a second source and it collapses to one in this act.
7. **Verify**: emit diff = exactly the ATAN lines and nothing else · the sim parses the comma form
   (t1583 — assert, it already does) · the twin assertion above · full suite vs the floor (15 + churn;
   the churn class is documented in ADVISOR-TRANSFER.md §4).

## ✅ DONE t1638 — A BLOCK DECLARES ITS OWN MOUTH (kept for the record)

t1636 fixed `skim` by adding it to `isWrap`. Correct — and it is the FIFTH time this exact registration
has been done by hand, with the same silent failure each time:

```
  bridge.js:70     isWrap list         C-mouth kinds
  bridge.js:260    DO-mouth list       param_group · section · opunit · cam_table · guard · uibox
  stackBridge:122  read direction      (the same kind list, restated)
  stackBridge:281  write direction     (the same kind list, restated again)

  t1069 opunit · t1093 cam_table · t1595 guard · t1627 uibox · t1636 skim
```

**The failure mode is always the same and always silent:** a block that holds children but is missing
from a list gets written CHILDLESS by recToJson, its children are discarded on the round trip, and
nothing errors. t1595 lost a structural arm this way; t1636 lost an entire cutting body, and the user
found it as valid G-code that cuts nothing.

**The declared fix:** the block DEF declares its own mouth (e.g. `mouth: 'DO' | 'C'`, or a boolean plus
the existing `kind`), and all four sites READ that declaration instead of matching hardcoded kind names.
A new mouthed block then works by being declared, not by being remembered in four places.

1. **Survey first**: the two families (C-mouth via `isWrap`, DO-mouth via the explicit lists) may or may
   not collapse into one declaration — measure before deciding, and say which.
2. **Byte-identical for every existing block** — this is a re-declaration, not a behaviour change.
   Every current kind keeps its exact mouth. Assert it.
3. ⚠ **The durable half: a block with children and NO declared mouth must FAIL LOUDLY**, not silently
   discard. That assertion is what makes a sixth instance impossible — and it is the reason this act is
   worth more than the five one-line fixes it replaces.
4. **Verify** against the heaviest round-trip specs (guard-roundtrip-1595, the skim round-trip from
   t1636, fork-parity-1593's 32 twins) plus non-vacuity per claim. Full suite + ID diff.

## ✅ DONE t1640 — the formfield gained an OP PARAM mode (kept for the record)

t1636 MEASURED this and it is not a fork: `deriveBindings` already supports
`match: { type: <atomType> }, key: <param>` with zero engine changes — every shipped twin binding a
real op atom uses exactly that (`surfacingData.js`'s specs bind w/h/toolDia via
`match: { type: 'surfaceraster' }`). The gap is purely the **formfield block's authoring UI**, which
hardcodes `match: { type: 'assign', var: <matchvar> }` and offers no way to target a leaf atom's own
param. That is why authoring a form over an ordinary op's params produces zero bindings.

**The ruled shape** (the worker's recommendation, user-approved): a second declared MODE on the
formfield block — *Assign Var* (today's behaviour, unchanged) vs *Op Param* — additive, and
**byte-identical for every existing formfield**. In Op Param mode the block names the atom type and the
param key instead of a matchvar.

Two authoring-surface questions the survey must answer before building (report if either is a real
fork): how the atom-type list is populated for the dropdown, and how to disambiguate when a stack holds
MORE THAN ONE atom of the same type (index? the nearest preceding? an explicit pick?).

Verify: an authored stack over a real op (surfacing) saves WITH its fields and emits a real toolpath —
the user's t1636 gesture, end to end · every existing formfield byte-identical · the t1636 loud refusal
still fires for a genuinely dangling field · non-vacuity per claim · full suite + ID diff.

## AFTER THE ACT — t1635: surfacing skim, the browser half (do NOT start it this turn)

The studio fix was verified node-tier only. Drive the REAL symptom in the browser once: skim mode →
the sim renders the full raster (not one plunge over a stock box) · Normal byte-identical · the
labels 93/94 belong to the skim pair with rows at 95+ (assert from the emitted text). Small act.

## ✅ CLOSED t1642 — THE PLACEMENT ANCHOR IS NOT BROKEN (my hypothesis died on contact; kept for the record)

**Advisor review, turn 1643 — the worker is RIGHT and I verified the algebra independently from source.**
`placement.js:49` makes `pathDatum` FOLLOW `stockAttach` when unset, and `FRAC = {n:0, c:0.5, p:1}`. So with
the faced area spanning the full stock (`bbox` width = `W`, min = `X0`):
```
  cornerX = X0 + FRAC[sa]*W
  x = (FRAC[sa] - FRAC[sd])*W + originX - X0 - FRAC[sa]*W
    = -FRAC[sd]*W + originX - X0          <- FRAC[sa] CANCELS. the picked corner cannot matter.
  shrink the area to w' < W and the term becomes FRAC[sa]*(W - w') — it moves again.
```
`surfacingView.onOpen` defaults the area to the full stock top, so the first gesture a user makes is
provably a no-op. Not a defect. NO code change was correct here, and the worker was right to build none.

⚠ **ONE REVIEW FINDING (fix it, it is 2 lines) — test 1 of `placement-anchor-1642.spec.js` can pass
VACUOUSLY.** It asserts `expect(r.near).toBe(r.far)`, and `.toBe` is `Object.is`, under which
`Object.is(NaN, NaN)` is TRUE. If `traceToolpath` ever returns no finite segments (an empty emit — this
week's exact defect family) both sides are `NaN` and the test goes GREEN while proving nothing. A test
whose whole job is to pin "this is NOT a bug" must not be satisfiable by an empty trace. Tests 2 and 3 are
safe (`toBeGreaterThan`/`not.toBe` both fail on NaN) — only test 1.

## ▶ NEXT ACT (queued 2026-08-08, user-ruled) — SURFACING'S POS/DIM GUI, FULL FUNCTIONS

**User rulings, both explicit, do not re-litigate either:**
- **NO CLAMP, NO GREYING.** The advisor proposed a "Face the whole stock top" toggle that derives W/H and
  greys the fields (plus greying the corner picker at full-stock size). **REJECTED.** Every field stays
  live and fully editable at all times. Do not add a toggle, do not disable anything, do not gate.
- **THE AUTO-FILL STAYS.** `surfacingView.onOpen` continues to fill W/H to the whole stock top on open
  (`surfacingView.js:95`). Do not touch that line. The full-stock no-op is now UNDERSTOOD and pinned by
  `placement-anchor-1642.spec.js` — it is not a defect and needs no affordance.

🛑 **RE-AIMED MID-ACT (turn 1646 amendment) — THE SECTION BELOW NAMED THE WRONG FEATURE.** Commit
`7462287d` (origin/main, the user's other machine, WORK-LOG only) settles the referent: the human ask is
*"skim mode can use the start position GUI we use in probe wizards"* — a **START MARKER telling the SIM
where the operator will jog**, so the preview draws the raster where the work is instead of at the origin.
It is **explicitly SIM-ONLY, ZERO EMIT CHANGE**: a `surfacing` provider in `web/viz/opSimStarts.js`
mirroring the probe-wizard providers · a draggable marker in `surfacingView.js` · `#790/#791/#792` seeded
via `previewVarSeed`. **The emit criterion below is therefore INVERTED for the marker** — dragging it must
move the PREVIEW and leave the emitted program BYTE-IDENTICAL. The pos/dim handles remain untested and
REPORT-ONLY; they are a separate queue item. The stray `console.log` delete still stands.

**(superseded) The act — "full functions" on the pos/dim GUI.** The user's standing preference is GUI over fields
([[prefer-gui-over-fields]], [[handles-are-independent]]), and surfacing already DECLARES two canvas
handles at `surfacingView.js:59-62`: a `point` handle for pos (`sf_originX`/`sf_originY`) and a `rect`
handle for the faced area (`sf_w`/`sf_h`). **t1642 never tested either one** — it drove fields directly
and clicked the stock-attach marker, which is a different widget. So whether the pos/dim handles actually
DRAG and reach the emit is UNVERIFIED, and "surfacing start position needs developed" most plausibly
means exactly this.

1. **Drive both handles with a REAL mouse drag** (`page.mouse.down/move/up` on the actual SVG handle, the
   t1642 standard — not a field write, which would mask a broken drag binding). Report what each one does
   today before changing anything.
2. **Whatever is missing, finish it** — the pos handle moves the faced area's origin, the rect handle
   resizes W×H, each independently ([[handles-are-independent]]: dragging one NEVER moves the other), and
   both reach the EMIT, not just the drawing.
3. ⚠ **A STRAY `console.log` SHIPS IN THIS FILE** — `surfacingView.js:63`, landed in e6e681e8 ("dynamic
   handle placement"), fires on EVERY canvas render, i.e. every keystroke. Delete it. That it survived in
   the same commit as the handle feature is itself evidence the handle work was left unfinished.
4. **The TWIN too** (wizards-as-data compliance, user-ruled): `user_surfacing_data` must gain whatever the
   wizard gains. One source if possible — say which, prove it, do not assume fork parity carries it.
5. **Verify**: assert the VALUE — a drag of N mm moves the emitted toolpath by N mm, against an independent
   expectation, in BOTH faces. Handles independent. Non-vacuity per claim (and the `Object.is(NaN, NaN)`
   trap from t1643 applies to any equality assertion here too). Full suite + ID diff.

## ✅ DONE t1644 (da25a498) — the skim browser-verify + the vacuity guard. REVIEWED: PASS.

Non-vacuity was proven the strong way — the worker REVERTED the `zMode:'skim'` stamp in both build paths
separately and reproduced the original symptom exactly (bounds collapsed to one plunge; labels came back
93/94-colliding), then restored. That is reproducing the bug, not asserting around it.
⚠ One review finding, small: test 2 is TITLED "byte-identical" but asserts the absence of three markers
(`G91`/`#790`/`SKIM`). In a week whose whole theme was tests claiming more than they check, the title
should match the assertion — rename it, or make it a real byte comparison against a stored Normal emit.

## ✅ DISPATCHED t1644 — the skim browser-verify, plus that 2-line vacuity guard

User, with a screenshot: "surfacing start position needs developed" → then "I can see it in the wiz but
it won't apply." So the control SHIPS and is visible on the 2D canvas (the datum/anchor marker), and
setting it changes nothing. That is this week's family again: a declared thing that does not reach the
emit.

**Trace so far (advisor, t1633 — verify each link, do not trust it):**
```
  picker on the 2D canvas
    -> placementParams('sf_', stock)   spread into the view's params   [surfacingView.js ~110]
    -> makePlace(params, ...)          carries stockAttach + pathDatum  [programFraming.js:33]
    -> placeonstock block built
    -> placeShiftFromParams(p, liveExtent(block.children, scope))       [blockEmitter.js ~363]
    -> if (!s.x && !s.y && !s.z) return inner;      <-- SILENT NO-OP
    -> surfaceraster declares absorbsPlacement (surfaceraster.js:2125), so it
       receives the shift as x/y/z0 PARAMS rather than a text rewrite
```
**Leading hypothesis:** the anchor exists only as a COMPUTED SHIFT, and computing it needs the wrapped
geometry's live extent. If `liveExtent` reports nothing (or zero) for `surfaceraster`, the shift is
0,0,0, the early return fires, and the picker silently moves nothing. Compare against a wizard where the
anchor DOES work (drill uses the same placeonstock path but does NOT absorb placement — that contrast is
the fastest discriminator).

1. **Confirm the symptom in the REAL app first** — set the anchor to each corner, watch the emit. Say
   which control the user means (the red marker in their screenshot) and what it does today.
2. **Trace to the zero.** Measure the shift and the extent; name the exact link that returns empty.
   Do NOT fix upstream of the measurement.
3. **Fix at the source**, one source — if the extent is the gap, the atom declares its extent the way
   the live-extent contract expects; if the fold is the gap, the fold. Report which and why.
4. ⚠ **The TWIN must gain it too** (wizards-as-data compliance, user-ruled). The twin already DECLARES
   `stockAttach`/`pathDatum` bindings onto the placeonstock block (`surfacingData.js:75-76`) — so if the
   wizard was the only broken half, say so; if both were broken, one fix should serve both.
5. **Verify**: each anchor corner moves the emitted program the declared amount, in BOTH faces;
   default unchanged = byte-identical; the 2D marker and the emit agree. Full suite + ID diff.

## THEN — wizards-as-data resumes (ADVISOR-TRANSFER.md §3, items 2–7)

Corner simstart placeholders · derived rows on the tree face · shape-field lint hook · drawer 2D pane ·
Escape pair · flattenBlocks side-effect · the defects queue. User rulings still open: bevel · label
widening · Corner-wall · S6h + Expert V13c/a/b probes.
