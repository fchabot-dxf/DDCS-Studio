# TODAY — the running order (2026-08-10, built with the user)

```
  RUNNING   t1698   the map's checker                        worker has it
  THEN      RELEASE 7 commits sitting unreleased             ADVISOR does this
            incl. the glyph fix — the last of the user's five corner symptoms
  THEN      THE CYCLE below, 4 acts, and it ENDS
```

**The release is the advisor's, not a worker act.** Gate it (full suite, once), push, bump, verify the deploy,
then start the cycle. Do NOT dispatch a cycle act while the release suite runs — that collision manufactured
false reds twice on 2026-08-09.

**What is waiting to reach the user:** the glyph resolver (the last corner symptom he reported), `_writable`
declared, the preview gate's marker gap closed, 34 dead screenshot paths repointed, the lathe frame ruling,
`ARCHITECTURE.md`, and CI disabled.

---

# THE NEXT LOOP — CYCLE: MACHINE VARIABLES IN WIZARD BOXES

**Built 2026-08-10 with the user. A FINITE cycle: it ends when the end condition below is met, and the advisor
runs `handoff.py done` rather than inventing a next act.**

## WHAT THE USER GETS AT THE END, in his own words

> Type `#500` into a wizard field and the program takes that number **from the controller** instead of a fixed
> value — and a malformed one gets **refused** instead of quietly sent.

## END CONDITION (all four, demonstrated in the real app)

1. A controller token typed into a wizard field survives into the emit (`w = #500` → `X#500`, not a baked number).
2. It survives the twin form, the built-in form, and the Blocks canvas — the three authoring surfaces.
3. A malformed token is REFUSED LOUDLY at the send gate. `' #500;M30 '` must not pass.
4. A param that CANNOT take a live value says so by declaration, not by silently coercing it away.

---

## ACT 1 — CLOSE THE HOLE FIRST (safety; prerequisite, not a follow-up)

Measured at t1668 and still open: `' #500;M30 '` emits `G0 X#500;M30 Y10` and `defaultSyntaxVerify` returns
**valid: true**. A token value is never bounded to where it ends, so an injected second statement rides through
the send gate. Six of seven malformed shapes are already refused; this is the survivor.

⚠ **Why it is act 1:** it is unreachable today ONLY because no surface can author a token. Build the surfaces
first and the hole ships inside the feature. The user has been told and agrees the safety fix leads.

- Bound the token: it ends where the token ends; anything trailing on the same word is malformed.
- **Refuse loudly** — the standing rule for this whole defect family. Never emit something plausible.
- Verify against the REAL gate (`defaultSyntaxVerify` + the emit path), not a unit stub, and re-run t1668's full
  malformed sweep so the six already-refused shapes stay refused.

## ACT 2 — DECLARE WHICH PARAMS CAN TAKE A LIVE VALUE (the design fork, decided before any UI)

t1668's own survey named the real constraint: **params like Surfacing's `w` feed JS-side geometry math**
(`stepover` counts, pass counts, bbox), so they cannot take a value that only exists at run time without either
deferred math or a per-field refusal.

- **DECLARE the per-param answer** — this is data, not a special case, and it belongs beside the binding spec.
- Report the split: how many params can accept a token, how many genuinely cannot, and WHY for a representative
  few. That count sizes act 3.
- ⚠ A param that cannot accept one must say so **in the UI** when a token is typed — not coerce it to a default
  silently, which is exactly what all three surfaces do today.

## ACT 3 — THE AUTHORING SURFACES (may split into two acts; say so if it does)

Three surfaces, three DIFFERENT silent failures, all measured at t1668:
```
  Blockly shadow    setValue('#500') is IGNORED — the field stays numeric
  wizard form       num() coerces it away — falls back to the default
  twin form         a native number input CLEARS the string at the DOM
```
Take them in that order of difficulty only if it helps; the deliverable is that all three accept a token for a
param declared token-capable, and refuse it visibly for one that is not.

## ACT 4 — END-TO-END, IN THE REAL APP

Type it, insert it, read the emitted program, send it. All four end-condition claims demonstrated by driving the
app — not by unit assertions. Screenshot the field and the emitted line.

---

## THE STANDING BARS (unchanged, do not re-litigate)

- **Verification tier:** node tier + the preview gate (~2s) + a hand-picked sweep. **NOT `test:changed`** — t1696
  proved it only follows STATIC imports and finds zero tests for `web/` changes. The full suite is the
  advisor's release gate, not a per-act step.
- **Replace, don't parallel.** No second code path beside the old one; no legacy shim. Nothing in this project is
  irreplaceable — machine values re-pull from the controller.
- **Look at the pane.** Anything on a visible surface gets opened and seen before it is claimed.
- **Non-vacuity per claim.** Break it, watch it go red, restore it, report both.
- **ARCHITECTURE.md is the map** — read the part your act touches before tracing, and REPAIR it in the same act
  if your work proves a claim wrong.

## AFTER THIS CYCLE (not part of it — the loop ENDS first)

Retire the 20 dead built-in SCREENS (⚠ extract first: 24 twins import their BUILDERS, which are load-bearing) ·
the §3 tail · then ARC B (validation as data) or ARC C (dialect as data — the porting arc, and the one with
strategic weight: it decides whether Studio runs other people's machines).

---

<!-- ARCHIVE: prior queue -->

# QUEUE — prepared 2026-08-09 (advisor). Dispatch in order, ONE act per turn.

## STATE

**Shipped and live:** V2026.08.09.1 (the silent-G-code-loss family — a pasted line dropping `M3`, a dropped
`G91` turning a relative plunge absolute, the canvas round-trip losing `modalPre`, a swallowed error nullifying
two fail-loud guards) · V2026.08.09.2 (the phantom corner diagonal, the Layout pane reading `partZeroShift`,
Skim's rect following the jog marker) · V2026.08.09.3 (the declared-but-unread census: `onEdit` restored to
every twin, fork-carry derived and the stale allow-list deleted, `teal`/`emits` reconciled).

**On the branch, gated and awaiting release:** t1686 THE SPLIT FIXED — `getTransform()` folds `_placement` so
it IS `_disp`; `onTransform` relays the same composed value; the crosshair joins the placed frame. Plus THE
PREVIEW GATE (`tests/node/preview-spec-gate-1688.test.mjs`, 109/0 in ~1.8s, browser-free, advisor-verified by
breaking `noSnap` and watching it go red).

**The user's corner report is 4 of 5 closed** — path/frame, double traverse, clamped Start, and the spindle
offset (user-confirmed 2026-08-09). ONE survives, and it is ACT 1.

---

## ▶ ACT 1 — THE GLYPH RESOLVER (the last live corner symptom)

**t1684 unified the VOCABULARY and left three different RULES.** Verified line by line:

```
  featureCanvas.js:508   shape ← manual ; hollow ← emits === false              (ANY pass)
  toolpath2d.js:228      shape ← manual ; hollow ← i > 0 && emits === false     (pass 0 ALWAYS filled)
  gcodeViz3d.js:409      shape ← emits  ; colour ← manual                       (a different input)
```

Two concrete disagreements fall out: corner's lead pass (`cornerData.js:128`, `emits:true` but forced sim-only
at index 0 by `opSimStarts.js:284`) draws **hollow** in one pane and **filled** in another; and any auto pass
with `emits:false` draws a square in 2D and a **ring** in 3D. This is the user's symptom 5, reported with a
screenshot and still live.

**Why it matters beyond cosmetics:** solid-vs-hollow is a DECLARED promise — *this marker's handle edits a real
emitted macro var (`#21-#24`)*. Three rules mean at least two panes are misreporting which markers change the
operator's program.

1. **ONE resolver.** `(source, emits, pass) → {shape, fill, colour}`, pure, declared once, called by all three
   renderers. Not three rules made to agree — one rule, three callers.
2. **Decide the lead-pass question explicitly and say why:** corner's wall1 declares `emits:true` yet is forced
   sim-only when it IS the lead pass. Which is the truth for the operator? Whatever you rule, it is ONE rule.
3. ⚠ **If a declaration turns out WRONG** — a handle claims to drive the emit and does not, or vice versa —
   that is a FINDING. Report it; do not quietly edit the declaration to match the code.
4. **CORNER IS THE PILOT** — the only op that declares `emits` (`createPreviewPanel.js:781`: every other op's is
   `undefined`), so it is the only place the rules can visibly disagree.
5. **Verify by VALUE and BY EYE:** assert each marker's rendered treatment matches whether its param actually
   reaches the emit, in all three renderers — and LOOK at the pane, both states, before claiming it.
6. **The new preview gate must cover this** — extend `preview-spec-gate-1688` so a fourth rule cannot appear.
   Non-vacuity per claim. Node tier + full suite + ID diff.

---

## ACT 2 — DECLARE `_writable` (it is a DOM query, and it blocks 17 twins from the gate)

`panelTypes.js:74-75` decides whether a handle is editable by asking
`document.querySelector('#wiz_user_form [data-param=…]')`. `formWidgets.js:1100` already calls this *"a DOM
presence used as a proxy for 'settable'"* — the codebase knows.

**Consequence, measured by the gate build:** only **15 of 32** twins produce handles browser-free. The other 17
— corner, edge, middle, both rotaries, alignment, homing, wcs, comm, ioStep, pauseConfirm and the 6 ATC ops —
snapshot `handles: <0 entries>`. **The whole corner pilot is invisible to the new gate.**

Declare it from the binding (a binding whose widget is not multi-param is settable) and 17 twins join. Do it
for the coverage, not the tidiness: every act after this is cheaper to verify. Byte-identical rendering, gate
snapshot regenerated deliberately and reviewed line by line.

---

## ACT 3 — KILL THE DECORATIVE CI SIGNAL (demoted from "fix CI" — user-ruled 2026-08-10)

**Measured:** `.github/workflows/test.yml` runs the full `npm test` on every push. Same sha, same command:
local **7 failed / 2470 passed in 20 min**; CI **504 failed / 1971 passed in 2.6 HOURS** — and because it is
`continue-on-error: true`, the job conclusion is **success**. A green check sitting on 504 reds.

**FIXING it was considered and REJECTED on the numbers** (user call, and correct): each CI iteration is a
2.6-hour feedback loop, the 504 may be environment-fundamental (hosted-runner contention, no GPU, DPI), and the
saving is ~20 min per release of *background* time. Bad trade against a queue holding real defects.

**So do the cheap half only:** delete or disable the workflow. A test job that reports success on 504 failures
is worse than none — it reads as coverage to anyone glancing at the repo, including us in three months. If
disabling rather than deleting, say in the file WHY it is off and what would have to be true to turn it back on
(parity with the local floor), so the next person does not re-enable a decorative gate.

⚠ Do NOT spend acts chasing CI parity. Revisit only if the local suite stops being runnable.

## ACT 4 — SUITE SPEED (user-raised twice; all numbers measured)

```
  toHaveScreenshot   0        ALL 266 screenshot() calls write to scratch paths.
                              They gate NOTHING, cost wall-clock, AND cause the
                              verification/*.png churn the advisor restores by hand
                              after every single run.
  waitForTimeout     732      ≈347s declared sleep ≈58s wall at w6 (~5% of the suite)
  convertible        817 tests / 233 files (28%) assert pure module calls
                              through a browser they never touch
  test:changed       exists in package.json and has NEVER been run
```

Rank by measured saving per unit of risk; do the free ones first (the screenshots that gate nothing are free).
⚠ Do NOT delete a screenshot that a human reads as evidence — several are deliberate verification artifacts.
Distinguish *gating* from *evidence* before removing anything.

---

## ACT 5 — THE LATHE `placement` GAP (surfaced by the gate build; needs measurement then a ruling)

The 7 lathe twins' specs carry **no `placement` key at all** — `latheLayoutSpec` returns early, before
`panelTypes.js` computes the shift. So a lathe Layout pane can never ride a WCS pin, and the frame fix that
t1686 made universal for mill ops simply does not reach lathe.

1. **Measure first:** with a pin active, does a lathe Layout pane visibly disagree with its 3D — the same way
   surfacing did? If it does, it is the same defect in a family nobody has opened yet.
2. **Then rule:** either lathe joins the one declared frame (preferred — it is the same promise), or there is a
   real reason a lathe pane is pin-independent, in which case DECLARE that reason so the next person does not
   read it as an oversight. Say which and why.
3. Same standard as t1686: one declared source, a renderer added later inherits it automatically.
4. The preview gate covers lathe today only for the keys lathe actually has — extend it so this cannot silently
   regress. Non-vacuity per claim.

---

## ACT 6 — THE MALFORMED-TOKEN SEND-GATE HAZARD (ARC B's first slice; safety-adjacent)

From t1668, measured and unfixed: `' #500;M30 '` emits `G0 X#500;M30 Y10` and `defaultSyntaxVerify` returns
**valid: true**. A token value is never bounded to where it ends, so an injected second statement rides straight
through the send gate. Six of seven malformed shapes are already correctly refused — this is the surviving one.

⚠ **It is a PREREQUISITE, not a follow-up.** It is unreachable today only because no authoring surface can
create a controller token at all (t1668: three surfaces, three different silent failures). Build the token
authoring feature first and it ships with the hole.

1. Bound the token: a token value ends where the token ends. Anything after it on the same word is malformed.
2. **Refuse LOUDLY** — the standing rule for this whole family. A malformed token must never emit something
   plausible.
3. Verify against the REAL gate (`defaultSyntaxVerify` + the emit path), not a unit stub, and re-run t1668's
   full malformed sweep so the six already-refused shapes stay refused.
4. Non-vacuity: prove the gate now rejects the injection and still accepts every legitimate token form.

---

## ACT 7 — CONTROLLER TOKENS: THE AUTHORING SURFACES (t1668 sized it; ACT 5 gates it)

t1668 established this is **UNBUILT, not broken**: the plumbing already works — `move x:'#500'` emits
`G0 X#500` and the canvas round-trip preserves it — but **no authoring surface can create a token**. Three
surfaces, three distinct silent failures: Blockly's shadow ignores `setValue('#500')`; the wizard form's `num()`
coerces it away; the twin's native number input clears the string at the DOM.

Also recorded from that survey, and it is the real design fork: **params like Surfacing's `w` feed JS-side
geometry math**, so they cannot take a live controller value without either deferred math or a declared per-field
refusal. Decide that BEFORE building surfaces, and declare which params can accept a token.

---

## ACT 8 — THE §3 TAIL (ADVISOR-TRANSFER.md items 2-6, each small)

Corner's 3 `simstart` placeholders (an unwired type, correctly refused today) · materialize derived rows on the
tree face (`passes` has no `param_field` row) · the shape-field typo lint hook (a typo skips silently — folds
naturally into ARC B) · the drawer's 2D pane (no `renderLayout2D` caller; shapes show in the modal, not the
drawer) · `flattenBlocks`'s transient `_group` side-effect (app-wide, named) · `groupBox`'s dead `mouths` field
(the t1678 census confirmed it, tier 2) · the Drive trash/sign-in/no-FSA fallback.

---

## THE ARCS (ROADMAP.md carries the full statement)

- **Preview arc, remaining stages:** the frame is done (t1686) and the gate exists; what remains is liveness
  (ACT 2), the glyph resolver (ACT 1), and the lathe bypass — **the 7 lathe twins carry NO `placement` key at
  all** (`latheLayoutSpec` returns before the shift is computed), so a lathe Layout pane can never ride a WCS
  pin. New finding, unresolved, needs a human ruling on whether that is intended.
- **ARC B — VALIDATION AS DATA.** Every lint rule is hand-added per case. Live members: `ifgoto` lhs/rhs
  unlinted, an `IF`'s children never linted, the shape-field typo hook, and t1668's real hazard — `' #500;M30 '`
  emits `G0 X#500;M30` and `defaultSyntaxVerify` returns **valid**. Safety-adjacent: malformed G-code passing
  the send gate.
- **ARC C — DIALECT AS DATA.** Per-controller facts are hand-written per emit site; t1634's ATAN form is the
  worked example. Pairs with the porting arc (V4.1 first).

---

## STANDING RULINGS (do not re-litigate)

- **Surfacing:** NO clamp, NO greying; the on-open auto-fill to the whole stock top STAYS.
- **The start marker:** ONE widget, identical in both Z-modes; the MODE declares its target — WCS writes the
  origin offset (**the emit MOVES**), Skim seeds `#790-792` (**emit BYTE-IDENTICAL**).
- **Corner is the gated pilot** — no wizard ports until corner is right.
- **Advisor discipline (earned the hard way 2026-08-09):** LOOK at the app before judging anything on a visible
  surface; a symptom is an observation, not a diagnosis; grep who declares and who consumes before relaying;
  never run a suite while the worker holds the ball.

---


<!-- ARCHIVE below: prior queue -->

# QUEUED (user-approved 2026-08-09) — THE DECLARED-BUT-UNREAD SWEEP

**Four instances surfaced in four consecutive acts, every one found BY ACCIDENT while chasing something
else.** That is the signal: they are not rare, we are just meeting them one user report at a time.

```
  t1638  block `mouth`        four hand-maintained kind lists, children silently discarded
  t1654  durable record field `modalPre` dropped on the canvas round-trip
  t1670  `emits` (solid/hollow)  DECLARED contract, read by NONE of its three renderers
  t1674  `noSnap`             passed to buildCanvasWidgets, silently dropped by it
```

**The act — FIND THEM ON PURPOSE, do not fix them yet.**

1. **Sweep for keys that are SET somewhere and READ nowhere**, across the declaration-carrying layers:
   block defs, binding specs, handle/widget declarations, op defs (`def.*`), and the spec objects returned
   by `layoutSpecFromOp` / `previewGeometry` / `buildCanvasWidgets`. Grep-shaped: for each key written to a
   declaration object, is there a consumer that reads it?
2. **REPORT A RANKED LIST, fix nothing.** Rank by what the dead declaration PROMISES, not by how easy it is
   to fix. `emits` ranks high because it promises the operator "this marker changes your program" — a
   safety-relevant claim nothing enforces. A cosmetic hint ranks low. Batching fixes behind a sweep is how a
   real one gets waved through (the t1660 standard).
3. **Say which are DEAD (delete) and which are UNIMPLEMENTED (build)** — different acts, and I want the
   distinction made by evidence, not vibes. A declaration nobody ever wired is not the same as one whose
   consumer was refactored away.
4. ⚠ **THE DURABLE HALF matters more than the list.** How does a declared-but-unread key become IMPOSSIBLE
   or LOUD? `t1638` and `t1654` both solved their instance by making the round-trip THROW on an undeclared
   field. The generalization would be a test asserting every key present in a declaration object has a
   reader. Say whether that is buildable and what it would cost — if it is, that single guard retires this
   whole class, which is worth more than any individual fix below it.
5. Non-vacuity: whatever detector you build, prove it catches a planted dead key, then remove the plant.

⚠ Do NOT let this become a refactor. It is a census plus one durable guard. The fixes are separate acts,
dispatched by rank.

---

# QUEUED NEXT (user defect report + screenshot, 2026-08-09) — THE CORNER TWIN'S PREVIEW IS WRONG

⚠ **Corner is the GATED PILOT** (see memory: no other wizard ports until corner is perfect). A preview
defect here outranks the rest of the queue.

**User, verbatim, with a screenshot of `Corner (data) · 82 lines`:**
1. *"corner probe path is not like the feature gui at all"*
2. *"corner probe has both diagonal and dogleg traverse"*

**What the screenshot shows** (advisor reading — verify, do not inherit):
```
   ┌╴╴╴╴╴┐              ● probe point (upper), well ABOVE the rectangle
   ╎ amber dashed       ╎
   ╎ rectangle  ╲       ╎
   └╴╴╴╴╴╴╴╴╴╴╴╴●╺╺╺╺╺╺╺╺╺╺╺╺╺► teal, running FAR off to the right
              ╲   probe point (lower), on the EDGE not the corner
     ▪ 1       ╲        Mach  X 32.231  Y -738.089  Z -105.000
         ● Start        (Start disconnected, bottom-centre)
```
- **TWO traverse shapes at once** — an orange DIAGONAL and a teal DOGLEG/axis-aligned run. Only one
  strategy should be live. Note `traverse-targets-are-marker-derived`: teal drives the EMIT vars, amber is
  sim-only — so two *colours* is expected; two *shapes* is the report. Establish which is which.
- The teal traverse aims far outside the feature.
- Probe points sit off the rectangle's corner rather than on it.
- `Y -738.089` — determine whether that is the user's real machine frame or the preview rendering in the
  WRONG FRAME. `probes-never-read-wcs` and `machine-frame-sim-spec` are the relevant declarations.

**The act:**
1. **DRIVE BOTH SURFACES and screenshot them side by side** — the Corner wizard's own 2D feature canvas,
   and the `user_corner_data` twin's preview, at IDENTICAL settings. The divergence is the deliverable;
   name it before touching code. (`review-eyeballs-whole-wizard`.)
2. **Say which surface is RIGHT.** Do not assume the wizard is correct and the twin is wrong — the twin may
   be exposing a real defect the wizard's own canvas hides.
3. **The double traverse:** find why two shapes render. One declared strategy, one drawn path per role.
4. **Fix at the source, one source, both faces** (standing wizards-as-data compliance ruling).
5. **Verify by VALUE:** the probe points land ON the declared corner, the traverse target is the next
   probe's marker (not a free-standing value), the frame is correct, and the EMIT is unchanged unless the
   act intends to move it — say which. Non-vacuity per claim. Full suite + ID diff.

⚠ Do NOT let this act drift into redesigning the corner UX. It is a divergence hunt and a fix.

---

# ▶ THE ACT (turn 1648) — THE START-POSITION MARKER, one coherent dispatch

t1646 was re-aimed SIX times mid-flight and the worker correctly took the escape hatch rather than build
through the churn. This is that feature, dispatched once, with every ruling folded in. **Nothing below is
open for re-litigation — all six are the user's own words.**

## The feature, in one picture

```
  ONE marker widget. Same look, same drag, in BOTH Z-modes.
  The MODE declares what it writes to — it does NOT fork the widget.

  mode = wcs   ->  writes the ORIGIN / ANCHOR OFFSET  ->  the EMIT MOVES
  mode = skim  ->  seeds #790/#791/#792 (preview)     ->  emit BYTE-IDENTICAL
```

## The rulings (user, verbatim intent)

1. **"the gui serve differently in skim or wcs but it should look the same"** — one widget, identical
   appearance and drag. Not two markers that resemble each other.
2. **"that start position functionnality diff is unversal for all wizard using relative or wcs mode"** —
   the semantic is NOT surfacing-specific. Declare it ONCE, shared; surfacing is consumer #1.
3. **"is it better to make the wizard as data now"** → YES. The declaration lives in the
   **wizards-as-data layer**, read by BOTH faces. Not a wizard-side helper the twin later mirrors.
4. **"probes also use start pos, it doesnt need to have both, its still the same relative gui"** — REUSE
   the existing probe start GUI. Do not design a new widget, do not build a WCS variant.
5. **"in wcs mode start position gui controls offset of the origin / anchor"** — in WCS the emit MOVES.
   ⚠ An earlier dispatch told the worker to assert byte-identity in BOTH modes. That is WRONG for WCS.
6. No clamp, no greying; `surfacingView.js:95` auto-fill stays untouched.

## What t1646 already measured (do not re-measure)

- **The WCS arm may already exist.** The `point` handle at `surfacingView.js:59-62` drives
  `sf_originX`/`sf_originY` — literally the origin offset — and is PROVEN to reach the emit exactly
  (emit shift == the field's own delta, at both full-stock and shrunk sizes). Start there.
- **The twin has data parity but NO draggable canvas** (checked for `data-hid=origin/size` specifically).
- **`def.simStartParams` is REAL** — used by exactly 2 twins (`alignmentData.js`, `rotaryClockData.js`),
  and both write into REAL params the emit reads. **Fits the WCS arm; does NOT obviously cover the Skim
  arm** (a preview-only seed). Its `userOpView.js` path is TWIN-side only; `surfacingView.js` has no bridge.
- **`opSimStarts.js` is a COMPUTED-start registry**, genuinely distinct from a user-dragged marker.
- **`previewVarSeed`** lives in `wizardManager.js` + `atcViews.js` — likely the Skim arm, NOT yet read.

## The one real design question — answer it FIRST, in the pass-back

Three partly-overlapping mechanisms above. **Pick the seam and justify it**: extend `simStartParams` to
carry a mode-declared target, or a sibling declaration beside it? The bar is ruling 3 — it lands in the
data layer, ONE declaration, read by both faces. If the Skim arm genuinely needs a second mechanism,
say so plainly rather than forcing one declaration to do two unrelated jobs.

## Verify (assert the VALUE, not that something changed)

- **WCS**: dragging N mm moves the emitted toolpath N mm, against an independent expectation.
- **SKIM**: dragging moves where the preview draws the raster AND the emitted text is byte-identical.
- **Both**: the marker looks and drags identically — the user's explicit requirement, so assert it.
- **Mode flip**: say what happens to a value set in the other arm. If it is a real question, REPORT it;
  do not invent a rule.
- Non-vacuity per claim (the `Object.is(NaN, NaN)` trap applies to any equality assertion).
- Full suite + ID diff. **Floor confirmed at turn 1647: node 99/0, e2e 12 failed / 2429 passed.**
- ⓘ `editor-chip-space-1323:60` is a STALE TEST (asserts `paddingTop`; the shipped fix applies `top`,
  from `c5769a20` on main). It fails on main too. Not yours, queued separately — ignore it in your diff.

## Deliver surfacing ONLY

Do not port other wizards. Do report **which shipped wizards have a relative-or-WCS mode** (a cheap grep,
never run) so the rollout act is sized from a measurement instead of a guess.


---

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

---

# ✅ DONE (t1714) — RELEASE-BLOCKING REPAIR: selector repaired, tokenGuard made text, V2026.08.10.4 SHIPPED

The cycle's five acts are DONE and the end condition is met, but the release gate came back
**25 failed** (last release: 12, all churn). Advisor triage, already done — do NOT re-derive it:

**Cause, measured.** ACT 3 changed `numberWidget` (`web/ui/formWidgets.js`): a binding carrying a
declared token policy now renders `input type="text"` instead of `type="number"` (deliberate and
well-argued — a native number input silently swallows a `#500` keystroke, so there is no gesture left
to refuse). **12 specs use `#wiz_user_form input[type="number"]` as their FORM-IS-READY selector.**
Corner's fields are now `text`, so the only `number` input left is a hidden `planeZ` — the wait times
out and the test dies before reaching a single assertion.

**The product is NOT broken — advisor verified in the real app (t1713):** corner opens with 10 visible
inputs, all `type=text`, all carrying correct values (travelDist=50, safeZ=10, scanDepth=5, hopDist=15,
dist=500, retract=5, f_fast=200, f_slow=50). So this is a stale test PROXY, not a regression. Repair
the proxy — do not revert the widget change.

## THE ACT
1. **Repair the readiness selector in all 12 specs** so it is type-agnostic (the form is ready when its
   fields are visible, whatever element type a declaration gives them). One shared helper if the specs
   already share one; do not hand-roll 12 variants of the same wait.
2. **Re-run those 12 specs** and report the remaining reds by NAME. 7 are reproduced and attributable
   (5 x corner-marker-independence, 2 x corner-data-sim-marker-emits). `guard-roundtrip-1595` FAILED in
   the full run but PASSES in isolation — full-suite noise, leave it.
3. ⚠ **`web/blocks/blockly/tokenGuard.js` is BINARY to git** (`Bin 0 -> 6443 bytes` in the diff) because
   it uses NUL bytes as Map key separators. It is therefore INVISIBLE to every future review, including
   mine of ACT 5. Replace the separator with an ordinary character so the file is text; verify with
   `git diff --stat` showing line counts, not `Bin`.
4. **Verify**: the node tier + the 12 repaired specs. Do NOT run the full suite — that is the advisor's
   release gate.

## ⚠ A DESIGN FORK THE USER MUST RULE BEFORE THE 28-OP ROLL-OUT (advisor is asking them now)
Every field with a declaration becomes a text box — **including fields declared INELIGIBLE**, whose only
reason to convert is so the refusal can be shown. Rolled to the other 28 ops that converts most numeric
fields in the app, costing the spinner arrows and the browser's numeric validation everywhere.
Do NOT roll the declarations further until that ruling lands.

---

# 🔁 CYCLE 856 — "A CONTROL THAT DOES NOTHING, AND A GATE THAT CRIES WOLF"

A FINITE cycle: two acts, an end condition, then the advisor runs `handoff.py done` rather than
inventing a third. Both acts are UNBLOCKED by the open text-vs-number ruling — do not touch the
28-op roll-out until the user rules.

## ACT 1 — the stock-anchor picker that silently moves nothing
The defect is already scoped above (see the placement/anchor section): the anchor picker changes the
emit for some wizards and moves NOTHING for surfacing, because the shift derives from a live extent
that reports empty. Same disease this project just spent a week killing — **a control that accepts a
gesture and silently does nothing**. Follow the five steps written there, unchanged:
confirm in the REAL app first · trace to the zero and NAME the empty link · fix at ONE source ·
the TWIN gains it too · verify both faces + byte-identical default.

## ACT 2 — make the release gate's red count HONEST (zero expected failures)
Today's gate cost the advisor ~30 minutes of manual isolation because "14 failed, all churn" is
FOLKLORE, not a declaration: nothing in the repo says which failures are expected, so every red must be
re-isolated by hand, every release, forever. Measured this turn against `origin/main` — these fail on
the RELEASED commit too, so they are pre-existing, not ours:
  `collapsible-panes-752` (mobile collapse) · `pane-splitter-790` (desktop inert + mobile touch-drag) ·
  `update-check` (banner + download button)
Also load-sensitive (green alone, red under full-suite contention — do NOT "fix" these, they are real
tests being starved): `fork-parity-1593` · `middle-superset` · `blocks-live-form` ·
`formfield-loud-mismatch-1636` · `guard-roundtrip-1595`.
**The act:** fix what is genuinely broken; for anything that is environmental, DECLARE it — a named,
reasoned quarantine the gate reads, so the expected-red count is **0** and any red is real. A comment in
a log is not a declaration; the gate must read it. Report which you fixed vs declared, and why for each.

## END CONDITION (all three, or the cycle does not close)
1. Setting the stock anchor to each corner moves the emitted program by the declared amount, in BOTH
   faces, in the real app — and the untouched default is byte-identical.
2. The twin carries it too (wizards-as-data compliance, user-ruled).
3. A full release gate reports **0 unexplained failures** — every remaining red is a declared,
   reasoned quarantine the gate itself knows about.

## VERIFICATION TIER (unchanged, and it is a rule)
Per act: `npm run test:node` + a hand-picked sweep of what you touched. **The full suite is the
ADVISOR's release gate — never a per-act gate.**
