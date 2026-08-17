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

## ⛔ ACT 1 WITHDRAWN (t1717) — the premise was STALE, and the advisor shipped it unverified
The worker GATED rather than built, correctly. It drove both surfaces live (real SVG click on the wizard,
dropdown on the twin), shrank the area and cycled `stockAttach` + `pathDatum`: **both axes move, and the
two surfaces are byte-identical.** The only zero-movement case is the default full-stock area, which is
`placement-anchor-1642.spec.js`'s own already-closed no-op (3/3), with `surfacing-pos-dim-handles-1646`
(3/3) covering the twin.

Cause of the false dispatch: the trace this plan quoted dates from **t1633 and predates t1359's
`absorbsPlacement` fallback** — `placeShiftFromParams` reads a `bminX/bmaxX` snapshot that `makePlace`
wires from live w/h, so it never depended on `liveExtent` the way the old note claimed.

**The lesson is the ADVISOR's:** a defect sitting in a plan file is a CLAIM WITH A TIMESTAMP, not a fact.
Re-confirm it reproduces on TODAY's tip before spending an act on it — the same reconcile-against-ground-
truth rule already applied to the worker's reports, applied to my own backlog. A stale defect costs a
whole act, and worse, it invites forcing a "fix" onto code that is tested and working.

---

# 🔁 CYCLE 857 — PREPARE THE LAST LEG: **PREVIEW AS DATA**

EMIT is 32/32 declared. FORM is 32/32 declared. **PREVIEW is 0/32** — and every symptom the user
reported on 2026-08-10 lived in that column (path drawn outside the stock · 3D and 2D disagreeing ·
spindle offset from its own path · a marker solid in one pane and hollow in another). Those were not
five bugs. They were ONE missing declaration, hand-rolled by renderers with no shared source of truth.

## ACT 1 — SURVEY ONLY. Read-only. No source changes, no engine, no "while I'm in there".
⚠ **Do NOT run Playwright while this act runs — the advisor's release gate is running and two concurrent
suites manufacture false reds.** The node tier is fine.

For **every shipped twin**, answer with EVIDENCE (`file:line`, not recollection):
1. **Who draws it** — which renderers touch this op's preview (3D scene · 2D feature canvas · layout
   pane · anything else), and which of them the op reaches by NAME (a per-op branch) vs generically.
2. **What each renderer READS to decide** — op params? a shared spec? a hand-rolled table keyed on the
   op name? Name the input.
3. **Where the same intent is expressed TWICE** — the drift surface. This is the column that matters:
   every duplicate is a future "the two panes disagree" report.

Then produce a **CANDIDATE DECLARATION SHAPE** — data, not machinery — that could carry what all the
previews need, with a worked example for 3 ops of DIFFERENT character (a probe, a milling op, a lathe
op), so the shape is tested against variety rather than against the easy case.

## ⚠ WHAT THIS ACT MUST NOT DO
- **Do not pick the granularity.** Where reasonable people would slice differently (one block per
  visual element? per pass? per op?), NAME the fork, show what each choice costs, and STOP. Granularity
  is a standing USER ruling on this project — surfacing the fork IS the deliverable, not choosing.
- **Do not build the reader.** A declaration nothing reads yet is cheap and correct at this stage; an
  engine built before the shape is ruled is the expensive mistake.
- **Do not "fix" a preview you find broken.** Log it. This act buys a map, not repairs.

## DELIVERABLE
A design doc (`PREVIEW-AS-DATA.md`) carrying: the per-op table, the duplicate-intent list ranked by
how likely each is to drift, the candidate shape with its 3 worked examples, and the granularity forks
stated as questions with costs. Update `ARCHITECTURE.md` where this survey contradicts it — that map
already caught 8 drifted citations on day one; this act is exactly the kind that would drift it again.

## 📌 CYCLE 856 ACT 3 (queued — dispatch when the survey passes back)
**Measured at t1719:** the honest-baseline act took the gate from **14 → 3** failures (2472 passed, 2
flaky self-healed, 21.1 min). But the 3 survivors — `shared-labels-1611`, `subscriber-error-surface-1656`,
`toolpath2d-anim` — are **names that did NOT fail in the previous run**, and all 7 tests in those files
pass in **8.2 seconds** in isolation.

**So the starved population SHIFTS run to run.** That falsifies the per-spec approach: naming five specs
for retries treats a scheduling lottery as if it had a fixed set of winners. Whichever tests happen to
lose the lottery next run will be a different list, and the "declared quarantine" will keep going stale —
folklore again, just written down.

**The act:** replace the per-spec `retries` with a POLICY at the config level (the population is
whatever contention starves, so the declaration belongs where contention is configured, not on
individual specs), and make the **flaky count** the health metric that gets read at each release. Keep
the genuinely-reasoned quarantines (the `test.fixme` with a traced root cause) — those are real
statements about the product; the per-spec retry lists are not. Re-run the full gate to confirm the
unexplained count is **0**.

## CYCLE 857 ACT 2 — fix the FOUR Tier-0 divergences (they are wrong on screen TODAY)
The survey's Tier 0 is not risk, it is four live defects. Fix them now: they are wrong regardless of how
the user rules the four granularity forks, and none of the fixes commits us to a fork.
1. **`middle_data` shows the wrong stock shape** — the legacy view syncs the 3D stock to round for
   Feature=Boss+Circular; the twin declares no equivalent. `rotaryCenterData.js` already does this
   correctly and non-destructively — follow ITS pattern (`def.simStock`), do not copy the legacy mutation.
2. **`rotary_center_data`'s legacy view mutates persisted `settings.stock`** — a preview writing user
   state is a defect on its own terms. The twin's own comment already states the correct intent.
3. **The lathe tool-identity bug (advisor-verified independently, t1721):** `userOpView.js:365` reads
   `_tbl.type || 'endmill'`, but a lathe-authored tool row only ever writes `kind` (`settingsPanel.js`
   writes num/name/kind/feed/rpm/unit — `type` appears once in the whole file and not for lathe). So
   `_tbl.type` is undefined and EVERY picked lathe tool renders as a flat mill endmill. Fix at the read.
   ⚠ Check whether `kind`'s vocabulary matches what the mesh switch expects — the survey also found
   `'centerdrill'` (code) vs `'centredrill'` (table) — an American/British spelling split. If two spellings
   of one identity exist, that is a SECOND declaration, not a typo: make it one, don't patch both readers.
4. **The ATC magazine pocket list disagrees between hosts** — single-op preview shows every configured
   pocket, whole-program filters to tool-assigned ones. One declared `showMagazine` intent, two
   computations. Make it ONE function both hosts call (the survey's own Good/Bad dividing line).

**Each fix must be a DECLARATION or a single shared function where one fits — not a second hand-rolled
copy that happens to agree today.** That is the exact disease this survey mapped; do not add to it.
Verify each with the real symptom (the picture is right), not only a passing test. Node tier +
hand-picked sweep. Report each as declared-vs-patched and why.

## ✅ USER RULING (2026-08-11) — PREVIEW GRANULARITY: point at the emit's own function
**Fork 1 is ruled: OPTION 1 — a preview declares WHICH function it reuses (`previewSources`), so reuse is
provable by reference identity, not by a snapshot that a currently-agreeing copy also passes.**

Advisor rulings on the other three forks, applied from the user's STANDING rulings (surfaced, not asked —
override any of them by saying so):
- **Fork 2 — 3D stays trace-only** for geometry that has G-code behind it. That property (the 3D toolpath
  CANNOT disagree with the emit, by construction) is free and load-bearing; declaring geometry into 3D
  would re-introduce the two-sources risk this design avoids. Preview-only visuals (Skim marker, probe
  stylus, ATC magazine) keep their explicit channel — that split gets NAMED so a future author cannot
  "improve" the 3D pane by accident.
- **Fork 3 — per-family idioms, formally named.** A universal `def.preview.*` would force lathe/ATC/probe
  into mill's `paths/handles/bbox` shape and manufacture dead fields — this project's own named defect
  class, four instances already (`emits`/`modalPre`/`noSnap`/`mouth`).
- **Fork 4 — RETIRE the 6 legacy views.** Applies [[nothing-is-precious-delete-freely]] +
  [[no-legacy-burden]]: no install base, old files regenerate, and `corner`'s legacy view is already
  deleted with no ill effect. ⚠ EXTRACT FIRST — classify what survivors run THROUGH before cutting.

### The rollout order (advisor's, revisable)
1. **Declare the sources for the ops that ALREADY reuse correctly** (drill/bore `patternPoints`,
   pocket's spiral, `lathe_polygon`'s `polygonPath`, surfacing's Skim table). These are free: the reuse is
   already true, the declaration just records it. It also proves the shape against real cases before any
   consumer exists.
2. **Then the Tier-1 triplicates** (pocket/contour shape-dispatch ×3, `edge_data`'s near-face rule ×4,
   `lathe_parting`'s kerf ×3) — each becomes ONE function the preview points at.
3. **Only then** build the checker, once enough ops declare to make it worth the machinery.
   (Rule of three: do not build the reader for two consumers.)

## ⚠ CORRECTION (t1723, user-caught) — the preview blocks are the UNFINISHED HALF, not a parallel channel
The survey dismissed `shape_rect/circle/line/marker` + `layout2dCanvas`/`sim3dBox` in ONE line ("a third,
parallel 2D-declaration channel — unused by any of these ops today") and the advisor relayed it. **The user
caught it: declaring the preview as data IS the goal of wizards-as-data, so "no twin uses it" is the GAP,
not a justification for adding a fourth mechanism beside it.**

**Measured across all 38 twin files (t1723):** panel (the FRAME) declared in 38 · layout 13 ·
`previewGeometry` 8 · `simStartsProvider` 7 · `simStock` 4 · **shape blocks 0 · layout2d 0 · sim3d 0.**
And `cornerData.js:223,231` says it in its own words: it declares `panel: 'form3d+2d'` — the frame — with
the comment *"per-view rig blocks are a later follow-up."* **The frame is data; the CONTENTS are still
code, deliberately deferred and never scheduled.**

**So `previewSources` as proposed is WITHDRAWN as the vehicle.** The user's ruling stands as a PRINCIPLE
(a preview must provably reuse the emit's own function, not a copy that agrees today) but it rides on the
blocks that already exist — finishing the deferred half — rather than a new `def.*` field beside them.
This is [[restructure-source-not-abstraction]] and "replace, don't parallel" applied to my own proposal.

### NEXT ACT (dispatch when the worker frees) — FIND THE CEILING, don't commit the architecture
Take ONE preview from each family (mill · probe · lathe · ATC) and express it using ONLY the existing
shared primitives (`shape_rect/circle/line/marker` + `layout2dCanvas`/`sim3dBox`). Report, per family,
**exactly where it breaks** — the breakages ARE the proposed family vocabulary, measured rather than
guessed. Do NOT add blocks, do NOT port a wizard, do NOT commit a shape. A survey act again.
⚠ Watch palette growth: a family shares ONE colour, and a new block earns its place only where a
primitive genuinely cannot say the thing.

## ⚠ RESCOPED (t1723, user-caught AGAIN — same turn) — the 4-family ceiling probe is OVER-SCOPED. Do CORNER.
The user invoked their own standing rule: **corner is the GATED PILOT — each mechanism is proven ONCE on
corner and the rest inherit.** A survey that expresses one preview per family (mill/probe/lathe/ATC) asks
"what would all 32 need?" before a single wizard has actually done it — designing for wizards we have not
touched, which is the speculative-machinery trap this project's principles forbid. **The 4-family ceiling
probe is WITHDRAWN.**

**The act is: finish CORNER's preview as declared blocks.** Corner's own source already names it —
`cornerData.js:223` declares `panel: 'form3d+2d'` (the FRAME) and `:231` says *"per-view rig blocks are a
later follow-up."* That follow-up IS the act.
- Express corner's preview CONTENTS with the existing primitives (`shape_rect/circle/line/marker`,
  `layout2dCanvas`, `sim3dBox`). Where they suffice, use them unchanged.
- Where a primitive genuinely cannot say the thing (a probe approach path? per-pass start markers?),
  **STOP and report the gap** — do not invent a block mid-act. The gap is the finding; the user rules
  whether it becomes the first probe-family block.
- The user's principle still binds: whatever feeds those blocks must provably reuse the emit's own
  function, not a copy that agrees today.
- Corner is the pilot and it is ALREADY user-verified on 5 symptoms — a regression here is visible to the
  user immediately, so verify against the real picture, not only a passing test.

**Families are DISCOVERED as each family's first wizard ports, not surveyed upfront.**

---

# 🔨 CYCLE 858 ACT 1 — GIVE CORNER THE WORDS ITS PREVIEW ACTUALLY NEEDS (a BUILD, not a survey)
t1724 measured the ceiling honestly: corner's 2D pane is `items:['hole']`, `handles:['reposition_pos']`,
`paths:0` — an interactive handle, a generic item, and a TRACE-derived path. The existing
`shape_rect/circle/line/marker` vocabulary is deliberately non-interactive and static, so **it cannot say
any of it.** That is why the follow-up was never finished: not neglect, a vocabulary that stops short.
The three container blocks (`layout_2d_canvas`/`sim_3d_box`/`code_preview_panel`) have ZERO readers —
a 5th declared-but-unread instance, and they are DRAGGABLE IN THE PALETTE today, so a user can place one
and nothing happens (this project's own named disease: a control that accepts a gesture and does nothing).

## THE ACT
Design, from CORNER'S REAL NEEDS ONLY, the minimum vocabulary that lets corner declare its preview
CONTENTS, and wire it end-to-end so the pane renders FROM the declaration.
- **Derive the word list from what corner actually draws** — not from what 32 wizards might want. If
  corner needs three words, add three. A word earns its place only where an existing primitive genuinely
  cannot say the thing (t1724 already proved that for the interactive + trace cases).
- **The containers: USE them or REPLACE them — never a third parallel path.** If `layout_2d_canvas`'s
  shape fits, wire it and it stops being dead. If it does not fit, delete it (and its two siblings) in the
  same act rather than leaving inert palette entries beside a new mechanism. Say which and why.
- **Fork 2 still binds:** the toolpath TRACE stays trace-derived (it cannot drift from the emit, for
  free). Declare only what has no G-code behind it — the markers, the handle, the item.
- **The user's principle still binds:** whatever feeds a declared block must provably reuse the emit's own
  function, never a copy that agrees today.
- ⚠ **Palette hygiene** (user rule): the family shares ONE coherent colour, legible, category-consistent.
- ⚠ **Handles are independent** (user rule): dragging one handle must never move another.

## VERIFICATION — corner is USER-VERIFIED on 5 symptoms; a regression here is visible immediately
1. The 16-config corner sweep (exact 3D/Layout coincidence + marker-truth) must be **unmoved**.
2. The picture must be **unchanged to the eye** — screenshot before/after, same params.
3. Emit **byte-identical** (this is preview-only).
4. Prove the wiring to the VISIBLE PIXEL: show the pane rendering from the DECLARATION, not from the old
   code path — a test that passes while the old path is still doing the drawing proves nothing.

---

# 🛑 HARD CONSTRAINT (user, 2026-08-11) — AUTHORING A WIZARD NEVER INVOLVES CHOOSING A PREVIEW
**The preview-family/preview-vocabulary idea is DEAD and may not return through any door.** It was killed
by the project's own north star, not by preference:
- **Principle 1 (one stack, many expressions):** the form, the G-code and the blocks are three RENDERINGS
  of one stack. A preview vocabulary is a FOURTH thing declared BESIDE the stack — not a rendering of it.
- **Sieve gate G3 (one-source):** it keeps a driftable duplicate. The gate fires; no judgement call.
- **The author's seat (the user's own objection, and the decisive one):** *"if I make a wizard I don't want
  to have to choose a family preview block."* Correct. Authoring = assembling a STACK. The picture follows
  from it, exactly as the G-code does. Anything that makes the author describe the picture a second time
  has re-created the duplication this whole leg exists to remove.

**THE TEST any future preview act must pass:** *does an author ever pick, name, or configure a preview
thing?* If yes, the act is wrong — no matter how clean the mechanism looks. Send it back.

**The ONE honest residual, which already exists and is NOT an exception to the above:** visuals with no
G-code behind them (a start marker, a probe stylus, the ATC magazine) cannot be derived from a program
that does not contain them. Those stay declared ON THE OP, once (`def.sim`/`simStartsProvider`/`simStock`
as today) — a property of the op, never a palette choice, never a family. If a future act needs to grow
that, it grows the OP's own declaration; it does not introduce a vocabulary to choose from.

**Consequence for the plan:** the remaining preview work is NOT "add declarations." It is
**"collapse duplicates"** — the 24 surveyed findings, each one fact currently written 2-4 times, each
resolved by making everything call the ONE real function. No new concepts, no new blocks, nothing new for
an author to learn.

## ✏️ REFINEMENT (user, 2026-08-11) — the constraint above splits into TWO LAYERS, and only one is closed
The advisor's "you cannot change a built-in's picture" was OVERSTATED. The user's counter-example decides
it: *"changing the picture is not always a problem for built in, maybe i add a slider for a param we didnt
have."* Correct — a picture only LIES when it CONTRADICTS the program. Adding something the program never
spoke to contradicts nothing.

**① DERIVED layer — has G-code behind it** (cut boundary, toolpath, hole positions).
NOT authorable. Editing it would make the picture disagree with the program on purpose — the exact drift
this leg exists to remove. To change it, change the STACK; the picture follows (principle 1). A user who
adds a param that DRIVES GEOMETRY gets the updated picture for FREE — no preview authoring at all.

**② ADDITIVE layer — no G-code behind it** (a reference marker, a datum dot, an annotation, a stylus).
AUTHORABLE, OPTIONAL, ADDITIVE. It cannot contradict the program because the program never said anything
about it. This is where a user extending a built-in — or authoring a custom op — legitimately needs to
say "put a marker here," and where the useful half of the family idea survives.

**THE CONSTRAINT SURVIVES, sharpened:** an author is NEVER REQUIRED to pick, name or configure a preview.
Building a wizard = assembling a stack; the picture follows. The additive layer is an OPTIONAL EXTRA on
top, never a step in the path. **The test becomes: can an author build a complete, correct wizard without
ever touching a preview thing? If no, the act is wrong.** (Previously: "does an author ever pick a preview
thing" — too strict; it forbade the additive case the user wants.)

⚠ **Still unsized and NOT yet planned:** whether the additive layer is blocks, and what the minimum shape
is. The user's own method applies — answer it against a REAL op they would actually build, not in the
abstract. Do not design it from imagination; that error has been made twice today already.

---

# 📌 OPEN TASKS — carried forward from the 2026-08-11 planning session (do NOT lose these)
No cycle is running. These are the agreed live items, in the order they were established. Each carries
its evidence so a fresh session does not re-derive it.

## 1. THE EMPTY SAVE — a live user-reported bug on the flagship path
**User, 2026-08-11:** *"if i save a built in as custom its empty."* They separately CONFIRMED that
surfacing forks and works — so forking is NOT broken; the fault is ROUTE-SPECIFIC.
Three routes reach "save as custom", and only one loads the stack first:
- ① op card → 🧩 Customize as blocks → 💾 Save wizard… — calls `ddcsEditWizardDef(opType)` FIRST.
  This is the route `fork-parity-1593.spec.js` drives, and it passes on all 33 twins.
- ② header menu → save as wizard (`ui/headerPost.js:51`) — saves WHATEVER is in the Blocks workspace.
  **Its guard checks `window.ddcsSaveAsWizard ? … : notice(...)` — i.e. whether the FUNCTION EXISTS, not
  whether anything is LOADED.** devMode defines that function on init, so with an empty workspace the
  notice never fires and an EMPTY wizard saves silently.
- ③ library modal (`ui/libraryModal.js:170`) — same underlying call as ②.
**Advisor's hypothesis (UNCONFIRMED — reproduction attempt failed to open the Blocks tab, proved nothing):**
② or ③. **Ask the user which button they used before building anything.** Fix direction: the save REFUSES
when there is nothing loaded, and better — saving from a wizard context loads THAT wizard's stack first.
⚠ If it turns out to be route ①, that is far more serious: a test claiming to fork all 33 is lying.

## 2. THE MISSING PROOF — the fork test never checks the PICTURE
`fork-parity-1593.spec.js` asserts form + emit BYTE-IDENTICAL for every twin. It never compares the
preview. **So a fork can come back with a different picture and every test still passes** — exactly the
blind spot that let this week's four wrong pictures live (lathe tool as endmill, middle stock shape,
rotary mutating saved settings, ATC magazine). Extend the fork comparison to the picture. Small, no design
decisions, and it would have caught all four before the user did.

## 3. RETIRE THE OLD SCREENS AND RENDERERS — turns "portable" into "as data"
User has ruled they go ([[nothing-is-precious-delete-freely]], [[no-legacy-burden]]). ~20 dead built-in
screens + **6 legacy renderer views still LIVE and reachable** (an op carrying its raw built-in type
instead of `user_*_data` gets the OLD renderer; **2 of the 6 already behave differently from their twin**).
Only corner's was actually deleted. ⚠ EXTRACT FIRST: 24 of 38 twins import from `wizards/*Wizard.js` —
those imports are STACK BUILDERS (legitimate per principle 2, `BUILDERS(params)==children`), NOT leftovers.
Cut the screens/renderers, keep the builders.
**Why this is the highest-value item:** it serves BOTH ideas at once — the app's cleanliness (one source)
AND the user's ownership (a fork can no longer silently get old behaviour). It is also the step that makes
"wizards as data" TRUE rather than just "portable".

## 4. THE 24 DUPLICATED FACTS (`PREVIEW-AS-DATA.md`, tiered)
Tier 1 (3-4 copies of one fact): pocket shape table ×3 · contour ×3 · edge near-face rule ×4 ·
parting kerf ×3 · comm message format ×3 · ATC sim declared twice with one copy permanently stale.
Tier 2: 9 two-copy items. Tier 3: 5 capability gaps.
**Each is the same move — find the one real function, make everything call it, delete the copies.**
NO new blocks, NO vocabulary, nothing new for an author to learn (see the HARD CONSTRAINT above).
⚠ **Still unanswered by the user:** WHICH of these wizards they actually run on real parts. "Most copies"
is not "most likely to burn you" — ask before ordering the work.

## 5. THE A/B RULING (blocks the machine-variable roll-out to the other 28 ops)
Fields that accept a machine variable had to stop being strict number boxes (a number box discards the `#`
before anything can react, so refusal would be silent). **A** = every field with a rule becomes a text box,
so blocked fields flash red and explain — cost: no spinner arrows / native numeric validation, app-wide.
**B** = only fields that ACCEPT variables convert; blocked ones keep the arrows but ignore `#` silently.
Shipped as **A** in 4 pilot ops (corner + 3) so the user can feel it before ruling. **Do not roll further.**

## 6. THE TWO DEAD CONTAINER BLOCKS
`sim_3d_box` + `code_preview_panel` — zero readers, but present in the palette, so a user can place one and
nothing happens (this project's own named disease). ⚠ **`layout_2d_canvas` is ALIVE and wired** — the shape
vocabulary round-trips through it. The advisor twice reported all three as dead; corrected by the worker at
t1726. Delete the two, keep the one.

## 7. AWAITING THE USER AT THE MACHINE
Bench probes S6h + Expert V13c/a/b.

## 8. THE BLOCKS TAB SHOWS THE WIZARD VIEW, AND ONLY THE WIZARD VIEW (user, 2026-08-11)
**User's instruction:** *"wizard view is the wizard modal view in the blocks tab. now we still have the 3d
preview and projected gcode, in this new system we remove both of these and only use the wizard view."*

**Current shape (measured, `blocks/blocksApp.js:396-404,524-528`):** the right column wears ONE of two
faces from a single predicate (`setRightFace(!!show)`):
- **"Wizard View"** — the Generator Modal — when there IS a wizard;
- **"Preview" + "Projected G-code"** — when there is not.
**The act: delete the second face. The column is always the Wizard View.**

**Why it fits rather than fights the architecture:** the wizard view already carries its own 3D (corner
declares `panel:'form3d+2d'`), so the separate 3D-preview pane is a SECOND rendering of the same picture —
the duplication this whole leg is removing. It also explains item 6: `sim_3d_box` and `code_preview_panel`
are exactly these two panes as blocks, and were never wired because the direction was already heading here.
Deleting them and deleting this face are ONE change, not two.

✅ **NO CAVEAT.** The advisor first wrote a "check where G-code viewing survives" hold on this item. That
was hedging, not diligence — the user gave a clear instruction and the advisor had not looked before
qualifying it. Measured after the user pushed back: the projected-G-code pane IS the code panel
(`blocksApp.js:350`), so nothing else in that column shows the emit — and the user knows that; it is what
they are removing. **Delete both faces' content, the column is the Wizard View. No hold, no condition.**

### 8b. THE SHAPE, AS THE USER STATED IT (2026-08-11) — honest and minimal
*"i want wizard view to apear all the time, and 3d prev and proj gcode to be remove all the time"* … and,
on what the column shows with no wizard: *"i want this honest and minimal, so its either nothing or a
different panel with only the 3d preview."*

**A wizard is loaded → the Wizard View. Always. No predicate, no mode, no fallback-to-something-else.**
**No wizard → NOTHING, or a plain 3D-preview panel. NEVER the Wizard View wearing an empty face.**
**Projected G-code → removed in both cases.**

**What this deletes:** the four-term guess at `blocksApp.js:523` (`authoredHere ‖ customizing ‖ hasTree ‖
def.bindings.length`) and the `setRightFace` switching with it. That predicate is a proxy for "is a wizard
being authored" and its own comment records it being patched twice for guessing wrong (surfacing showed
Preview with the Define-Custom-Wizard block sitting on the canvas — a user-reported gap). Removing the
question removes the wrong answers.

**The honesty property, which is the POINT and must not be traded away for convenience:** the face always
means what it says. A Wizard View shown with no wizard behind it would be exactly the class of lie this
project keeps fixing. Empty is honest; a fake wizard face is not.

**Minimal means minimal:** the no-wizard fallback is AT MOST a bare 3D preview — not the old
preview-plus-code arrangement rebuilt under a new name.

⚠ The block→line link disappears with the code panel. The user has accepted that; do NOT preserve the pane
"just in case", and do NOT invent a replacement. If it is ever wanted back it is a separate, later thing.

### 8c. THE LAYOUT, CURRENT INTENT (user, 2026-08-11): *"so a tab with wizard view and 3d view i guess for now"*
Two TABS in the right column: **Wizard View** and **3D**. The 3D tab is always meaningful (it shows the
program); the Wizard View tab exists only when there is a wizard behind it. So the no-wizard case needs no
special mode and no empty face — 8b's honesty property is satisfied by the tab simply not being there.
Projected G-code is in neither tab; it is gone.

⚠ **"for now" is the user's own word and it is the right weight.** The TAB LAYOUT is a cheap, revisable
presentation choice — do not build machinery around it or treat it as settled architecture. What is NOT
provisional, and does not get undone: the deletion of the projected-G-code pane, the deletion of the
four-term wizard-face predicate, and the rule that a Wizard View is never shown without a wizard.

### 8d. CORRECTION (user, 2026-08-11): **the Wizard tab is ALWAYS THERE**
Supersedes 8c's "the Wizard View tab exists only when there is a wizard." **Both tabs are present
unconditionally.** Only the CONTENT varies: the wizard when one is loaded, EMPTY when not.

**This is simpler AND still honest** — an empty Wizard tab is not a lie; it is a tab with nothing in it,
which is exactly true. The dishonest thing 8b forbids is a wizard face SHOWING a wizard that is not there.
It also removes the last conditional in the column: a tab that appears and disappears is still a decision
the app has to make, and every such decision in this area has been patched for guessing wrong. Always-there
means nothing to decide.

### 8e. AND IT IS EMPTY ON OPS (user, 2026-08-11): *"but empty on ops"*
The Wizard tab is empty **whenever the selected thing is not a wizard — INCLUDING when a plain op is
selected.** A raw atom stack, a hand-built block, an inserted op that is not a wizard: the tab shows
NOTHING. It does not reach for something to display.

⚠ **The tempting wrong moves, all forbidden:** showing the op's parent/nearest wizard · synthesising a
generic form from the op's params · retaining the last wizard that was loaded · any "close enough" face.
Each of those is the app inventing a wizard that is not there, which is precisely the lie 8b exists to
prevent. **Empty is the true answer and it is the required one.**

### 1b. UPDATE (user, 2026-08-11): the empty save NO LONGER REPRODUCES — *"that was before, now it works, in surfacing at least"*
**Do NOT record this as fixed — nothing was fixed.** It was seen, then it was not. That makes it
INTERMITTENT/state-dependent, not resolved, and the trigger is unknown to both the user and the advisor.
**Stop asking the user which button** — the question is retired; they cannot answer it for a symptom that
stopped appearing.

**The code hole is real regardless and does not depend on the repro:** `ui/headerPost.js:51` guards with
`window.ddcsSaveAsWizard ? … : notice(...)` — i.e. whether the FUNCTION EXISTS, not whether anything is
LOADED. devMode defines that function on init, so an empty workspace saves an EMPTY wizard silently and the
notice never fires. `ui/libraryModal.js:170` shares the call.
**The act: make the save REFUSE when there is nothing to save** (and say so). Small, permanent, and it
closes the hole without needing to reproduce the original symptom. Better still, if cheap: saving from a
wizard context loads THAT wizard's stack first, so the gesture simply works.

### 1c. PHASE 0 WITHDRAWN (user, 2026-08-11): *"phase 0 is wrong"*
The advisor proposed opening the plan with "make the save REFUSE when there is nothing to save." The user
rejected it. **The plain fact: it was a fix for a bug whose cause is unknown** — the symptom stopped
reproducing and nothing was measured. That is the same error as the stale anchor dispatch earlier today.

⚠ **The advisor's first version of this entry was dishonest and the user called it out.** It presented an
elaborate rationale ("refusing would HIDE the informative case") as if that had been the reasoning — a
justification reverse-engineered AFTER the rejection and written in the voice of insight. It was not
insight; it was face-saving. **The advisor does not know which reason the user meant, and the record must
not pretend otherwise.**

**Status: the empty save stays OPEN and UNEXPLAINED.** No fix until there is a cause. The
`headerPost.js:51` guard is a noted oddity, NOT a diagnosis.

### 1d. CLOSED — NOT A DEFECT (user, 2026-08-11)
The user's objection to Phase 0 was not "you are fixing a guessed cause" (the advisor's assumption, itself
then dressed up — see 1c). It was simpler and better: **why prevent a no-wizard save at all?**

**Because saving a stack that has no wizard around it is the NORMAL WAY TO MAKE ONE.** Assemble atoms,
save, and now it is a wizard. A guard that refuses "nothing to save" would refuse the very act of creating
a wizard from a bare stack. `devMode.js:277` already says it plainly: *"with no exposures it saves a
parameterless wizard."* That is not a failure mode — a wizard with no parameters is a button that runs a
fixed operation, which is a legitimate thing to want.

**So the empty save is CLOSED as not-a-defect.** A stack with no exposed params saves as a wizard with an
empty form; that is the correct outcome of what was saved. No fix, no guard, no further investigation.
Items 1, 1b and 1c are superseded by this. Do not resurrect them.

### 1e. THE ACTUAL SYMPTOM, IN THE USER'S WORDS (2026-08-11) — the advisor had been recording a mangled version
*"i had a built in open and saved as custom and reopening shows no param, but that was before now it works."*

**That is NOT "saving an empty workspace."** It is: a BUILT-IN was open → saved as custom → the resulting
custom wizard REOPENED WITH NO PARAMETERS. A built-in has a form, so a fork of one showing no params is
wrong on its face. The advisor drifted this into "an empty Blocks workspace was saved", then closed it as
not-a-defect on the (true but IRRELEVANT) grounds that a parameterless wizard is a legitimate thing to
save. **1d's closure reasoning does not apply to the symptom the user actually reported.**

**Why it matters even though it no longer reproduces:** `fork-parity-1593.spec.js` forks EVERY twin and
asserts the FORM comes back BYTE-IDENTICAL. The user's symptom is that assertion failing in the real app.
So either (a) a real intermittent fault exists on that path, or (b) the test's route differs from the
user's gesture — and (b) would mean the test does not cover what a user actually does.

**Status: OPEN, unexplained, NOT reproducible today. No fix — there is no cause.** If it recurs, capture
the FORKED wizard's stored definition (does it have bindings/params?) — that separates "the fork lost the
form" from "the form is there but not rendering". Do not add a guard. Do not close this again as
not-a-defect.

---

# 🔨 GAMEPLAN STEP 1 — EXTRACT THE STACK BUILDERS (user: "go", 2026-08-11)
**Nothing user-visible changes in this act.** Its whole purpose is to make the deletions in step 2 safe.

**The situation, measured (t1725):** 24 of 38 twin files import from `web/wizards/*Wizard.js`, e.g.
`cornerData.js:44` imports `cornerStack, cornerReposOffsets, dirsOf, cornerHeaderComments`. Those imports
are **STACK BUILDERS and they are legitimate** — principle 2 is `BUILDERS(op.params) == op.children`, so a
builder being code is the architecture working, not a half-finished port. But they currently live in the
SAME FILES as the ~20 dead screens and the 6 live legacy renderers that step 2 deletes. Until the builders
are out, every deletion risks taking something load-bearing with it.

## THE ACT
Move the stack builders (and only the builders, plus whatever they genuinely need) out of the old wizard
files into a home of their own. Leave the screens and the legacy views behind, untouched, for step 2.
- **Classify before moving.** For each old wizard file, say what each export IS: builder · screen ·
  legacy renderer · shared helper. Report the classification — it is also step 2's delete-list.
- **Pure move.** No renaming, no "while I'm in here" tidying, no signature changes, no reformatting.
  A diff that shows behaviour changes has failed this act.
- **If an export resists classification, STOP and report it.** Do not guess. A helper used by BOTH a
  builder and a screen is the interesting case and the user should hear about it, not have it decided
  silently.

## VERIFICATION — this act's whole value is that it changed nothing
1. **`fork-parity-1593` byte-identical, all 33** — form AND emit. This is the act's primary gate.
2. Node tier 118/118, plus a hand-picked sweep of whatever the moved builders touch.
3. **Emit byte-identical everywhere** — if any G-code moves, the move was not pure.
4. Report the classification table (builder/screen/renderer/helper per file) — step 2 depends on it.

### Step 2 exclusion, ADVISOR-VERIFIED (t1729): communicationWizard.js is NOT a legacy screen
Independently confirmed (not taken on the worker's word): `userOpView.js:618` —
`host.innerHTML = _commWizard.generateScreenPreview(params)` — is the comm TWIN's own preview panel
calling `CommunicationWizard.generateScreenPreview()` directly, live, every time a comm op is opened. It
draws a mock of the DDCS controller's screen (title/message/Enter-Esc buttons) for the popup/status/input
op being authored. **This is not dead code wearing an old filename — it is the one place that drawing
logic lives, called by the CURRENT wizard, not a fallback.**

**Consequence: `communicationWizard.js`'s `CommunicationWizard` class is EXCLUDED from step 2's deletion
pass, full stop.** Its builder (`commStack`) already moved out in step 1; the class stays where it is.
A future relocate/rename is fine; a delete is not.

**Noted for later, not now:** `generateScreenPreview()` draws something with NO G-code behind it — exactly
the "additive layer" named in item 8b/8e's preview discussion. A real candidate for becoming a declared
preview-only visual eventually, but that is design work, not part of the gameplan's deletion step.

---

# 🔨 GAMEPLAN STEP 2 — DELETE THE OLD SCREENS AND LEGACY RENDERERS (user: "ok go", 2026-08-11)

**Advisor pre-check before dispatch (t1729):** there are TWO separate risk tiers here, not one, and they
must not be collapsed into a single blanket delete.

**TIER A — genuinely unreachable dead code.** Confirmed by t1728's classification + advisor spot-check:
`circularWizard.js` (whole file — no twin, no BUILTINS/opensAs entry, `CircularWizard` zero importers
anywhere) and every `D`-marked class in the classification table (`CornerWizard` already zero importers,
confirmed twice now). **Delete outright. No user-visible path can reach these today.**

**TIER B — reachable via `opBuilders.js`'s `BUILDERS` map or the 6 `wizards/views/*View.js` legacy
renderers** (`middleView.js`/`edgeView.js`/`alignmentView.js`/`rotaryCenterView.js`/`rotaryClockView.js`/
`homingView.js`) — the path an OP CARRYING ITS RAW BUILT-IN TYPE takes (an old `.ddcs` save, or a
Blocks-authored raw block, instead of the twin's `user_*_data` type). `opBuilders.js`'s `BUILDERS` map is
imported by live, reachable machinery (`userOpView.js`, `panelTypes.js`, `editorManager.js`, `opSession.js`
and others) — so this is NOT dead code the way Tier A is. It is exactly the old-format-compatibility path.

**Per [[nothing-is-precious-delete-freely]] the user has already ruled programs are remakeable, so removing
this path is consistent with policy — but ONLY IF removal fails GRACEFULLY.** A user who opens an old save
carrying a raw built-in type must get a clear "unsupported, re-author from the wizard" message, never a
crash or a silent blank pane. **Verify the failure mode BEFORE deleting Tier B, with a real old-format
file/op, not by inspection.** If it does not already fail gracefully, that is a small prerequisite fix, not
grounds to keep the dead renderer.

⚠ **EXCLUDED, both tiers:** `communicationWizard.js`'s `CommunicationWizard` class — advisor-verified
(t1729) as the comm twin's own LIVE preview renderer (`userOpView.js:618`), not a legacy screen. Its
builder already moved in step 1; the class itself is untouched by this act.

## THE ACT
1. Delete Tier A outright (circularWizard.js + every zero-importer `D`-class from the classification).
2. For Tier B: verify the graceful-degradation path FIRST (construct/open an old-format op of each of the
   6 renderer types, confirm the fallback message, not a crash). Fix the fallback if it is not already
   clean. THEN delete the 6 `*View.js` files and their dispatch wiring, and the corresponding dead
   `opBuilders.js` entries IF nothing else needs them (check — `BUILDERS` also feeds live twin creation
   for op types that still have no twin at all; do not remove an entry a live wizard still needs).
3. Report, per file: which tier, what was deleted, and (Tier B only) what the user now sees when an old
   raw-type file is opened.

## VERIFICATION
- fork-parity-1593 byte-identical, all 33 (primary gate, as step 1).
- Node tier 118/118.
- A real old-format file/op of at least 2 of the 6 Tier-B types, opened live, showing the graceful message.
- ARCHITECTURE.md / architecture-map-1698.test.mjs — this act WILL touch cited files; expect and fix drift.

## ⚠ SIMPLIFIED (user, 2026-08-11) — Tier B's raw-type verification is DROPPED
The advisor's step-2 dispatch gated Tier B (the 6 legacy renderer views) on verifying graceful degradation
for an old-format op first. **User pushback: "so youre just telling me youll build a alarm for outdated
wiz" — and separately, "no save file exist on my end."** Correct on both counts:
- There is no old-save audience to protect (none exist), so the check was solving for a case that is not
  real — the same over-caution pattern flagged repeatedly today (an invented hold on a decision already
  made).
- What actually needed protecting — "did the deletion break something still wired to these files" — is
  already covered by fork-parity (byte-identical, all 33) + the node tier + the app booting normally. A
  broken import surfaces as a hard error, not a silent gap needing a dedicated test.

**DROPPED. Tier A and Tier B delete on the same gate: fork-parity + node tier + a normal app boot. No new
UI, no new fallback message, no dedicated legacy-path test.** If deletion later surfaces a REAL crash on a
path that matters, that is a normal bug to fix then — not a reason to have pre-built ceremony now.

---

# 🔨 GAMEPLAN STEP 3 — THE BLOCKS TAB IS THE WIZARD VIEW (user: "yes", 2026-08-11)
The user's spec, gathered across items 8/8b/8c/8d/8e — read those for the reasoning; this is the act.

## THE SHAPE
Right column = **TWO TABS, both ALWAYS PRESENT, unconditionally: "Wizard View" and "3D".**
- **Wizard View tab content:** the wizard when one is loaded. **EMPTY otherwise — including when a plain
  op is selected.** It never reaches for something to show.
- **3D tab:** the program's 3D preview. Always meaningful.
- **Projected G-code: DELETED.** Both faces. The block→line link goes with it — the user has explicitly
  accepted that; do NOT preserve the pane "just in case" and do NOT invent a replacement.

## WHAT THIS DELETES (the point of the act — it removes more than it adds)
1. **The four-term wizard-face predicate** (`blocksApp.js:523`):
   `show = authoredHere || customizing || hasTree || (def && (editingWizardType() || def.bindings.length))`
   — plus `setRightFace()` and the `.wizard-view` class-toggling that reads it. That predicate is a PROXY
   for "is a wizard being authored" and its OWN comment records it being patched twice for guessing wrong
   (surfacing showed the Preview face with the Define-Custom-Wizard block sitting on the canvas — a
   user-reported gap). **Two always-present tabs ask no question, so there are no wrong answers.**
2. **The projected-G-code pane** and its code-panel rendering in that column.
3. **The two dead container blocks** — `sim_3d_box`, `code_preview_panel` (zero readers, but DRAGGABLE in
   the palette today, so a user can place one and nothing happens). They ARE these two panes as blocks;
   deleting the face and deleting them is ONE change.
   ⚠ **`layout_2d_canvas` is ALIVE — the shape vocabulary round-ABOUTS through it. KEEP IT.** The advisor
   twice mis-reported all three as dead; corrected at t1726.

## THE HONESTY PROPERTY — the point, not a nice-to-have
**A Wizard View shown with no wizard behind it would be a lie about what the user is looking at** — the
same class of fault as a control that does nothing or a picture that disagrees with the program. An EMPTY
tab is honest; a tab that always shows *something* is not. **Forbidden substitutes:** the op's
parent/nearest wizard · a synthesised generic form from the op's params · retaining the last wizard
loaded · any "close enough" face.

## VERIFICATION
- fork-parity-1593 byte-identical, all 33 (unchanged primary gate).
- Node tier 118/118.
- **Drive the REAL gestures and show them:** (a) a wizard loaded → Wizard View has the wizard; (b) a plain
  op selected → Wizard View is EMPTY, 3D still works; (c) empty workspace → both tabs present, wizard tab
  empty. Screenshots, not assertions alone.
- ⚠ Expect collateral: `wizard-face-1599.spec.js` exists specifically to test the predicate being deleted.
  Tests asserting the OLD two-face behaviour are stale BY DESIGN of this act — repoint or retire them with
  a stated reason, never weaken an assertion to make it pass.

### 3b. USER RULING (2026-08-11) — the Wizard View mirrors the OPEN WIZARD, not the workspace
Advisor's step-3 spec said "the wizard when one is LOADED", and `deriveLiveWizard()` derives from the
Blockly WORKSPACE — so opening a built-in from the bar and switching to Blocks would have shown EMPTY.
**The user asked the exact question that exposed it** (*"so now if i simply open a built in and open blocks
it should show a wizard view?"*) and ruled **B**:

**The Wizard View tab mirrors the CURRENTLY OPEN WIZARD.** Open Corner from the bar → switch to Blocks →
the Wizard View shows Corner. **No "Customize as blocks" step is required first** — that step stops being
a prerequisite for merely SEEING the wizard. This matches the user's original framing: *"wizard view is
the wizard modal view in the blocks tab."* It removes a step rather than adding one.

**The honesty rule is unchanged and still binds** (8b/8e): EMPTY when no wizard is open at all, EMPTY when
a plain op is selected. It simply triggers less often. All deletions are identical under either reading.

### 3c. USER RULING (2026-08-11) — the mirrored Wizard View must show the REAL values, not defaults
Worker shipped step 3 with the Wizard View mirroring WHICH wizard is open but rendering the def's declared
DEFAULTS, not the values live-typed into the open modal (value parity attempted, then scoped out — see
WORK-LOG t1734 AMENDMENT). Flagged for a ruling. **User ruled: real values.**
*"Well really it's about honesty so it better if it's the real values."*

**Why it is the same rule, not a preference:** a field reading `dist=500` while the user has `777` typed
in the other view is not a placeholder — it is a WRONG VALUE PRESENTED AS A REAL ONE, with nothing on
screen saying "these are defaults". Same class as a picture that disagrees with the program, a control
that accepts a gesture and does nothing, and a Wizard View pretending to hold a wizard it does not.
**It is strictly worse than the EMPTY case 8b deliberately allows: empty claims nothing; a stale number
claims something false.**

**What is already established (do not re-derive):** `getLastOp()` genuinely carries live values (verified
live at t1734: `dist: 500` → `777` after `fill()` + `wizardManager.update()`). The blocker is that a
`hasTree` twin renders through `formBindings({...def, template:[userRoot]})`, which re-derives each
field's value from `userRoot`'s OWN template tree (each `param_field`'s embedded `dflt`) and never from
`def.bindings` — so the t1734 overlay silently no-oped for exactly Corner's shape while working for
flat-bindings twins. **Inconsistent-across-shapes was correctly rejected; the fix is to make the template
path read the live values too.**

### 3d. ⛔ AMENDMENT B WAS UNREACHABLE — user ruled: ONLY the closed-wizard case (2026-08-11)
**Measured at t1737, in the real app:** with a wizard open, `document.elementFromPoint()` at the BLOCKS
tab's own centre returns `DIV.wiz-box.large` — **the modal covers the tab bar. A human CANNOT switch to
Blocks while a wizard is open.** So the t1736 mirror, which keys on `wizardElement.classList.active`
(cleared by Cancel/Insert), fires ONLY for a script. By the time the user can reach the Blocks tab the
flag is already cleared → the pane is empty, every time. That is exactly the screenshot they sent.

⚠ **Advisor's own failure, and it is the project's named one:** I "verified" amendment B by calling
`openWiz()` + `showApp()` from code, which bypasses the modal entirely. The test passed, the feature
looked shipped, and it was never reachable by a user. **Prove the wiring to the VISIBLE PIXEL** — I
enforce that on the worker and broke it myself in the same session.

**User's ruling, verbatim:** *"i dont want 1-2 i only want 3"* — i.e. the ONLY case that matters is:
**close the wizard (Cancel/Insert) → switch to Blocks → the Wizard View shows that wizard.**

**So the `.active`-keyed mirror is DELETED, not repaired.** The pane must be driven by what is ON THE
CANVAS in that tab — the state that survives closing the modal, which is precisely when the user is
looking at it. Canvas-authoring derivation already does this and already works (advisor-verified t1737:
`ddcsEditWizardDef('user_corner_data')` renders 23 fields). The act is to make the CLOSE→BLOCKS path land
in that same state, and to remove the unreachable modal-mirror + its live-value patching that exists only
to serve it.

⚠ Everything else from step 3 STANDS: two always-present tabs, the four-term predicate deleted, projected
G-code deleted, `sim_3d_box`/`code_preview_panel` deleted, `layout_2d_canvas` kept, and the honesty rule
(EMPTY on a plain op, EMPTY when there is genuinely no wizard).

### 3e. ✅ THE WIZARD VIEW, SETTLED (user, 2026-08-11) — a live preview of what you are about to SAVE
Three advisor guesses were all wrong and are all withdrawn: the last-opened wizard (`getLastOp`), the
still-open modal (`wizardElement.active`), and the whole-program-as-forms reading. **The user's own
statement decides it:** *"the goal of the wizard view is to see what im about to save as a custom
wizard"*, and on multiple ops: *"all of them"*.

**THE REQUIREMENT:** the Wizard View renders **the ENTIRE stack currently on the Blocks canvas, as the
FORM it will become when saved as a custom wizard** — every op in it, every exposed param, in stack
order. Not one wizard, not the last one, not a session detail. It is a live preview of the save.

**This is what the pane already claims to be** — `index.html:1207`: *"Generator Modal · live — the form is
a live view of the blocks, no save needed"* — and the canvas-authoring derivation ALREADY does it for the
single-wizard case (advisor-verified t1737: `ddcsEditWizardDef('user_corner_data')` → 23 fields rendered).
So this is mostly "make the existing thing cover the whole stack", not a new mechanism.

**Why the side-channels were wrong, in the user's words:** *"doesnt the stack carry the wizard anyways…
my stack wizard is data."* Correct — measured at t1737, the inserted op already carries
`{opType, params:{dist:777}, children}`. Any tracked "last op" or "modal open" flag is a SECOND COPY of a
fact the stack already holds. **One source: the canvas stack.**

**Honesty rule needs no special cases under this reading:** nothing on the canvas → EMPTY; nothing on it
exposes a form → EMPTY (or the existing "no fields yet" hint). Nothing can go stale because nothing is
tracked separately.

⚠ **OPEN BUG, separate from the requirement:** the user photographed a full Define Custom Wizard on the
canvas (Parameter Group, ~14 form-field blocks) with the pane BLANK. That is the case that is supposed to
work and that the advisor reproduced working. Asked the user to hard-reload first (ES-module cache is a
known trap here — [[verify-release-needs-hard-reload]]); if it persists it is a real defect in the
canvas→form path and must be chased there, NOT in the deleted mirror.

### 3f. USER (2026-08-11): *"can the preview look more like the modal?"* → it must BE the modal's renderer
**First: the blank pane was STALE CACHED CODE.** After a hard reload it renders. Not a defect —
[[verify-release-needs-hard-reload]] again.

**The real finding, from the user's two screenshots side by side:** the pane and the modal render the SAME
wizard through TWO DIFFERENT PATHS, and they visibly disagree.
- pane: `renderOpForm(formHost, formBindings(def))` (`blocksApp.js:634`) — a simplified form renderer.
- modal: `openLiveAsModal()` (`blocksApp.js:496`) → the REAL wizard overlay via wizardManager/userOpView.

Measured differences: raw `FORM`/`LAYOUT-2D`/`3D-SIM` headings vs the modal's `IDENTITY`/`GEOMETRY`
grouping · identity fields (Corner, Probe Order) MISSING from the pane · stray unlabelled inputs (`5`,
`200`, `3`, `10`) in the pane with no labels · FEATURE CANVAS empty black in the pane, the real 92-line
probe path in the modal · VISUALIZATION empty black in the pane, the live 3D in the modal.

**This is the project's own named defect — two renderers for one thing — inside the very pane whose job is
to show what you will get.** A preview that approximates the result defeats its own purpose: the user
would be checking a lookalike before saving.

**THE ACT: the Wizard View renders through the SAME path the modal uses, hosted in the pane.** Not styled
to match — the same renderer. `openLiveAsModal` already proves the modal can be driven from the canvas's
own derived def, so the mechanism exists; the pane should use it rather than `renderOpForm` directly.
**Do NOT "fix" the pane by adding grouping/canvas code to the simplified renderer** — that builds the
second copy deliberately, which is the thing being removed.

⚠ Honesty rule and everything else from step 3 unchanged. If the modal's renderer genuinely cannot be
hosted in a narrow pane without a rewrite, STOP and report the constraint rather than shipping a
half-match.

### 3g. ADVISOR RULINGS on the worker's two STOP questions (t1739)
The worker stopped rather than ship a half-match (correct) and asked two questions.

**Q2 — is multi-op in scope? NO, and as a CORRECTION not a deferral.** Measured: `authoringBody()`
(`devMode.js:67`) does `stack.find(b => b.type === 'op')` — **the save itself takes ONE op** (or a bare
chain when there is no op wrapper). So a preview showing "all of them" would show something the SAVE DOES
NOT PRODUCE, which breaks the pane's single job (3e: see what you are about to save). The user's "all of
them" answered the ADVISOR's badly-framed question about a multi-op PROGRAM; the pane previews the SAVE,
and the save is one op. **If multi-op saving is ever wanted, that is a change to SAVING — the preview then
follows it for free, which is the point of one renderer.**

**Q1 — A or B? Take A (parameterise `userOpView` to a host container).**
- **B (relocate the singleton panel between pane/modal slots) is REJECTED:** it works only because the
  modal currently covers the tab bar so both can never be visible at once. That is an INCIDENTAL fact
  about today's layout, not a guarantee — and this session has spent its whole length removing mechanisms
  that depended on incidental state (`.active`, `getLastOp`, the four-term face predicate). Reparenting a
  live panel also risks canvas/WebGL and sizing breakage for no architectural gain.
- **A is 18+ MECHANICAL substitutions** (`document.getElementById('wiz_user_form')` →
  `host.querySelector(...)`), no logic change, and it makes the renderer HOST-AGNOSTIC — the same
  "one thing, many views" shape as the rest of the project. Future hosts cost nothing.
⚠ If A uncovers real logic (not just DOM lookups) welded to the modal singleton, STOP and report again
rather than pushing through — that would be a different, larger finding.

---

## 📌 SMALL, REAL — the multi-op save silently drops work (found by the user, t1739)
`authoringBody()` (`devMode.js:67`) does `stack.find(b => b.type === 'op')` — **the FIRST op only.** With
several ops on the canvas, Save wizard… keeps one and DISCARDS THE REST WITH NO WARNING. Grepped: no
multi-op guard anywhere in the save path. Same family as the semicolon eating a G-code line — the app
accepts a gesture and quietly does something other than what it implies, and here the loss is invisible
exactly when the user would trust it (the saved wizard works; it just is not what they built).

**Fix: REFUSE, and say why** — e.g. "This canvas has 3 ops; a wizard saves one. Remove the others, or open
just the one you want." (Advisor's call over "save the first + warn": a selector or a warning makes
picking-one look like the intended workflow, when the real answer is that a wizard IS one op.)

### Ruled out, and why — do NOT resurrect these
- **Compound / multi-op wizards: NOT NEEDED.** A wizard is ONE op whose stack can already contain as many
  STEPS as you like (atoms in sequence). "Several ops on the canvas saved together" would invent merging
  rules (duplicate feed rates, field order, what reopening shows) for something already achievable.
  **User: *"i think im against multiop at all in the canvas… users should be able to add ops directly in a
  wizard"* — and they can, at atom level, today.**
- **A save-time op SELECTOR: rejected.** Same reason — it normalises a workflow that should not exist.
- ⚠ **Precision, since the advisor was loose about it:** a wizard's GCODE mouth holds ATOMS, not other `op`
  blocks. `opunit` is a TRANSPARENT grouping of atoms (`userRoot.js:56`, emits byte-identically to the
  atoms loose, `hidden: true` — created programmatically at fork, never dragged).
- **Draggable `opunit` + "add a Surfacing step" authoring gesture: NOTED, NOT NOW.** User: *"lets not go
  there right now, we can simply add steps."* The transparent-boundary mechanism already exists and is
  proven; only the authoring gesture is missing. Revisit against a REAL wizard the user wants to build.

## 📌 THE BLOCKS CANVAS AUTHORS ONE WIZARD — insert REPLACES, with a notice (user, 2026-08-11)
**Supersedes the "refuse at save" fix above** — this removes the silent-drop hole BY CONSTRUCTION instead
of guarding it: there is never a second op to lose.

**The rule:** in the BLOCKS tab, inserting a wizard REPLACES the canvas contents rather than appending.
That canvas is for authoring ONE wizard — which is what a wizard is (one op, whose stack holds as many
STEPS as you like). Users author extra steps INTO the wizard; they do not stack ops beside it.
User: *"id rather let users learn to author them in."*

**⚠ A NOTICE IS REQUIRED before clearing** (user: *"obvi there should be a notice about the ops gonna be
cleared"*). Replacing DISCARDS whatever was on the canvas, so the gesture must say so before it happens —
silently wiping authored work is the same disease as silently dropping ops at save, just faster. Name what
is being cleared, not a generic "are you sure".

**Advisor's scoping questions, NOT yet ruled by the user — do not assume:**
- **Scope: BLOCKS only.** STUDIO's insert builds the user's PROGRAM and must keep APPENDING — that is what
  a program is. (Advisor's read, stated for the user to correct.)
- **When to warn:** only when there is something to lose (canvas edited and unsaved). A fresh/untouched
  canvas replaces silently — nothing to protect, and a prompt on every insert becomes noise the user
  learns to click through, which defeats the point.

**Tension to keep in view:** the user earlier valued stacking two ops and editing them SEPARATELY. That
still holds — in the PROGRAM (STUDIO), which is where a multi-op program belongs. The Blocks canvas is an
authoring surface, not a program.

### ⛔ WITHDRAWN (t1739) — the "insert replaces on the Blocks canvas" entry above is on the WRONG SURFACE
The user was talking about **STUDIO**, not the Blocks canvas. The advisor mapped the question onto Blocks
and wrote a whole rule (replace + notice + scoping assumptions) about a surface the user was not asking
about. **User: *"nope … i was talking about studio, i dont even understand how to add wiz gcode through
blocks."*** Withdraw that entry entirely — do not implement it.

**And the premise was wrong too.** STUDIO's insert is NOT append-only: `wizardManager.insert()` (:464)
branches on `this.editingOpId` — open an op that is already in the program and Insert does a SURGICAL
WRITEBACK to that op (replace-in-place); it only ADDS when nothing is being edited. So "can insert replace
instead" already partly IS the behaviour, and the real question was never asked properly.

⚠ **The advisor's larger error, worth naming:** several recent conclusions assumed adding ops on the
BLOCKS canvas is a normal user workflow. The user says they do not even know how they would do that. **Do
not build on that assumption.** Re-establish what the user actually does in each surface before drawing
any more conclusions about canvas behaviour.

### 3h. USER (2026-08-11) — the Wizard View pane must NOT have working Insert / Cancel
*"one thing i do not want for the wizard view, is the insert cancel button to work."*

**Why it matters now:** 3f makes the pane render through the MODAL's own renderer, so INSERT and CANCEL
come along with it. In that pane they would be actively wrong — the Blocks tab does not run or build a
program (user: *"we cant run wizard in blocks"*); it BUILDS a wizard and EDITS an op. An Insert there
would silently commit an op into the user's program from a surface that is not for that.

**Requirement: they must be INERT, not merely hidden.** Hiding the buttons while the commit path stays
live is the failure shape this project keeps hitting — some other route (Enter key, a shortcut, a
programmatic caller) reaches the same commit and it fires anyway. **Verify the ACTION cannot happen, not
just that the button is not visible.**

⚠ **Advisor note — do NOT over-build this.** The obvious wrong fix is a new "preview mode" flag threaded
through the renderer. Prefer the smallest honest thing: the pane's host simply does not carry those
controls / their handlers. If the modal's renderer cannot omit them without a mode flag, say so and report
the constraint rather than inventing one. **The full-size modal (⧉ Open as modal) KEEPS its Insert/Cancel —
that IS the wizard, and it is unaffected by this.**

### 3i. WHY THE USER CARES ABOUT THE BUILT-IN CASE (2026-08-11) — it is the PROOF of wizards-as-data
*"so im asking about built in, in wizard view because to me it would make concrete the idea that they are
each merely a view of the data."*

**The pane is not a convenience — it is the DEMONSTRATION.** If Corner is genuinely just data, then one
source renders three ways: the modal's form, the blocks on the canvas, and the Wizard View's form. Insert
a built-in, open Blocks, and you should SEE that. **An empty pane does not merely look broken — it says
the built-in is not really data yet**, that something about it works only through its own front door.

**So the acceptance test is by EYE, not by argument, and it applies to EVERY wizard:**
insert any wizard (built-in or user-authored) → open Blocks → its form is there, the same way.
If built-ins render and custom ones do not (or the reverse), that is the two-classes-of-citizen problem
made visible — and this pane is where it shows.

⚠ This raises the bar on the current act: "make the pane populate for corner" is NOT sufficient. The
worker should sample ACROSS the twin families (a probe, a mill op, a lathe op, an ATC op) and report any
that do NOT render identically — a wizard that renders differently here is a real wizards-as-data gap,
not a pane bug, and the user wants to know about it either way.

---

# 🔁 TODAY'S LOOP (user: "sure", 2026-08-11) — three acts, sequential, same tree
Sequential NOT parallel: ② and ③ touch files ① is rewriting, and two writers in one tree is the trap.

## ① FINISH THE ONE RENDERER (in flight, turn 1740)
**The acceptance test, and it is the user's own:** *does the pane RENDER BY CALLING the modal's render
path, or does it still have its own?* Advisor checked the in-flight tree at t1739 and the pane still calls
`renderOpForm(formHost, formBindings(def))` directly (`blocksApp.js:619`) while the modal renders through
`userOpView`. What HAS landed is shared HELPERS (`formSig`/`syncFormValues` moved into `formWidgets.js`) —
real de-duplication, but that is two renderers sharing utilities, not one renderer.
**Matching OUTPUT is the state we already had. If the pane still owns a render path, the act is not done —
however similar the result looks.** (User: *"it sortof still look like a second renderer still."*)
Already fixed inside this act and guarded: the empty-pane bug —
`wizard-face-1599.spec.js:110 "a PLACED data-op twin in a program renders its LIVE form"` now passes.

## ② MIDDLE GAINS THE CLEARANCE MODE
Corner offers Hop / Plane clearance; **Middle does not — `middleData.js`'s MIDDLE_BINDING_SPECS never
declared `clearMode`/`hopDist`/`planeZ`** (28 bindings, none of those three). The EMIT side genuinely
supports it: `stacks/middleWizard.js:81-85` reads `params.clearMode/hopDist/planeZ` already. So this is a
missing DECLARATION, not new machinery — follow `cornerData.js`'s own declaration of the same trio.
Found at t1730 when the deleted legacy view stopped absorbing the test.
⚠ Middle's form GROWS by three fields — a visible change to a wizard the user uses. Expected, not a defect.
Un-fixme `clearance-form-921.spec.js` when it lands (it was parked naming exactly this).

## ③ THE SIMULATED PROBE DISC RESPECTS TIP-RADIUS COMPENSATION
`readEnabledComps()` (`viz/createPreviewPanel.js:43`) loops `for (const a of (stack || []))` — **TOP LEVEL
ONLY**. A twin's builder returns a `user_root`-wrapped stack, so nested `radiuscomp` atoms are never seen
and the comp map comes back empty. **Broken for EVERY twin probe** (confirmed on middle and corner).
**SIM-ONLY — advisor verified the emit is unaffected:** `readEnabledComps` is read exclusively by the
preview panel (`:717`, `:1146`); the `radiuscomp` atom still emits normally. So the machine is fine and the
PICTURE is wrong — the disc lands on the raw surface instead of the compensated one.
Un-fixme `editor-sim-disc.spec.js` when it lands.

## ⚙️ ACT SIZING — the advisor was dispatching acts far too large (user, 2026-08-11)
*"can you actually break down the workers load more"* — correct, and it is an ADVISOR failure. Turn 1740
accumulated SIX amendments and 1166 changed lines in one file. **An act that large cannot be reviewed
meaningfully, which removes the second-observer value the loop exists for**, and a mid-act correction then
lands on top of work already built on the older reading.

**RULE: one act = one verifiable change, with its own gate.** If a dispatch needs more than ~2 amendments,
it was mis-sized — split it and re-dispatch rather than amending further. Prefer passing back sooner: a
short act reviewed is worth more than a long act trusted.

### ① BROKEN DOWN — the one-renderer work, four acts instead of one
- **1a — PARAMETERISE (in flight, narrowed t1739).** `userOpView`'s render takes a HOST container; the
  mechanical `getElementById` → `host.querySelector` substitutions. The MODAL passes its own host, so its
  behaviour is byte-identical. *Gate: modal unchanged — fork-parity 33/33, node 118/118, open-as-modal +
  wizard-face specs green.* **Nothing else in this act.**
- **1b — THE PANE CALLS IT.** Point the pane at the parameterised render with the pane's host, and DELETE
  the pane's own `renderOpForm(formHost, formBindings(def))` path (`blocksApp.js:619`). *Gate — the user's
  own test: the pane RENDERS BY CALLING the modal's path, not a lookalike. Matching output is the state we
  already have.* Drive the real gesture: built-in → INSERT → BLOCKS.
- **1c — INERT INSERT/CANCEL + WRITEBACK.** Insert/Cancel inert in the pane (the ACTION cannot happen, not
  merely hidden); Open-as-modal writes back IN PLACE when editing an existing op, inert when authoring a
  new wizard, never "add a copy". *Gate: prove the action cannot fire, including by keyboard.*
- **1d — SAMPLE ACROSS FAMILIES.** A probe, a mill op, a lathe op, an ATC op, each via the user's gesture.
  Report a per-family table; any that render differently is a wizards-as-data GAP to surface, not smooth
  over (3i).

## 🔪 FINER SPLIT (user: "split more", 2026-08-11) — supersedes the 1a-1d list
**One act = one change + one check the advisor can verify in a single command.** No act should need more
than 2 amendments; a third means it was mis-sized — pass back, re-slice, re-dispatch.

### The one-renderer work
- **1a ✅ LANDED** — `createUserOpView(ns)` factory; modal uses `createUserOpView(null)`.
  *Check: `grep createUserOpView userOpView.js` + modal byte-identical.*
- **1b-i — PANE SCAFFOLD ONLY.** Give the pane host the namespaced ids/structure a `createUserOpView('blk')`
  instance expects. **Render nothing through it yet; the pane still uses its current path.**
  *Check: the instance can be constructed against the pane host without throwing; nothing visibly changes.*
- **1b-ii — THE SWITCH.** The pane renders through its instance, and the `renderOpForm(formHost,
  formBindings(def))` call at `blocksApp.js:612` is DELETED.
  *Check, and it is the user's own: `grep -n "renderOpForm(formHost" blocksApp.js` returns NOTHING.*
  *Plus the real gesture: built-in → INSERT → BLOCKS → the form is there.*
- **1b-iii — SWEEP THE ORPHANS.** Remove imports/helpers that 1b-ii made dead. Nothing else.
  *Check: node tier green, no unused-import left behind.*
- **1c-i — PROVE THE INERT INSERT.** The `_previewing` guard already landed in `wizardManager.insert()`.
  This act only PROVES it: a test that reaches insert() by keyboard AND programmatically while previewing,
  and asserts no op is committed. *Check: that test exists and fails if the guard is removed.*
- **1c-ii — OPEN-AS-MODAL WRITEBACK.** Editing an existing op → writes back IN PLACE; authoring a new
  wizard → inert. Never "add a copy". *Check: insert from the preview modal on a placed op leaves the
  program length UNCHANGED and the op's params updated.*
- **1d — THE FAMILY SAMPLE (read-only).** A probe, a mill op, a lathe op, an ATC op, each via the user's
  gesture. *Check: a per-family table; any that render differently is reported as a wizards-as-data gap
  (3i), not fixed in this act.*

### ② Middle's clearance mode
- **2a — DECLARE.** Add `clearMode`/`hopDist`/`planeZ` to `middleData.js`'s MIDDLE_BINDING_SPECS, following
  `cornerData.js`'s own declaration of the same trio. Nothing else.
  *Check: the three bindings exist; Middle's form shows Clearance + Hop/Plane.*
- **2b — PROVE IT DRIVES THE EMIT.** Un-fixme `clearance-form-921.spec.js`; show the emit CHANGES with the
  mode (the stack builder already reads these — `stacks/middleWizard.js:81-85`).
  *Check: that spec green, and Hop vs Plane produce different G-code.*

### ③ The simulated probe disc
- **3a — WALK NESTED ATOMS.** `readEnabledComps()` (`viz/createPreviewPanel.js:43`) currently loops top
  level only; a twin wraps its atoms in `user_root`. Make it descend. Nothing else.
  *Check: the comp map is non-empty for a twin probe op.*
- **3b — PROVE THE PICTURE.** Un-fixme `editor-sim-disc.spec.js`; the disc lands on the COMPENSATED surface.
  *Check: that spec green + a screenshot. **Emit must stay byte-identical — this is sim-only.***

### 3j. RULING (advisor, user delegated — "ok i trust you", 2026-08-11): the Blocks modal's Insert stays INERT
**First, a correction the user caught:** t1740's WORK-LOG concluded "there is no reachable case where
`openLiveAsModal()` runs against a genuine placed-op identity." **That is FALSE for the insert→Blocks
route** — and it was falsified by that same turn's OWN empty-pane fix, which added the placed-op scan as a
third way the pane finds a wizard. Advisor measured it (t1741): after `openWiz → insertWiz → showApp
('blocks')` the program holds `{opType:'user_corner_data', id:'op1', params:{…}}`, the pane renders 23
fields, and **`#blkOpenModal` is VISIBLE**. So there IS something to write back to. The trace was correct
for the two routes that existed when it was written and was not re-checked against the route just created.

**RULING: Insert is INERT in the Blocks modal for ALL routes** (hand-built · Customize-as-blocks · a
placed op). Reasons:
1. **The button already promises it** — its own title: *"…close it and nothing is saved."* A committing
   Insert would break a promise the UI currently keeps.
2. **STUDIO already edits a placed op IN PLACE** (`wizardManager.insert()`'s `editingOpId` surgical
   writeback — proven, tested). A second door to the same edit is the duplication this whole gameplan
   removes, and two doors drift.
3. **The pane's job is SEEING, not changing.** Values get changed where they were entered.

**Cost, stated honestly:** to tweak a value while looking at an op in Blocks, the user returns to STUDIO.
One extra click; one editing path.
**If that ever chafes, the fix is NOT a commit button on a preview** — the pane's own fields already write
through to the blocks (`onFieldWrite`, t1740). That is the editing mechanism if one is wanted, and it
needs no second modal.

### 3k. USER RULING (2026-08-13) — in the pane: CANCEL reverts, INSERT stays inert
*"cancel can actually cancel"* + *"other is just inert"*. The two controls are NOT symmetric, and the
asymmetry is principled:
- **INSERT — inert (3j, unchanged).** The pane is not building a program, so committing means nothing.
- **CANCEL — a REAL action.** The pane's fields WRITE THROUGH to the blocks (`onFieldWrite`, wired in
  1b-ii), so the user genuinely can change things there — which makes "put back what I typed" meaningful.

**Scope note (advisor asked, user confirmed "other is just inert"): REVERT, not QUIT.** In an
always-present tab there is nothing to close, so "quit" has no meaning here; Cancel restores values.

⚠ **OPEN DESIGN DETAIL, do not guess:** *when* is the snapshot taken that Cancel restores to? On entering
the tab? On each render? On the first edit after a clean state? Whichever is chosen must be stated in the
act, not implied — a revert that silently restores the wrong baseline is worse than no revert.

**SEQUENCING: this comes AFTER the keystroke-loss fix.** Reverting edits is meaningless while typing into
the pane does not land at all (see the 1b-ii red below).

### 3k-CORRECTED (user, 2026-08-13): *"sorry in modal its revert"* — 3k had the surfaces BACKWARDS
| surface | Insert | Cancel |
|---|---|---|
| **PANE** (Wizard View tab) | inert | **inert** |
| **MODAL** (⧉ Open as modal) | inert (3j) | **REVERTS** |

**Why this is the right way round** (3k had it reversed — advisor's error, user corrected):
- The **MODAL is a SESSION** — opened, edited, closed. Cancel = put the values back and close, which is
  the modal's own standing promise (*"close it and nothing is saved"*) actually being kept.
- The **PANE is not a session** — it is always present, never opened, never closed. There is no "before"
  moment to revert to and nothing to close, so a Cancel there would be **a control that does nothing** —
  exactly the pattern this whole gameplan has been deleting.

**So the pane carries NEITHER control as a live action.** The snapshot-timing question raised in 3k
belongs to the MODAL, where it has an obvious answer: the state at open.

### 3l. USER RULING (2026-08-13) — the pane's fields are READ-ONLY for a placed op (option 3)
t1748 found: the pane now renders every built-in correctly, typing keeps focus and lands characters, **but
the writeback never reaches the canvas for a normally-placed op** — `writeAuthoredValue` handles two
AUTHORING shapes (an authored atom tree; Customize's `param_field` blocks) and neither covers a placed
op's `{type:'op', params}`, so it **silently no-ops**. Fields that look editable and change nothing is
the same silent-wrong-thing family this whole gameplan exists to remove — and worse than the empty pane,
because it looks like it worked.

**Three options were put to the user. RULED: option 3 — make the fields visibly read-only.**

**The mechanical reason, not just the ruling:**
- **Option 1 (extend `writeAuthoredValue`)** — rejected. Its two existing shapes are AUTHORING shapes; a
  placed op is a program INSTANCE. Teaching an authoring function about instances gives it a second job
  and leaves its dispatch with no common principle for the next shape.
- **Option 2 (route through `replaceOp`/`openForEdit`)** — the RIGHT way IF editing is ever wanted: it is
  the proven, already-tested "edit a placed op" path STUDIO's insert uses, so one implementation not two.
- **Option 3 — chosen, and not as the timid choice: IT DELETES A FAILURE MODE.** The pane renders FROM the
  canvas; any edit path writes BACK to the canvas, which re-renders the pane. **That loop is the source of
  today's only real bug** (keystrokes eaten), fixed only by carefully distinguishing "the echo of my own
  edit" from "a genuine upstream change" — a distinction that gets HARDER with more writers. Read-only
  makes the pane strictly one-directional: canvas → pane. No echo, no race.
- **Cost is near zero:** the user already has two better places to change values — the wizard in STUDIO,
  and the blocks themselves on the same canvas.

**⚠ VISIBLY read-only.** A field that silently ignores you is the defect being fixed; disabled/greyed with
the reason available is the fix. Do NOT merely drop the listener and leave the fields looking live.
**Scope: a PLACED op only.** The authoring cases (hand-built wizard, Customize) keep their live editing —
that is the pane's other job (3i) and it works today.

---

# 📡 QUEUED — the M350 Modbus register map, from the M3X bridge source (2026-08-13)
Source: `foinnc/M3X-M350-IoT-Bridge` (MIT), `Firmware/01_Web_Touch_Console/main.ino`. **The RELEASES are
irrelevant to us** — V2.0 is WiFi TX power / modem-sleep / AP channel, V1.0 is the web UI; neither release
note mentions the protocol. **The value is in the source**, and it has been there since V1.0.

⚠ **STATUS: EVIDENCE, NOT ATTESTATION.** These are read off another project's working implementation, not
bench-verified against the user's own controller. Anything built on them stays provisional until a real
read succeeds on their machine. Do NOT promote to attested corpus without that.

## The transport
Modbus RTU, **slave id `0x01`**, **115200** on the DB9. Requires M350 firmware **≥ 2025-12-11-00**.
Controller params: **P279 = Slave**, **P267 = 115200**, P296/P297 default.

## READ — function 0x03 (read holding registers)
| register | qty | meaning |
|---|---|---|
| `7080` | 10 | WORK coords X,Y,Z,A,B — 5 × 32-bit floats |
| `7260` | 10 | MACHINE coords X,Y,Z,A,B — 5 × 32-bit floats |
| `10002` | 2 | system state (IDLE / BUSY / RESET) — 32-bit int |
Each axis spans two consecutive registers, reassembled as `((uint32_t)r2 << 16) | r1` then cast to float.
The bridge polls every 100 ms (`readInterval`).

## WRITE — function 0x10 (write multiple registers)
| register | qty | meaning |
|---|---|---|
| `6908` | 2 | KEYPRESS — `keyCode` in the low 16 bits, `actionState` in the high 16 |

**Key codes:** X± `0x015e`/`0x015f` · Y± `0x0160`/`0x0161` · Z± `0x0162`/`0x0163` · A± `0x0164`/`0x0165` ·
B± `0x0109`/`0x0166` · START `0x0148` · PAUSE `0x0149` · RESET `0x0147` · HF/LF `0x0184` ·
F1–F6 `0x0600`–`0x0605`.

## What is genuinely NEW
[[m350-v1-v2-and-modbus-slave]] already recorded that fw ≥2025-12-11 unlocks P279 Slave, and that the M3X
does live DRO + keypresses over the existing cable. **What was missing were the NUMBERS.** This turns
"known possible" into "implementable".

## Queued item A — LIVE DRO IN THE GATEWAY (read-only)
Three register reads gives a live 5-axis DRO plus machine state. **Read-only FIRST, and that is a rule not
a phase** — [[live-cnc-readonly-when-away]]: only read-only ops on a powered controller when the user is
not at the machine. Scope it as: connect, poll `7080`/`7260`/`10002`, show the DRO. Nothing that moves.

## Queued item B — KEYPRESSES (START/PAUSE/RESET/jog) — a SEPARATE, LATER decision
One write to `6908` can start, pause, reset, or jog a real machine. **Do not fold this into item A.** It
needs its own ruling from the user about when Studio may command a powered controller at all, and it is
exactly the class of thing [[live-cnc-readonly-when-away]] exists to gate.

---

# ✅ USER RULING (2026-08-13) — **A**: machine variables roll to all 32 wizards
*"ok its just that we add variable to field"* … *"yes A"*. This UNBLOCKS the roll-out that has been held
since the 4-op pilot shipped in V2026.08.10.4.

**Why A is nearly forced, in the user's own framing:** a field that can hold a VARIABLE cannot be a strict
number box — the browser refuses a `#` at the keyboard before any code sees it. That is browser behaviour,
not a design choice. So the real question was only ever: **for fields where a variable makes no sense, is
the user TOLD or quietly prevented?** A = told. Consistent with every ruling this week (the semicolon
eating a G-code line · the picture disagreeing with the program · the field that silently ignores typing).

**Cost, accepted:** declared fields lose the ▲▼ spinner and native numeric validation. Mobile keeps a
numeric keypad via `inputMode="decimal"` (already in the pilot).

## THE ACT(S) — roll the token declarations to the remaining 28 ops
Mechanism is PROVEN on 4 (corner + 3): `tokenEligible`/`tokenRefusal`/`tokenDeferrable` declared per
binding (`userOps.js`), fail-closed, `tokenRefusal` REQUIRED when ineligible; `wireTokenGuard`
(`ui/formWidgets.js`) reads the declaration; `numberWidget` renders `type=text` only where a policy is
declared. **This is declaration work, not machinery** — do not grow the mechanism.

⚠ **SPLIT IT.** 28 ops is not one act (the sizing rule, t1739). Suggested slices, each with its own gate:
- by FAMILY — probes · mill · lathe · ATC · setup/utility — so a family's refusals can be reviewed together
- each act: declare, then PROVE on that family (a token survives to the emit on an eligible field; an
  ineligible field refuses VISIBLY with its declared text), plus fork-parity byte-identical + node tier.
⚠ **393 params were measured at t1704** — most are ineligible and need a REFUSAL REASON written by someone
who knows why. A generic "not supported here" is the dead-field pattern; the reason should say what the
field is and why a variable cannot drive it.

## ⚠ RECURRING STRUCTURAL PATTERN (2nd occurrence, t1756) — the ALLOW-LIST DROP
Declaring the probe family's token policy broke the formfield-block round-trip: `bindingsToBlocks` /
`bindingsFromStack` carry a HARDCODED list of known binding fields and **silently discard anything not on
it** — so the new `tokenEligible`/`tokenRefusal`/`tokenDeferrable` vanished through the round-trip. Caught
by the worker's own full-suite run, fixed by carrying them through.

**This is the SAME class already fixed once, in a sibling function** (`deriveBindings.js`, t1704). Two
occurrences of one shape: *a function that enumerates the fields it knows and drops the rest, without
saying so.* Every future declaration added to a binding will hit it again, in whichever copy was missed.

**Worth a dedicated act (not yet scoped):** find every place a binding/param object is rebuilt field-by-
field, and make the unknown-field case either CARRY THROUGH or REFUSE LOUDLY — never silently drop.
A grep for the known two is not enough; the point is to find the ones nobody has tripped yet.

---

## ⚠ PERSONAL MACHINE VALUES HARDCODED AS UNIVERSAL DEFAULTS (2026-08-13)
**User:** *"my machine config and layout of my setup is not meant to be hardcoded in the repo."* Correct,
and it is a CORRECTNESS point before it is a privacy one: one machine's numbers baked in as a default are
WRONG for every other owner, silently.

**Found (shipped code, not tests, not comments):**
1. `web/engine/GcodeExecutionEngine.js:1041` — `num(machine.z, -120)`. **A runtime FALLBACK: a machine
   config with no Z travel is silently treated as 120 deep.** Same disease as everything else this week —
   a silent assumption standing in for a missing fact. A user whose machine is not 120 deep gets a
   confidently wrong simulation with nothing saying so.
2. `web/blocks/dataOps/homingData.js:30` — `TEMPLATE_MACHINE = { x: 300, y: 300, z: -120 }`.
*(`web/data/workspaceMachine.js:139-149` mentions -120 only in illustrative doc comments — fine, leave.)*

**THE ACT (queued, not urgent):** a missing axis travel must not silently become a number. Either the
value is DECLARED once as a named, obviously-generic default, or the sim REFUSES/says so rather than
assuming. Prefer refuse-or-say: an invented envelope is exactly what makes a wrong picture look right.
⚠ Check for siblings — grep every `num(machine.<axis>, …)` and any other per-axis fallback; `300` for X/Y
on the same line is the same shape. **This is a sweep, not a single edit.**

**And a standing rule going forward:** the user's own machine config, WCS table, tool table and shop
topology are NOT project facts. They belong in their workspace file / memory, never in shipped defaults.

### …AND THE REASON THAT SHARPENS THE SWEEP (user, 2026-08-13)
*"the idea is that if we did we might get confused and restrict unnecessarily other user."* — this is the
real cost, and it is bigger than a wrong number:

**A personal value hardcoded as a default eventually becomes a RULE.** Once `-120` sits in the engine, the
next person reasoning about Z assumes machines are ~120 deep. A guard gets written against it; a clamp; a
validation that refuses something legitimate because it does not match a shape that was only ever ONE
user's. **And it looks principled from the inside** — nobody can tell the constant was a measurement of
somebody's garage machine rather than a considered default.

```
  a personal VALUE           → one wrong number, findable
  a personal value as a RULE → restrictions nobody knows are personal
                               (a clamp, a warning threshold, a refusal, a test baseline)
```

⚠ **Already happening:** agent test specs boot a DEFAULT machine at Z −120 ([[agent-tests-use-default-
config-not-users]]), so a whole class of verification runs against one envelope as if it were neutral.

**So the sweep is not just "stop hardcoding -120."** It is: **find where a personal number has already
become a CONSTRAINT** — a clamp, a threshold, a validation, a refusal, a test baseline treating one
envelope as normal. Those are the ones that would restrict another user with nobody intending it, and they
will not look like personal data; they will look like engineering.

### ✏️ CORRECTION (user, 2026-08-13): *"the -120 default is a good general starting point"*
The advisor over-flagged. **A DEFAULT is fine; a SILENT FALLBACK is not.** −120 is a reasonable starting
Z for a hobby-class mill, and a sensible starting value beats an empty field.

| | verdict |
|---|---|
| `homingData.js:30` `TEMPLATE_MACHINE = {x:300,y:300,z:-120}` | **KEEP** — a visible starting template the user can see and change |
| `GcodeExecutionEngine.js:1041` `num(machine.z, -120)` | **the actual issue** — fires at emit/sim time for a config that never stated its Z travel; the user never picked −120, they just never said, and the engine decided silently |

**So the act shrinks:** do NOT delete the default. Make the ASSUMPTION VISIBLE — if a config has no Z
travel, the sim should say it is using a fallback rather than presenting an invented envelope as known.
Same rule as everywhere else this week: the value can be a guess, it just cannot be a SILENT guess.

⚠ The [[…constraint-creep…]] point above still stands and is unchanged — the sweep for "where has a
personal number already become a RULE (clamp/threshold/refusal/test baseline)" is still worth doing. A
good default becoming an invisible constraint is exactly the failure mode, and a good default is MORE
likely to spread than a bad one.

---

# 🔬 THE DOORS DIVERGE — the finding under five separate bugs (user, 2026-08-13)
**The user's question, and it is the right one:** *"in a wizard as data world why are these even different"*

In a wizards-as-data world there is ONE def (template + bindings) and every door should reach the SAME
rendered wizard. If Customize renders zero fields for a wizard the bar renders fine, **the doors are not
equivalent** — something on one path does work the other does not, and the def is not the single source it
claims to be.

## THE THREE DOORS, and what each actually does differently
| door | what it does | evidence |
|---|---|---|
| **bar → Insert** (the user's daily path) | `commitActiveOp()` **EXPANDS** into a full `Define Custom Wizard` tree → `deriveLiveWizard` takes the **authoredHere** branch | traced t1762 |
| **Customize as blocks** | `editWizardDef(opType)` → `reconstructUserOpBlock(opType)` → `makeOp(opType, defaultParams(def), forkTpl)` — **REBUILDS from the registry at DEFAULTS**, TYPE-keyed, a FORK by design (`opContextMenu.js:140-143`), and gated to 8 CAM-generator twins | traced t1754, t1739 |
| **`ddcsLoadBlockStack`** (tests) | injects a stack **directly**, no expansion, no rebuild | `wizard-face-1599` uses this for every case |

## WHY THIS IS THE REAL FINDING, not a failing test
**Every pane bug this session was the same wizard behaving differently depending on how you arrived:**
- the EMPTY PANE (t1740) — the scan checked `b.type`/`params.opType`, never the placed op's own `opType`
- the `hasTree` BRANCH (t1748) — 1b-ii switched the flat branch; every built-in takes the other one
- the VISUAL HOST (t1760/62) — built against one route, verified against the other
- the READ-ONLY RULE (t1752/54) — a proxy for "is this a placed op" caught a hand-built stack AND Customize
- `wizard-face-1599:84` — Customize renders 0 fields for at least one twin

**Five bugs, one shape.** Fixing them one at a time is treating symptoms.

## THE ACT (after the surface fix)
**Map what each door does that the others do not, and ask how much of it is NECESSARY.** Deliverable is a
table: per door, the transformation applied to the def before rendering, and whether it is essential
(Customize's fork semantics ARE deliberate — see t1754) or incidental. **Then collapse the incidental
ones**, so the divergences stop being POSSIBLE rather than being fixed one by one.
⚠ Do not "fix" `wizard-face-1599` by making its assertion pass — first establish whether the Customize
route is genuinely broken or the spec is asserting through a door that no longer means what it did.
⚠ Related and probably the same root: the specs guarding the PANE are synthetic (`ddcsLoadBlockStack`)
while 29 specs elsewhere DO drive the real `insertWiz` gesture — the pane's own coverage was the gap, which
is why the user found the empty pane and the tests did not.

### 🎯 THE FINISH LINE for the diverging-doors work (user, 2026-08-13)
*"so im ok with doing programatically but we need to make sure they run the same thing, right?"* — yes, and
this is a better rule than "always drive the real gesture."

**The problem was never that tests are programmatic. It is that the SHORTCUT PRODUCES A DIFFERENT STATE.**
`ddcsLoadBlockStack([op])` injects the op as-is; `bar → Insert` EXPANDS it into a full `Define Custom
Wizard` tree, which renders through a different branch. So today the fast path tests a state no user can
reach.

**THE ACT'S ACCEPTANCE TEST — one spec earns the shortcut for all the others:**
drive the REAL gesture (openWiz → fill → insertWiz), drive the PROGRAMMATIC setup, and **assert the
resulting program + canvas are the SAME** (deep-equal the stack modulo ids). If that holds, the ~95 specs
using `ddcsLoadBlockStack` are testing what the user actually does. If it ever stops holding, THAT test
fails — instead of the divergence hiding until the user photographs it.

**Same move as everything else this week:** do not repeat the check in 95 places — make the EQUIVALENCE
provable in ONE place. It also gives this work a concrete finish line: not "make the doors similar" but
**"this equivalence test passes."**
⚠ If the two genuinely CANNOT be made equivalent (e.g. the expansion is load-bearing for authoring), then
say so and the rule inverts: the pane's own specs must drive the real gesture, and the shortcut is banned
THERE specifically. Either outcome is fine — what is not fine is 95 specs quietly asserting about a state
that does not occur.

## 📌 SMALL — the 3D DRO/legend overlay collides with the toolbar in the narrow pane (2026-08-13)
**User's screenshot (393px, pane, after the surface fix landed and looked right):** the Work/Mach DRO block
(`X 17.500 / Y −39.680 / Z −5.000`) and the path legend print ON TOP of the viz toolbar (`3D`, `1×`, play).
Values are correct and the scene is right — it is a LAYOUT collision, not a wrong reading. But it makes the
readout unusable at phone width, which is exactly where the user reads it.

**Traced:** the overlay is drawn INSIDE the 3D box and assumes the modal's taller canvas; nothing about it
is size-aware. At 393px BOTH rules apply and the second wins:
`@media (max-width:520px) .wiz-viz3d { height: 220px; }` then
`@media (max-width:860px) .wiz-2pane .wiz-visual .wiz-viz3d { flex:1 1 auto; height:auto !important; }`
→ the box becomes whatever flex gives it, while the overlay still expects room.

**Fix direction (not prescribed):** make the overlay yield when the box is short — collapse the legend,
or move the DRO out of the canvas into the panel chrome where it has its own space. **Prefer a rule that
reads the ACTUAL box size over another max-width breakpoint** — two breakpoints already fight here, and a
third is how this got confusing.
⚠ Check the MODAL is unaffected: it has the room today and must keep the current layout.

## 🎨 THE PANE HEADER — minimal, no LIVE badge (user, 2026-08-13)
*"we could still make this part more elegant, while still differentiate it from the actual wizard"* →
*"minimal without the live flag at all."*

**Today** the strip above the surface carries three things badly, on bare black, outside the panel:
a floating `✕`, the two tabs (half-cut by the surface edge below), then a row of
`GENERATOR MODAL` + a `LIVE` badge + `⧉ Open as modal`.

**Wanted:** the wizard's OWN NAME where the internal label is, `Open as modal` reduced to an icon, and the
**LIVE badge REMOVED**. The tab is already called Wizard View and it is always live — a badge announcing
that is the app explaining itself to itself. `GENERATOR MODAL` is internal vocabulary in a title's place.

⚠ **THE CONSTRAINT THAT REMAINS (user, same breath): it must still read as NOT the real wizard.** It is a
live view of something uncommitted, and that distinction is worth seeing. With the badge gone, the signal
has to come from the FRAME — the header bar's own treatment, the seam where it meets the surface, the
tabs reading as tabs — not from a word. **Do not simply extend the panel surface upward until the header
disappears into it**; that erases the very distinction the user asked to keep.
⚠ Also fix the small mess visible in the screenshot: the `✕` floats alone on black, and the tabs are
clipped by the surface edge. Whatever is chosen, those three elements should read as ONE deliberate bar.
**Scope: presentation only.** No behaviour change — Insert/Cancel rulings (3j/3k) untouched.

### …and the header's black is `--screen`, DELIBERATELY (traced t1765) — the identity is what is stale
User: *"make the panel use the theme too."* **It already does — but as the WRONG THING.** Traced:
`#blocks-app .right { background: var(--screen) }` (`styles.css:5378`, and the mobile drawer head at
`:5516` likewise), and **`--screen` is `#000` in EVERY theme ON PURPOSE** — `styles.css:5182`:
*"fixed: the screen is black in every theme"*. It is the READOUT/EDITOR black (code panel, DRO).

**So the column is themed as A SCREEN.** That was correct when it held Projected G-code + a preview. It is
wrong now: the column holds a **WIZARD**, and wizards live on the PANEL surface (`.wiz-box`'s themed
ground, which t1764 just gave the pane). **The chrome kept the old identity after the content changed.**

**The fix is therefore NOT "add theme support"** — it is to re-point the column's chrome at the PANEL
family of tokens rather than `--screen`, so the header and the surface belong to the same object.
⚠ Do NOT redefine `--screen` — it is correct for the editor/DRO and other things read it.
⚠ Check what else uses `#blocks-app .right`'s background before changing it — the 3D tab lives in that
same column, and a 3D viewport arguably DOES want the screen black. If so, the token change belongs on the
header/Wizard-View side only, and say so.
⚠ The 3f/3k distinction still holds: this must not make the pane indistinguishable from the real wizard.

### …and the TABS become a SINGLE TOGGLE (user, 2026-08-13)
*"maybe we also remove the wizard view vs 3d tabs and use a different mechanism to switch"* → **single
toggle.** Folds into the minimal-header act above; do them together.

**Why the tabs existed, and why that reason does not require tabs:** t1734 replaced a four-term predicate
that GUESSED which face to show (patched twice for guessing wrong). Two always-present tabs removed the
guess — but "no guessing" never implied "a tab row"; that was the advisor picking the first shape with no
predicate in it. A single explicit toggle is equally guess-free and costs one row less, which matters most
in the phone drawer where the pane is already short.

**Target:** the header is ONE line — the wizard's own name, a small view toggle, and `Open as modal` as an
icon. No tab row, no `GENERATOR MODAL`, no `LIVE` badge.

⚠ **Decide and STATE these, do not leave them implied:**
- **What the toggle shows** — the CURRENT view or the one you would switch TO. Either is defensible; being
  vague about it is the classic way to make a toggle confusing. Label/tooltip must match the choice.
- **Does the choice PERSIST** across tab switches / sessions? "You rarely switch" implies yes — it should
  stay where the user left it rather than resetting to Wizard View each time.
- ⚠ The honesty rule (8b/8e) still binds: with a wizard absent, the Wizard View side is EMPTY — the toggle
  must not quietly hide that by defaulting to 3D.
**REJECTED, and record it so nobody re-proposes it:** an auto-switch that infers intent (3D while a sim
runs, form otherwise). That is exactly the four-term predicate returning under a friendlier name.

## ✓ CLOSED (t1824) — the reproject-echo race is real in the code, unreachable by any real user gesture
Originally logged here (t1767) as "NARROWED, not CLOSED," with "in the app the same race means an edit can
silently revert" — that sentence was THIS PLAN's OWN INFERENCE from the mechanism, not something anyone
observed happen to a real edit. t1766's own WORK-LOG entry (the source) never claims a user's edit was lost:
the actual observed incident was `wizard-face-1599` HANGING on a custom `.app-dialog` Playwright's
`page.on('dialog')` cannot see, caused by `ddcsGetBlockProgram()` staying stuck non-empty for 5.7 straight
seconds — triggered by the TEST'S OWN scripted `ddcsLoadBlockStack([])` immediately followed by
`ddcsEditWizardDef(t)`, with no yield to the event loop in between.

**t1824 investigated whether a real user gesture can reproduce this, rather than assuming it from the code,
and found it structurally cannot:**
- `gen++` is the first line of `setStack` (`programModel.js:224`) and `stack` is mutated ONLY inside
  `setStack` (grepped) — every program change, INCLUDING a real user's own direct Blockly edit
  (`blocksApp.js:788`, `setStack(workspaceToStack(ws), 'blockly')`, synchronous), bumps `gen`. A queued
  reproject echo checks `getGen() === myGen` before applying, so even in the theoretical case a real edit
  DID land while an echo was pending, the edit's own `setStack` call would already have superseded it.
- Grepped every real production call site of `ddcsLoadBlockStack`/`editWizardDef` (18 sites total): none
  synchronously chains a SECOND `setStack`-touching call within the same handler with no yield. The one
  production "Clear" call site (`editorManager.js:165`) does a single clear. The two production "Customize"
  triggers (`opContextMenu.js`, `wizardManagerPanel.js`) both call `editWizardDef` (`devMode.js:571`), whose
  own internal chain has REAL `await` points (`confirmDestructiveLoad`, `blocksAppReady`) before it ever
  touches the model — unlike the test, which called the raw functions directly with no such gate.
- The decisive reason, not just an absence of a found path: JS's own event loop drains ALL pending
  microtasks before dispatching the NEXT macrotask, including the next real DOM input event — a
  specification-level guarantee, not an implementation detail. Two SEPARATE real user actions (two clicks,
  two keypresses, an "undo storm") can never interleave with a microtask queued during an EARLIER action's
  handler; the queued reproject echo always resolves first, no matter how fast the user acts. The race is
  reachable only by a single synchronous script issuing two `setStack` calls with no event-loop yield
  in between — which is what the test itself did, not something any UI gesture can produce.
- Tried to construct a real two-click reproduction anyway (Clear + an immediate Customize click) rather than
  rest on the argument alone: the UI's own structure doesn't offer a tight adjacent pairing for this — Clear
  removes the very op a context-menu Customize would target, and the Settings-panel Edit route needs its own
  navigation first, adding real event-loop gaps that only reinforce the conclusion.

**The second, deeper "Blockly-internals" race t1766 flagged (a queued echo reading a workspace whose own
clear/rebuild hasn't finished)** inherits the same conclusion: it only matters within the identical
scripted-double-call shape, which no real gesture reaches either.

**Did not widen the gen-guard speculatively** — nothing here needs a bigger fix; the guard already correctly
protects every path a real user can reach. See WORK-LOG t1824 for the full trace.

---

## 🐛 USER-REPORTED (2026-08-13) — the SIM PATH is offset in corner
*"there's an offset in positions"* … *"the path is offset, the path in the sim."* **The PATH, not the
markers** — the traced toolpath is displaced from where the geometry says it should be.

**Evidence (screenshot, Corner (data), the real modal, desktop):** Front-Left · Y-then-X · Dogleg · WCS
Active. The 3D DRO reads `X −2.813 · Y 40.000 · Z −5.000` (Work AND Mach identical). The 2D shows the
stock rectangle with probe points at its corners, the Start marker BELOW-RIGHT of the stock's bottom-left,
and the reposition square OUTSIDE the stock to its left.

⚠ **THIS IS THE MONDAY FAMILY, possibly recurring:** the user reported on 2026-08-10 *"i see the problem
it drawn outside of the stock"* / *"by exactly the WCS"* — closed then. If it is back, or never fully
went, that matters more than the individual symptom.

**THE DISCRIMINATING TEST — do this FIRST, do not chase from the picture:**
**does the EMITTED G-CODE put the probe where the PICTURE puts it?** The program is the truth, the picture
is the claim ([[ddcs-ground-truth-reference]]).
- **They AGREE** → the path is correct and the drawing merely reads oddly (a corner probe legitimately
  approaches from outside the stock). Then the question is presentation, not correctness.
- **They DISAGREE** → the sim is rendering in a different frame from the one the program runs in. Then
  find WHICH transform is applied twice or not at all — and note `[[probes-never-read-wcs]]`: a probe's WCS
  is its OUTPUT, so the sim must never map a probe op THROUGH the WCS table.

⚠ **SEQUENCING (user's own call, and it is right): the TESTS come first.** Every corner symptom this week
was invisible to a green suite because the specs reach the pane through doors the user does not use. Fix a
corner bug now and it would pass its test while possibly still being broken for them. **Do the doors work
first, then this.** Do not drop it — a symptom the user can see is worth more than any reasoning.

---

# 🧪 THE TESTS THAT CHECK THE APP — the audit the user keeps asking for (2026-08-13)
*"we need to fix the tests that check the app."* Not the one new check — the BODY of specs that assert
about the app's behaviour while never driving it.

**What exists after today:** `picture-parity-1772.spec.js` (declared markers vs traced path, red on corner)
and `pane-visual-host-programmatic-1762.spec.js` (drives the real bar→Insert→Blocks chain). **Two specs.**

**What does not:** ~95 specs build state with `ddcsLoadBlockStack` and assert against it. That is where
every green-but-broken result this week came from — the empty pane, the wrong branch, the missing visual
host, the unstyled surface. All green. All broken for the user.

**The map (t1770) gives the fix, and it is NOT "rewrite 95 specs":**
> the three doors converge on the SAME form-structure rendering (hasTree/userRoot resolves from the
> registry template, never from the stack's own children). They differ ONLY in which VALUES populate
> fields, and in editable-vs-read-only — both gated by one clean fact (`authoringWizardType()`).

**So split them by what they ASSERT:**
| the spec asserts | verdict |
|---|---|
| STRUCTURE (fields exist, rows render, a form is produced) | **fine as-is** — the doors converge here; the fast path is legitimate |
| LIVE VALUES against a synthetic `params:{}` fixture | **proves nothing** — asserts about a state no gesture produces. Repoint these. |
| what the user SEES (the picture, the surface, placement) | **needs the real gesture** — this is the class that was invisible all week |

## THE ACT
1. **AUDIT** — classify the ~95 by the table above. Report counts + the list needing work. Do not fix yet.
2. **PROMOTE the sanctioned shortcut** — t1770 recommends `wizard-face-1599`'s own placed-twin test
   (`:161-194`) as the pattern: `makeOp` + `instantiate`, the SAME primitives `commitActiveOp` uses. If a
   spec needs a placed op, it should build one THAT way rather than inventing a fixture.
3. **REPOINT** the value-asserting ones onto it, in slices small enough to review — not one act.
⚠ The point is not more tests. It is that a GREEN result should mean the app works **for the routes the
user actually takes**. Today it does not, and the user has had to be the integration test all week.

---

# 🧪 SUITE AUDIT RESULT (parallel read-only agent, 2026-08-13) — the numbers
775 spec files · 2312 tests. **The user's primary route has NO end-to-end spec at any point in its chain.**

| exact grep | count |
|---|---|
| specs that Playwright-click a wizard-bar entry | **0** |
| specs that click the INSERT button (`index.html:1156`) | **1** |
| specs that click the BLOCKS tab (`index.html:136`) | **0** |
| files with NO input of any kind (pure `page.evaluate`) | **416 of 775** |
| `toHaveScreenshot`/`toMatchSnapshot` baselines | **0** |
| specs reading canvas PIXELS (`getImageData`) | 10 (of 83 referencing a canvas) |

⚠ **The file named `pane-visual-host-programmatic-1762.spec.js` drives no real gesture** — `window.openWiz`
`:18`, `window.insertWiz` `:20`, `window.showApp` `:21`. The advisor cited it to the user as covering their
route. It does not.
⚠ **The `*-in-place.spec.js` family (16 files) asserts `canvas ? 1 : 0`** — e.g. `pocket-in-place.spec.js:44,55`
proves a `<canvas>` ELEMENT EXISTS while its name claims "the sim renders the toolpath".

## THE FIVE ADDITIONS (audit's own ranking — cheapest first, highest value first)
1. **The primary route, once, end to end.** Click `button[data-optype]` → `.fill()` a distinctive value →
   click INSERT → click `[data-app="blocks"]` → assert the Wizard View shows THAT value.
   **One spec closes bugs 1, 2 and all three zero-coverage gestures.** It is the only test that would have
   caught the `b.opType` scan bug.
2. **Both renderer branches from the same gesture** — one `hasTree` twin, one flat-bindings twin, same
   visible outcome asserted. Bug 2 shipped because `blocksApp.js:667` and `:731` have no test that tells
   them apart.
3. **A visual host must contain a DRAWING, not a canvas** — `getImageData` on the 3D + 2D containers,
   assert non-uniform pixels. Kills bug 3 and the whole `vizEls > 0` family.
4. **Painted surface via the real chain** — `pane-surface-1764/1766` already assert the right thing from
   the wrong setup. A repoint, not new work.
5. **Drawn position vs numeric readout, absolute branch** — model on `corner-marker-parity.spec.js:45`,
   the suite's ONE exemplar using a real `page.mouse` drag and asserting drawn positions. That is the live
   start-clamp bug, and it is the branch `toolpath2d-anchor.spec.js:55` leaves open.

**Cross-cutting cheap win:** zero screenshot baselines exist. Baselines for the wizard modal and the
Wizard View pane would have caught bugs 3 and 4 with no assertion logic at all.

**Repointing pool:** 200 files / 564 tests classed as user-visible or live-value with no Playwright
gesture. Top 25 listed in the audit; 175 more exist. **Slice into reviewable acts — never one pass.**

## 🛑 STANDING COMMITMENT (user, 2026-08-13): the five additions GET DONE
*"sure, but lets make it a point to actually do it."* They have been queued twice today and slipped twice —
once behind the header work, once behind the clamp fix. **Queuing is not doing.**

**THE RULE, binding on the advisor:** after the start-clamp fix passes back, **the next FIVE acts are
additions 1–5, in order, one per act.** No feature work, no presentation work, no defect from the queue
jumps ahead of them. A new user-reported bug may interrupt — nothing else may.

**Track it here, and update this line every time one lands:**
```
  1  primary route, 4 real clicks        [x]  t1776 -- primary-route-real-gesture-1776.spec.js
                                             clicks the Probe menu, the corner entry, fills dist=777,
                                             clicks INSERT, clicks the Blocks tab; asserts #1=777.
                                             ZERO function shortcuts (advisor-verified by grep).
  2  GESTURE==PROGRAMMATIC equivalence   [x]  t1778 -- gesture-programmatic-equivalence-1778.spec.js
                                             POSITIVE RESULT: the shortcut IS equivalent. Deep-equal on
                                             ddcsGetBlockProgram() with ONE exception (block id), matched
                                             first attempt -- no 2nd/3rd normalisation needed. Canvas
                                             checked narrowly (same types/count + planted value visible)
                                             rather than deep-equalling position, deliberately avoiding a
                                             second exception. => the ~95 shortcut specs are LICENSED.
  3  both renderer branches              [x]  t1780 -- renderer-branch-parity-1780.spec.js
                                             FLAT twins found by reading checkLayoutNodes' own predicate:
                                             user_pause_confirm + user_io_step (param_group only). Drives
                                             corner (hasTree) AND pause_confirm (flat) through the real
                                             chain. HONEST CEILING, in its docblock: no branch-naming
                                             surface exists, so it proves both branches are reachable and
                                             correct -- NOT that a branch swap would be caught by content
                                             alone. Worker did NOT add app instrumentation to make its own
                                             test easier (right call). FLAGGED: the branches are now
                                             byte-identical except a live-canvas-template override that
                                             only matters MID-AUTHORING -- a fresh insert cannot
                                             distinguish it, so that case stays uncovered.
  4  pixels not element-exists           [x]  t1782 -- folded into primary-route-real-gesture-1776
                                             samples #blk_userViz3dContainer + #blk_userVizContainer via
                                             drawImage+getImageData, asserts NON-UNIFORM pixels. WebGL
                                             readback WORKS with no preserveDrawingBuffer -- the advisor's
                                             scene-graph fallback caveat was unnecessary. FOUND A REAL
                                             RACE: the 3D renders EVENT-DRIVEN, not in a loop, so a
                                             single-shot sample can catch it mid-blank -> bounded 5s poll.
                                             Docblock records that the poll SELF-HEALS on a blanked canvas
                                             (the app truly redraws), so the non-vacuity proof needed the
                                             single-shot form. 16 *-in-place files named, NOT touched.
  5  surface via the real chain          [x]  t1784 -- pane-surface-1764 + pane-surface-scroll-1766
                                             repointed onto the real chain, assertions UNCHANGED.
                                             FINDING: NO styling divergence -- 10 tests (5 themes x 2
                                             files) pass identically on both routes. Not a bug found; a
                                             confirmation, now guarded by the route that would notice a
                                             change. Checked for false-passing: none possible (both read
                                             DOM/CSS facts independent of the open route). Both docblocks
                                             record WHY they stay on the long route despite addition 2
                                             (program-state equivalence != rendering/styling equivalence)
                                             so nobody folds them back citing #2.
  6  drawn position vs readout           [x]  t1786 -- anchor-contamination-1786.spec.js
                                             PERMANENT GUARD on the t1774 fix. Real bar-built 2-op program
                                             (shipped Raw-G-code absolute prefix + corner via the full real
                                             chain); asserts getAnchor() and an independent re-trace's
                                             stats.absolute agree. REVERT-PROOF PROVEN: reverting t1774
                                             fails 3/3 reproducing the user's own symptom; restore
                                             confirmed byte-identical.
  7  guard the MODAL                    [x]  t1790 -- modal-real-gesture-1790.spec.js
                                             corner (form3d+2d): form value + BOTH visual containers sized
                                             AND drawn + .wiz-box painted. Pause/Confirm (flat): form value
                                             + painted + EXPLICITLY asserts NO 3D box (asserted, not
                                             skipped -- an omission and an assertion look identical in a
                                             green run). Extracted tests/support/barGesture.js +
                                             drawingCheck.js, refactored addition 1 onto them and
                                             re-verified green BEFORE building on top. No duplicated
                                             technique.
  ==> ALL SEVEN ADDITIONS DONE (t1776-t1790).

  ⚠ THREE NEW BUGS found while building #6, named + NOT fixed, suspected shared root:
     (a) M5 halts the static trace before a later op's section ever runs
     (b) Homing poisons forceMachine for the WHOLE panel, with zero call sites in
         blocksApp.js explaining why
     (c) even neutralised, the 3D marker array never rebuilds for corner (stays at
         Homing's own single marker)
  ⚠ GAP THE ADVISOR CREATED: all six additions guard THE PANE. Nothing guards THE MODAL --
     and the modal is where the user's 2D-preview regression just appeared. A seventh
     addition should point the same real-gesture assertions at the modal.

  #2 is the user's own: "if it call programatically it needs to be the same path
  as the ui, is that verifiable" -- YES. Drive BOTH once, deep-equal the resulting
  program+canvas with ids stripped. ONE cheap spec LICENSES the ~95 that use the
  shortcut, and fails loudly the moment someone changes one path and not the other.
  Limit, stated: it proves the ENTRY paths converge, not that rendering is right --
  that is #4 and #6. If they genuinely CANNOT be made equal, that is a fine answer
  too: the shortcut is then banned on that surface and those specs drive the UI.
```
**If the advisor dispatches anything else while a box is unticked, that is the failure this note exists to
prevent.** The reason is not tidiness: until #1 exists, a green suite says nothing about the route the user
takes every day, and they have personally been the integration test for five bugs this week.

## WIZARD VIEW — an EXPLORATORY (scratch) form state  [USER REQUEST 2026-08-14, not yet ruled]

**Their words:** *"i dont need them to edit the actual stack, but id want to be able to interact with it to
simulate behavior, it doesnt need to save to the staxk"* — and *"i might change my mind"*, so this is a
direction, NOT a settled decision.

```
  READ-ONLY     today - inert, nothing touchable
  WRITE-BACK    edits the real op          <- deliberately NOT this
  EXPLORATORY   edits drive the PREVIEW live, discarded, never reach the stack   <- the ask
```

**Why it is wanted:** answer "what would this look like at 8mm?" without committing an edit to the program.

⚠ **THE TENSION, which is the whole design problem:** the pane MIRRORS the op today. The instant a scratch
edit lands, it shows numbers that are NOT in the program — a picture asserting something untrue, which is the
exact silent-divergence family t1804/t1816/t1828/t1842/t1850 all belonged to. So the exploratory state must
ANNOUNCE ITSELF the moment a field is touched (and offer a way back to the real values). A scratch mode that
looks identical to the mirror is worse than no scratch mode.

⚠ Related and already queued: *Cancel reverts in the modal* — same underlying question (what does "discard"
mean, and how does the user know which state they are in). Worth designing together rather than twice.

⚠ NOT STARTED. Bugs first: the 36mm marker gap, then B slices 2-3.

## CUSTOM WIZARDS — MAKE VARIABLE USE LEGAL  [USER RULING 2026-08-14]

**The ask:** *"can we just make variable use legal then for cuatom wiz"*.
**The scoping principle, their words:** *"most people use it for themself if they want to share it its other
user responsability to verify"* — so DO NOT build elaborate validation for the sharing case. Consistent with
their standing position that a restriction written for one person's certainty becomes everyone else's ceiling
(see the machine-config-not-hardcoded ruling).

**Today:** built-in twins declare `tokenEligible: true` PER BINDING (e.g. `alignmentData.js:38`), and
`tokenGuard.js` is **fail-closed** — no declaration means refuse. Authored wizards DERIVE their bindings and
those derived bindings never carry the flag, so every authored knob refuses a `#`. Nobody decided that; the
declaration was simply never extended to the second population. Save-as-custom then rejects outright:
*"a knob must be a plain number"* (`devMode.js:752`).

```
  knob -> EMIT only          #805 is fine, Studio never needs the number
  knob -> PREVIEW GEOMETRY   Studio must DRAW with it; it cannot compute a shape from a reference
```

**RULED: allow it. And the preview SIMULATES the variable rather than giving up on it** — user's own
correction: *"live variables are the same as simulated start position though we can simulate it"*. A
variable's value is unknown at design time exactly like a probe's start position, and the sim already assumes
one of those.

⚠ **THE MECHANISM ALREADY EXISTS AND IS ALREADY DECLARED** — `previewVarSeed`, used today by Surfacing Skim
for `#790-792` (`userOps.js:982`, `surfacingData.js:256`). Its contract is already the right one:
*"PREVIEW TRACE only — never emitted, never pushed to the controller"* (`userOps.js:45`), so a simulated
value cannot leak to the machine. This is an EXTENSION of a declared hook to authored ops, not a new feature.
My earlier framing here ("say what it cannot draw") was the weaker answer and is superseded.

**WHO SUPPLIES THE SEED for an authored wizard: the AUTHOR.** They know roughly what `#805` is on their own
machine — and that follows directly from the scoping principle above. A variable for the EMIT, a plain number
for the PICTURE, both declared by the person who knows. ⚠ The picture must still read as SIMULATED, not
measured — it may be a guess, it may not be a SILENT guess.

**PROPOSED SHAPE, not yet ruled:** declare token-eligibility on the ATOM, not on each binding. An atom already
knows whether a param is geometry or a pass-through value; declaring it once there lets BOTH the built-in
bindings and the authored derivation inherit it, and eventually lets the built-in tables stop repeating it by
hand. Follows the user's own declare-don't-derive ruling (t1836).

⚠ Makes moot the possibly-dead `varErr` guard — `devMode.js:112`'s `EXPOSE_` checkbox no longer exists
(t1610), so line 113 may be unreachable and `varErr` permanently null. UNVERIFIED; settle it by plugging a
`#var` into a numeric field and pressing Save.

⚠ NOT STARTED. Bugs first: the 36mm marker gap, then B slices 2-3.

## PREVIEW CAMERA FIT — RULED: LEAVE IT [USER RULING 2026-08-14]

**Ruled: fit everything (today's behaviour). No change.** Options offered were: cap a single op's
contribution (the worker's lean, precedent = `fitAll()`'s existing Z-cap for a tall retract) · fit the
toolpath only · leave it · add a control. **User chose LEAVE IT.**

**What this closes:** the user's ORIGINAL report — *"the start is clamped to the 000 of the stock"* and
*"markers and path aren't aligned"* — is **NOT a coordinate defect**. Measured (t1860): at a 3000mm envelope,
Homing+Corner gives dataBounds {maxX:1500, maxY:1050}; the SAME scene with Homing removed collapses to
corner's own {maxX:7, maxY:43} and reads perfectly. Homing's real motion (its switches genuinely ARE far away
on a big machine) enters the same UNWEIGHTED union `fitAll()` fits to, with no per-op prioritisation. Correct
geometry, compressed to a few pixels, reads as bunched-and-offset.

⚠ `fitAll()`'s own `_fitWide` envelope-exclusion (t780) was CLEARED — it stayed false across all 5 runs. The
camera does NOT default to the envelope box. The advisor's hypothesis named the wrong code; the effect was
real, the cause was a different op's real motion.

⚠ Reproduces under BOTH Expert and V4.1 — NOT profile-specific. Affects every large-machine user who homes
before a small op. Left as-is BY DECISION, not by oversight. Revisit if the user changes their mind; the
manual camera re-fit is the existing escape.

⚠ The user's picture was verified against their real (V4.1) settings, but their exact session is
unrecoverable — the backup's projects store is genuinely empty. Their file is personal: reproduction only,
never a source of values.

## THE FROZEN TEMPLATE CANNOT EXPRESS A DIALECT-STRUCTURAL BRANCH  [FOUND t1894, census NOT run]

**OBSERVED, live** (not a code read): a data-op twin whose stack builder branches STRUCTURALLY on the active
dialect can never reach the live twin form through a value-only `postInstantiate` patch — `def.template`
freezes ONE branch's lines forever, at registration time.

**Why it stayed invisible:** the old `#1300` fallback happened to produce the SAME STRING on every dialect, so
a frozen Expert branch and a correct V4.1 branch were byte-identical. t1894's refusal emits genuinely
different lines, and that is what exposed it.

**Fixed for two ops only** — `atcLengthData.js` / `atcCheckData.js` switched to a full `postInstantiate`
recompose, mirroring `atcTableData.js`'s own `applyAtcTableRecompose`.

⚠ **NOT AUDITED — this is a CLASS.** Any other data-op twin whose builder branches on the active dialect while
carrying only a value-patch `postInstantiate` has the same defect, and would emit the REGISTRATION-TIME
dialect's structure to every other dialect. Given that every spec runs Expert
([[v41-and-v3-outnumber-expert]]), such a twin would be green in the suite and wrong on the two most common
controllers. **Census it the way t1810 and t1884 were censused: classify every data-op twin, include the SAFE
ones with their reason.**

⚠ Refines, does not contradict, [[dataop-live-values-postinstantiate-not-emit]]: emit IS a frozen template,
and that memory is about VALUES. The new fact is that STRUCTURE cannot be patched by a value-only hook at all.

## PROPOSAL — let the USER supply their controller's tool-table register  [worker's, t1894; not a plan]

t1894 ships a refusal: on V4.1/DM500, `atc_length`/`atc_check` say Studio does not have the tool-table
register map rather than guessing Expert's `#1300`. Honest, but the capability stays unavailable.

**The real answer turns an unknown into a DECLARED fact:** let the user enter their own controller's
tool-table base. They know their machine; we do not. Follows the user's own scoping principle — *"most people
use it for themself; if they want to share it, it's the other user's responsibility to verify"* — and the
same direction as variables-in-custom-wizards + `previewVarSeed`.

⚠ NOT RULED. Needs a decision on where that value lives (the workspace's machine block, presumably, since one
`.ddcs` is one machine) and whether a wrong entry is recoverable.

## MULTI-OP CONTINUOUS PLAYBACK — RULED: NOT WANTED  [USER RULING 2026-08-15]

**Their words:** *"so multi op, i dont think i want it, we can let users deal with that themselves."*

**THE REASON, and it is what closes the question rather than merely answering it** — their follow-up:
*"they can program the multiop within one op."* A user who wants several operations to run continuously
authors them as ONE op carrying multiple steps. Same direction as their earlier *"we can simply add steps."*
So this is not a capability we are declining — **the capability already exists one level down**, and `M30`
correctly marks the end of A PROGRAM, which is one op. Nothing is missing.

**So the engine halting unconditionally on `M30`/`M02`/`M99` is CORRECT BEHAVIOUR, not a limitation.**
t1874 found that a multi-op Blocks program cannot PLAY past the first op's own `M30` and flagged it as a
product question. Answered: playback stops at a program terminator, by design. **Closed, not deferred.**

⚠ Do NOT "fix" this later as though it were a bug. A future reader finding the halt will be tempted to make
playback continue; this entry is why they should not.

**ONE SEPARATE, SMALLER QUESTION — NOT the feature, and NOT ruled:** the halt is currently **SILENT**. A person
with a two-op program sees playback stop after op 1 with no explanation and reasonably concludes it broke.
Saying *"stopped — program end (M30)"* is honesty about behaviour the user has now ratified, the same shape as
t1834's frame note and t1894's ATC refusal. Cheap, and it does not reopen multi-op playback.

## ONE OP PER PROGRAM — the shape, ruled  [USER RULINGS 2026-08-15, t1914 analysis]

**Three rulings that lock together:**
1. **Multi-op continuous playback: NOT WANTED.** *"they can program the multiop within one op."*
2. **Wizard insert REPLACES the canvas ops**, with a notice first (*"obvi there should be a notice about the
   ops gonna be cleared"*). Today `opSession.js:5` does the opposite — inserts ACCUMULATE.
3. **Re-importing a multi-op `.nc` → ONE op carrying N steps.** Nothing lost, the invariant holds, the file
   round-trips. Ruled over refuse-and-explain and keep-first-drop-rest.

**⚠ DO NOT COLLAPSE THE FRAME TYPES.** The advisor's first instinct (progstart/progend and user_root describe
one boundary) was WRONG — t1914 found **four** distinct responsibilities, not two: `progstart/progend` (the
machine bracket, real G-code) · `user_root` (wizard-authoring / form identity, transparent) · `op`/makeOp
(program-composition identity, transparent) · `endprogram` (decode-only degenerate leaf), plus
`xform`/`entry`/`flip` as program-level siblings. Merging them folds four jobs onto one block.

**✅ THE RIGHT MOVE INSTEAD: delete the ACCUMULATION machinery.** Under one-op-per-program these go dead —
`appendIntoProgram`'s `cur.length` branch, `normalizeEnds`, and `_framed`'s `user_root`-unwrap complexity
(which took THREE attempts across t1828/t1830). **That kills the whole bug class without conflating anything.**

**The bug class is real and has already bitten TWICE, independently:** t1828's premature `M30` (shipped, fixed
today) and a confirmed sibling in CAM slot composition — `slotPack.js:92-99` names it in its own comment as
*"the shipped multi-op + sub-stack bug"*, with parallel `composeParts`/`offsetBodyLabels`/`stripTerminalEnd`
machinery mirroring `opSession`'s `normalizeEnds`/`offsetLabels`. Same disease, two organs, found by two people
who never connected them.

⚠ **CAM slots sit on the identical problem one level down** and are NOT fixed by this — named in their own
source, still open.

⚠ **Sequence matters:** the import answer and the accumulation deletion shape replace-on-insert, so they come
first. And the notice must be REFUSABLE and land BEFORE the destruction — losing an authored op to a silent
wipe is unrecoverable, unlike a wrong picture.

## LATHE ICONS — TOO FINE, COARSEN THEM  [USER 2026-08-15, next act]

**Their words:** *"the lathe icons are too small, make them abit more coarse."*

The family (t1911, shipped V2026.08.15.9) is right in CONCEPT — shared bar + centreline, differentiated by
what the cut does — but too delicate at the size it actually renders. Concretely, in a 24-unit viewBox drawn
at 14px:

```
  bar          4 units tall  -> ~2.3px on screen
  centreline   1.1 stroke, 2/1.6 dash -> nearly invisible
  probe ball   r=1.8 -> ~1px
  polygon/hex  1.6 stroke -> the facets vanish
```

**Coarsen: thicker strokes, taller bar, fewer + longer dashes, bigger probe ball, and drop any detail that
cannot survive 14px.** Fewer marks, each one heavier.

⚠ **CHECK AGAINST THE MILL SET AT THE SAME SIZE.** If the lathe icons read LIGHTER than their neighbours, the
defect is family inconsistency, not absolute weight — and matching the mill set's visual weight is the target,
not simply "bolder".

⚠ Re-verify at TRUE render size with the 4x DPI capture t1911 already used, and re-check the group icon
against Mill + Custom. Show the picture, do not describe it.

# ═══ ADVISOR HANDOVER — live state as of turn 1927 (2026-08-15) ═══

Written so a FRESH ADVISOR can take the seat without re-deriving anything. Everything below is either
IN FLIGHT or DECIDED-BUT-UNBUILT. Completed work is in the release commits and WORK-LOG.

## ⚠ IN FLIGHT RIGHT NOW — turn 1928, worker holds the ball
**Fixing the advisor's OWN regression from t1920.** Step 2 deleted the accumulation machinery and broke four
features that legitimately need to ADDRESS several operations individually:
`flow-labels-unique-1408` (a regression guard on a REAL shipped bug — drill+surfacing colliding flow labels,
silently skipping the 2nd operation — treat as the most important) · `setup-sheet-850` (the printable job
sheet: 3 operations, 3 DIFFERENT tools) · `time-estimate-844` (per-operation time split) ·
`editor-sim-real-insert` (per-instance sim hints).

**The fix is small and already diagnosed (t1922, proven live):** `ddcsLinesForOp` ALREADY resolves correctly
for an operation nested in a `multi_step` (74+25=99, exact split — it checks ancestry MEMBERSHIP at any
depth). `secondsForLines` is hierarchy-agnostic. **Only the SHALLOW ENUMERATION those four share is broken** —
it does not flatten a `multi_step` wrapper's children. One enumeration, not four patches.

## ⚠ STEP 2 IS COMMITTED BUT NOT RELEASED — do not release until the above is green.

## THE ONE-OP SEQUENCE — user-ruled, 2 of 3 done
1. ✅ **Import** — a multi-op `.nc` imports as ONE operation carrying N steps (shipped V2026.08.15.10).
2. ✅ **Delete accumulation** — committed (30a95c2b), NOT released, regression above outstanding.
3. ○ **Replace-on-insert** — insert REPLACES the canvas, with a **REFUSABLE notice BEFORE** the destruction.
   NOT STARTED. `multi_step` is now judged **retirable** (t1926) if `operation` is the one word at every
   depth — that decision belongs to step 3's authoring UI.

## THE VOCABULARY RENAME — user-ruled, 1 of 4 slices done
**Industry words win:** PROGRAM = the file you run, one per canvas. OPERATION = face/drill/bore, several per
program, each with its own tool. The code's `step` IS the industry's `operation`; the code's op-container IS
the `program`.
- ✅ **Slice 1 — strings** (f9900ab2): 28 files, every user-facing + internal string literal.
- ○ **Slice 2 — internal identifiers**
- ○ **Slice 3 — `.opType`** (203 occurrences / 32 files — largest)
- ○ **Slice 4 — `type:'op'`** (58 occurrences — RISKIEST: shares blockEmitter's dispatch branch, **must land
  in the same commit as its own check**)

**RULED (advisor, t1926):** the `@DDCS` marker JSON key **DOES change** — a marker lives inside a `( … )`
comment, so the machine never reads it; it is Studio talking to itself. **Not yet acted on — its own slice.**
⚠ **The proof obligation for every slice: MACHINE-RELEVANT LINES BYTE-IDENTICAL; the marker comment is the
one expected diff and must be called out, never absorbed silently into a fixture.** If a slice changes a line
the controller would execute, it is not a rename and it stops.
⚠ No shim, no migration, no dual reading — no install base (user ruling: *"i can do new ones, there is no
production yet"*).

## KNOWN-CHRONIC GATE FLAKES — do NOT chase these as regressions
They fail under full-suite load and pass in isolation, every time. Four were root-caused and fixed this
session (four DIFFERENT causes; no fix transferred). Remaining recurring names: `open-as-modal-1625`,
`middle-superset`, `probe-input-select-revival-1888`, `pane-visual-host-programmatic-1762`,
`cam-slot-edit-s3`, `formfield-*`, `group-auto`, `group-gesture`. **Always isolate before believing a red.**

## OPEN, NAMED, NOT STARTED
- **CAM slot composition has the SAME multi-op bug class one level down** — `slotPack.js:92-99` names it in
  its own comment as *"the shipped multi-op + sub-stack bug"*, already patched independently. Still open.
- `segment-frame-derivation`'s `opAtLine` multi-op logic has no live-gesture path and does not work on
  `multi_step`'s nested children (flagged t1920).
- 5 frozen-template rows are safe **by absence of a dialect branch today**, not future-proof · 2 latent
  value-freeze risks.
- `homingWizard`'s blanket V4.1 refusal is an over-broad proxy — needs real hardware to settle.
- The `M30` playback halt is CORRECT (user-ruled) but **SILENT** — saying *"stopped — program end"* is honest
  and does not reopen multi-op playback.
- Captured feature rulings, not started: **Wizard View form goes LIVE** · **custom wizards accept `#`
  variables** (preview SIMULATES them via the existing `previewVarSeed` hook) · **token-eligibility declared
  on the ATOM** · **let the user supply their own tool-table register**.

## ⚠ PROCESS FACTS A FRESH SEAT WOULD OTHERWISE RE-LEARN THE HARD WAY
- **The worker's waiter was not auto-waking** — the human prodded it by hand for several turns. Amended
  (t1920) to arm as ONE self-looping command with no shell background marker. **Verify it wakes on its own.**
- **Both roles were running skill copies loaded at session start**, missing rules added mid-session. **Reload
  the skill before trusting it.** Four rules were added to the advisor skill today, including the one naming
  the stall trigger.
- **The user views the app in VS Code LIVE PREVIEW**, which serves stale modules and does not respond to a
  hard refresh. Live Server (:5500) is correct. Ask *"does it look right in a real browser?"* before
  dispatching any unreproducible visual symptom.
- **The user's machine is V4.1** (their workspace confirms it), and **V4.1 + V3/DM500 are arguably MORE common
  than Expert** — while every spec runs Expert. A V4.1/V3-only defect is an ESCALATION, not an edge case.

# ═══ t1930 — STEP 3 (replace-on-insert): SURFACE THE PLAN, BUILD NOTHING ═══

t1928 verified by the advisor: 19/19 on the four named specs, independently re-run. `flattenOps` is the one
declared enumeration, returns LEAVES (a `multi_step` wrapper is replaced by its children, never counted
alongside them), wired at 5 production sites. Fixture rebuilds accepted — the ASSERTIONS are unchanged; only
the construction moved off a path that no longer exists.

## THE TASK — a written plan, NO product code, NO new specs, NO suite run.
The advisor's release gate (full suite) is running on `535fb4b6` **for the duration of this turn**. A second
Playwright run manufactures mass timeout reds (both suites lose). **Read-only greps and a doc commit only.**

Step 3 is user-ruled: *insert REPLACES the canvas, with a REFUSABLE notice BEFORE the destruction.* It is the
first act in this arc that DESTROYS the user's work, so the plan gets gated before a line is written.

1. **ENUMERATE EVERY ENTRY POINT that can replace the canvas** — the wizard bar gesture, the Blocks tab, CAM,
   an import, anything else. `file:line` each. This is the same shape t1928 just fixed: if the notice ends up
   hand-rolled at each door, it is the four-patches bug again. **Name the ONE declared seam they all route
   through** (or say plainly that no such seam exists yet and where it would go).
2. **THE NOTICE'S OWN WORDING**, in a machinist's words, not the codebase's. It must say what is lost.
3. **WHEN IT MUST NOT FIRE** — an empty canvas has nothing to destroy; a notice there is a nag that trains the
   user to click through the one that matters. State the exact condition.
4. **PROVE THE REFUSAL IS REAL** — name the assertion that would show Cancel leaves the program byte-identical.
   Do not write it yet; name it.
5. **THE CONSEQUENCE, STATED PLAINLY** — after step 3, is there ANY in-app way to build a program with more
   than one operation, or is a multi-op `.nc` import the only source? You proved the fixture case cold this
   turn; say what it means for the user. **Do not design a fix for it** — the advisor is taking that fork to
   the human.

⚠ **DO NOT** add an export/save-first affordance, an undo, or any option nobody asked for. Surface it in the
plan if you think it matters; shipping it is not this task.
⚠ **DO NOT** start slice 2 of the vocabulary rename.
⚠ If a step-3 decision needs a human ruling, write the question INTO the plan — do not stop and wait.

# ═══ t1932 — WHERE ELSE IS THE OPERATION ENUMERATION STILL BLIND? (read-only sweep) ═══

t1930's plan ACCEPTED, claim verified by the advisor: `confirmDestructiveLoad` is real at `saveStates.js:66`,
exactly 2 callers (devMode), and it ALREADY encodes the silent-pass rule (non-empty AND signature differs) and
already snapshots to Undo. Step 3 is routing 4 unguarded doors through it. **Not dispatched yet** — the build
waits on the advisor's release gate finishing, and on the human's ruling on the multi-op fork.

**FOR WHOEVER BUILDS STEP 3 (do not act now):** the seam's message is hard-coded to the Blocks-tab context —
*"Opening X in Blocks replaces the program in the editor."* Wrong for file-import, open-project and Clear. The
message becomes a parameter of the seam; it does not become four messages at four doors.

## THE TASK — read-only. NO product code, NO specs, NO suite run. The advisor's gate is still running.
`flattenOps` fixed the SHALLOW enumeration. This sweep hunts the same family's other shapes.

1. **THE OVER-DEEP TWIN, in the file you just edited.** `setupSheet.js:106-113` `collectOps` recurses and
   pushes EVERY `type:'op'` it meets — so a `multi_step` wrapper is pushed **and then its children are pushed
   too**. `buildSheetHTML` takes that branch whenever the program declares `setup` containers, so the
   `flattenOps` fix does not cover it. **Determine REACHABILITY and say so plainly:** can an imported
   `multi_step` end up inside a `setup` container (`transform.js:41` is the only declaration site)? If yes, the
   sheet prints a phantom operation row plus the real ones. Report REACHABLE / NOT-REACHABLE with the evidence
   — do not fix it yet.
2. **THE SAME CLASS ONE LEVEL DOWN — CAM.** `slotPack.js:92-99` names *"the shipped multi-op + sub-stack bug"*
   in its own comment and was patched independently. Does `flattenOps` subsume that patch, or is CAM's case
   genuinely different? One declaration or two — answer it, don't assume.
3. **ANY OTHER SITE that asks "what operations does this program hold"** and still answers wrong. You wired 5;
   name what you deliberately left and why (`opAtLine`'s multi-op logic in `segment-frame-derivation` is
   already flagged as having no live-gesture path — confirm or correct that).
4. **The stale accumulation-era comment you flagged at `wizardManager.js:478-480`** — quote it and say what it
   should say. A comment asserting a behaviour the code no longer has is a lie the codebase tells about itself.
   Fixing a comment is not code; **you may fix this one** in the same docs commit.

⚠ Report REACHABLE/NOT with evidence, not a theory. "Unlocated" is an acceptable answer; a guess is not.
⚠ DO NOT start slice 2 of the rename. DO NOT build step 3.

# ═══ t1934 — DESIGN "ADD OPERATION": the gesture that grows a program (PLAN ONLY) ═══

t1932 ACCEPTED. Three things it got right: it stated its CONFIDENCE LEVEL on the reachability finding
("static trace, not an observed drag") instead of asserting it · it *checked* the segment-frame flag rather
than repeating it, and ruled out a candidate mechanism by grep · and it refused to conflate a DIFFERENT live
gap (`opAtLine`'s nested-child descent, now reachable via import) with the flag it was asked about.
Findings recorded: `collectOps` over-deep twin = REACHABLE (static) · `slotPack.js` = genuinely separate
domain, two declarations correctly stay two · `segment-frame-derivation-1838` flag CONFIRMED.

## CONTEXT — the human is ruling on this; your job is to make the ruling concrete, NOT to pre-empt it.
The word "op" means two things in this codebase: the CONTAINER (industry: a **program**, one per canvas) and
its CONTENTS (industry: an **operation**, several per program, each with its own tool). The user's ruling
"insert replaces the program" is correct for the container and destructive for the contents — as built, adding
a drill operation destroys the facing operation. The multi-operation machinery already EXISTS and emits
correctly (`blockEmitter.js:224-228` — an op container is transparent, verified): import can CREATE a
multi-operation program, but no gesture can GROW one.

**t1926 parked exactly this decision here:** `multi_step` is judged retirable *if* `operation` is the one word
at every depth — and that call "belongs to step 3's authoring UI." This is that moment.

## THE TASK — a written design. NO product code, NO specs, NO suite run (my gate is STILL running).
1. **WHERE DOES AN ADDED OPERATION GO?** A canvas holding one operation has no wrapper today (`groupConsecutive
   Ops` returns a run of 1 unwrapped). So does adding a second operation PROMOTE the single op into a wrapper,
   or does every program carry a wrapper from the start? Name the cost of each. **This is the `multi_step`
   retirement question in concrete form — answer it here.**
2. **WHAT HAPPENS WHEN IT DROPS BACK TO ONE?** Does the wrapper collapse? A shape that appears and disappears
   under the user is worse than one that is always there. State the rule and make it ONE rule.
3. **THE GESTURE ITSELF** — how does the user say "add" vs "start over" at the wizard bar? Sketch it (ASCII is
   fine). The user is a visual thinker; a picture beats a paragraph. **Present real options, not a menu of one
   good idea and two you have already dismissed** — and if one is clearly right, say which and why.
4. **WHAT DOES IT COST THE FOUR FEATURES JUST FIXED?** The setup sheet, time estimate, sim hints and flow
   labels all read `flattenOps`. If a wrapper now appears where none was, say what changes for them — including
   `collectOps`, whose over-deep twin you just proved REACHABLE.
5. **ORDER OF OPERATIONS INSIDE A PROGRAM.** A real job is face → drill → contour and the tool changes between
   them. Can the user reorder? If reordering is out of scope, say so — do not silently assume append-only.

⚠ **DESIGN, DO NOT BUILD.** No code, no specs, no new affordances shipped.
⚠ **Do not assume the user has ruled** — they have NOT. Write the fork, do not resolve it for them.
⚠ DO NOT start slice 2 of the rename.

# ═══ t1936 — THE RENAME LEFT STALE ASSERTIONS BEHIND. FIND THE CLASS, NOT THE INSTANCE. ═══

t1934 ACCEPTED — the design is adopted, and **the human has RULED: Add-to-program.** Option A (promote on the
2nd operation) + Option 1 (a 3rd button on the notice t1930 already designed) + the symmetric `count>=2` rule.
Your recommendation was taken on its reasoning, not its confidence. Not built yet — this task comes first.

## MY MERGE GATE RAN THE FULL SUITE: 2534 passed · 26 skipped · 22 flaky · **2 failed**.
- `middle-superset` E0 GATE shard 2 — **isolated, 14/14 green.** Known load flake, confirmed not argued.
- `blocks-edit-fail-loud-1518` PROOF 2 — **REPRODUCES IN ISOLATION. REAL.** And it is not a multi-op bug:

```
  spec line 109 expects   /2 ops/
  the app now emits       "Could not open 2 operations in Blocks — …"
```

**That is vocabulary-rename slice 1 (`f9900ab2`).** The app's new wording is CORRECT and stays. The spec kept
asserting the old word, and it has been red since slice 1 landed — nothing caught it because slice 1 was never
run against the full suite. The gate is doing its job; the follow-through is yours.

## THE TASK
1. **FIX the stale assertion** at `blocks-edit-fail-loud-1518.spec.js:109`. The app's wording is the truth.
2. **⚠ THEN FIND ITS SIBLINGS — this is the actual task.** One stale assertion means the rename's test-side
   sweep was incomplete, and the rest are invisible until the next full suite. **Sweep `tests/` for every
   assertion still matching on the OLD vocabulary** (`/\bops?\b/` inside `toMatch`/`toContain`/`toBe`/string
   comparisons, and the same words in fixture expectations). Report the FULL list before fixing, then fix them.
3. **Say how many you found.** If it is only the one, say that — a sweep that finds nothing is a real result and
   I want it stated, not implied.
4. **VERIFY:** the touched specs by name, plus the node tier. **Do NOT run the full suite** — that is my gate
   and I re-run it before the release.

## ⚠ TEST-RUNNER TRAP I HIT THIS TURN — use the working form
`npx playwright test <file-or-name>` now dies with *"Playwright Test did not expect test() to be called here /
No tests found"* on EVERY spec — an argument-matching quirk, not a broken environment (versions are consistent
at 1.58.2, `node_modules` intact, process table clean). **`npm run test:e2e -- --grep "<name>"` works.** Use it.

⚠ Do NOT build the Add gesture, the doors, or `collectOps` this turn — they are queued behind the release.
⚠ Do NOT start slice 2 of the rename. Fixing STALE ASSERTIONS left by slice 1 is finishing slice 1, not slice 2.

# ═══ t1938 — CLOSE THE THREE SILENT DOORS (step 3, minus Insert) ═══

**RELEASED V2026.08.15.11** (`1167455b`, pushed). t1936 accepted: one genuinely stale assertion, no siblings —
and the sweep was done by CHECKING ~20 candidates against live app source, not by trusting a grep count. Two
findings correctly kept OUT of the fix and recorded here instead:
- **NEAR-MISS:** `lathe-honest-3d-1301.spec.js:169` still passes by substring luck (`'Drill op'` is a prefix of
  `'Drill operation'`). Not broken; it is a test that would not fail if the thing it guards broke. **Queued.**
- **SLICE 1 MISSED A WHOLE REGION:** `web/ui/macrosApp.js` (~15 strings — dialog text, button titles, the
  "N of M" hint) plus `stackToSlot.js` / `subStackToSlot.js` / `createPreviewPanel.js` were never surveyed.
  Nothing red today. **This is slice 1's real remainder — its own task, not folded into anything.**

## THE TASK — route the THREE SILENT doors through the seam that already exists.
`confirmDestructiveLoad` (`saveStates.js:66`) already snapshots to Undo and already stays silent when there is
nothing to lose (empty program, or an identical load). **Route, do not reinvent.** These three destroy the
user's work with NO warning today:

| door | site | what the user was doing |
|---|---|---|
| import a `.nc` file | `commandDeck.js:148` | opening a file on top of live work |
| open a saved project | `programFile.js` `loadProject` (**3 UI callers**) | opening a `.mjson` |
| the editor Clear button | `editorManager.js:165` | one click, no confirm |

1. **THE MESSAGE BECOMES A PARAMETER OF THE SEAM.** Today it is hard-coded to the Blocks-tab context —
   *"Opening X in Blocks replaces the program in the editor"* — which is wrong at all three of these doors.
   **One seam, a parameterised message. NOT three messages at three doors, and NOT a second seam.**
2. **ALL THREE `loadProject` CALLERS**, not the convenient one. If the guard belongs inside `loadProject`
   rather than at its callers, say so and do that — one guard beats three.
3. **PROVE THE REFUSAL IS REAL, per door:** Cancel leaves the program **byte-identical** (assert the G-code, not
   a flag), and the surface the user was on is untouched. This is the assertion you named in t1930 — write it now.
4. **PROVE THE PROCEED IS RECOVERABLE:** the snapshot lands and Undo restores the prior program.
5. ⚠ **DO NOT TOUCH THE WIZARD-BAR INSERT DOOR** (`wizardManager.js:512`). It is the 4th door and it gets a
   **THREE-button** dialog (Add / Replace / Cancel) under the human's Add-to-program ruling — building it
   two-button now means building it twice. It lands next turn, together with Add.

**Gate: the specs you touch, by name, plus the node tier. NOT the full suite** — that is my release gate.
⚠ Use `npm run test:e2e -- --grep "<name>"`; bare `npx playwright test <file>` is broken here.
⚠ No new affordances beyond the notice: no "save first" button, no undo UI, nothing unasked.
⚠ DO NOT start slice 2 of the rename.

# ═══ t1940 — THE ADD MECHANISM (data level, no UI) + the wording defect ═══

t1938 accepted. Three things beyond the ask: you found a **4th** `loadProject` caller my dispatch miscounted
(`projectModal.js:194` via `openMacroText`); you put the guard INSIDE `loadProject` instead of at 4 call sites,
which is the better answer to my own "one guard beats three"; and you **proved non-vacuity by reverting the
guard and watching the test fail** rather than asserting the test was meaningful. That last one is the
difference between a test and a decoration.

## ⚠ FIRST — A WORDING DEFECT IN WHAT YOU JUST SHIPPED. Fix before anything else.
All three new dialogs say *"replaces your current **operation**"* while one title says *"Open this
**program**?"* — two words for one thing, inside a single dialog, in the week we ruled the vocabulary.
**And the body text is factually wrong:** what is replaced is the whole PROGRAM. Import a face+drill+bore job
and the dialog claims ONE operation is at risk while THREE are destroyed. Fix all three to **program**
(`commandDeck.js`, `programFile.js`, `editorManager.js`) and check the seam's own default string too.

## THEN — THE ADD MECHANISM, DATA LEVEL ONLY. NO UI, NO DIALOG, NO BUTTON.
The human ruled Add-to-program. This turn builds only the mechanism underneath it, so the UI turn that follows
is pure wiring onto something already proven.

1. **A DECLARED `addOperation(program, incoming)`** in `programModel.js`, beside `flattenOps`. Promote-on-2nd
   (Option A): a program holding ONE operation and no wrapper becomes a wrapper holding BOTH; a program already
   holding a wrapper appends into it. Reuse `groupConsecutiveOps` / `collapseImportTerminators` — you noted both
   are **private**; export them rather than duplicating their logic.
2. **THE SYMMETRIC RULE, ONE FUNCTION, BOTH DIRECTIONS:** wrapper iff `count >= 2`. Removing back down to one
   collapses the wrapper. **The same function decides growing and shrinking** — no hand-rolled mirror at delete.
3. **⭐ THE ASSERTION THAT MATTERS — AN EQUIVALENCE BRIDGE, NOT A SHAPE CHECK.** `addOperation(A, B)` must emit
   **BYTE-IDENTICAL G-code** to importing a file containing A then B. The import path is already proven
   (`multi-op-import-1916.spec.js`) — bridge to it. A test that only asserts the tree shape would pass while the
   emitted program was wrong.
4. **ASSERT WHAT THE USER GETS:** after adding a 2nd operation, the setup sheet lists 2 operations with their
   own tools, the time estimate splits 2 ways and sums to the total, and both bodies appear in the G-code.
5. **🛑 STOP CONDITION — the single-operation case is the overwhelmingly common one.** If ANY of this changes
   the emitted G-code for a one-operation program, **stop and tell me** rather than adjusting a fixture.

⚠ **NO UI THIS TURN.** No dialog, no third button, no wizard-bar change. `wizardManager.js:512` stays untouched
— it lands next turn wiring onto this.
⚠ **QUEUED, do not do now:** the marker-FREE raw-text fallback door you named in `commandDeck.js` (same onload
handler, reflects through the editor's debounced sync). It IS a real door — same loss, different mechanism —
and it gets its own turn. Good call surfacing it instead of quietly widening scope.
⚠ Gate: your new specs + the 4 t1928 features by name + the node tier. NOT the full suite.
⚠ DO NOT start slice 2 of the rename.

# ═══ t1942 — THE + ADD BUTTON (the human's ruling, wired) + one vacuous test ═══

t1940 accepted. The mechanism is right and it is built out of the proven pipeline rather than a lookalike of
it. Two things I want repeated: when your bridge test failed you **debugged the REFERENCE, not the subject**,
and found your own fixture was wrong rather than "fixing" `addOperation` to match a bad expectation — that is
the failure mode this whole loop exists to catch, caught by you first. And you inspected the raw diff BEFORE
applying `codeOnly()` and confirmed the remaining differences were comment-text only, instead of reaching for
the normaliser and hoping.

## ⚠ FIRST — ONE OF YOUR FOUR TESTS IS VACUOUS. Fix or delete it.
`add-operation-1940.spec.js`, the STOP-CONDITION test. It loads program A, emits, reloads **the same** program
A, and asserts the two emissions match. **`addOperation` is never called in it.** It would pass unchanged if
`addOperation` corrupted every single-operation program in the app — which is the exact claim its own name
makes. Your own non-vacuity run already said so: 2 of 4 failed on a naive revert, and this is one of the two.
**Make it load-bearing or delete it.** A test that cannot fail is worse than no test: it stops the next reader
looking. (A real version: assert the pipeline `addOperation` runs is an IDENTITY on a one-operation program —
same stack, byte-identical emit. That can fail.)
*(Test 2, the symmetric-rule one, is fine — it exercises `groupConsecutiveOps` directly and means something.
But note plainly: **the collapse-on-delete path is not built or called yet.** Do not let that promise get lost.)*

## THEN — WIRE THE + ADD BUTTON. This is the feature the human ruled.
Wizard-bar Insert (`wizardManager.js:512`) on a NON-EMPTY canvas offers three choices; on an EMPTY canvas it
inserts with no dialog at all, exactly as today.

```
  +--------------------------------------------------+
  |  Insert this operation?                          |
  |  Your program already has: Facing (1 operation)  |
  |  [ + Add as a 2nd operation ]  [ Replace it ]    |
  |                  [ Cancel ]                      |
  +--------------------------------------------------+
```

1. **THE THIRD CHOICE IS A DECLARED DIALOG PRIMITIVE.** `dialog.js` exposes only `dlgConfirm` / `dlgPrompt` /
   `dlgNotice` — all two-way. **Add a declared multi-choice primitive there**, next to its siblings. Do NOT
   hand-roll a bespoke three-button modal inside `wizardManager.js`.
2. **🛑 ONE SEAM STILL OWNS THE RULES.** The silent-pass condition (empty program / identical load) and the
   Undo snapshot live in `confirmDestructiveLoad` and must not be copied into a second function. If the clean
   shape means changing that seam's signature, change it and update all callers — **but if you find yourself
   writing the silent-pass test a second time anywhere, STOP and tell me instead.**
3. **ADD USES `addOperation`** — the thing you proved last turn. Replace keeps today's behaviour.
4. **ASSERT ALL THREE OUTCOMES, on what the user sees:** Add → two operations on the canvas, both bodies in the
   emitted G-code · Replace → one operation, the previous one gone · Cancel → the program **byte-identical**.
5. **PROVE NON-VACUITY** the way you did in t1938 — break it, watch the test fail, restore.
6. **WORDING:** "program", never "operation", for the thing being replaced. It is a program.

⚠ Gate: your new specs + `destructive-load-doors-1938` + the 4 t1928 features + node tier. NOT the full suite.
⚠ Land it COMPLETELY; park anything that does not fit rather than leaving two half-done pieces.
⚠ Still queued, not now: the marker-free raw-text import door · `collectOps`'s phantom row · the
`lathe-honest-3d-1301` near-miss · slice 1's unswept region (`macrosApp.js` et al) · slice 2 of the rename.

# ═══ t1944 — MAKE THE SUITE DIALOG-AWARE (release gate blocker) ═══

t1942 accepted, both pieces, and both constraints I set were held: `dlgChoice` is a real sibling of
`dlgConfirm`/`dlgPrompt`/`dlgNotice` sharing `openDialog` — not a bespoke modal — and `confirmDestructiveLoad`
still writes the silent-pass condition **exactly once**, branching only on which dialog to show. The
`buildActiveOpRecord` / `commitActiveOp` / `addActiveOp` split means Add and Replace share one record builder
instead of becoming two mechanisms.

**The best thing in that turn was a refusal:** when `destructive-load-doors-1938` started hanging you
**reproduced it in isolation before concluding it was the fixture**, rather than assuming your own new code was
innocent. Concluding "not my bug" is exactly where a real regression hides, and you didn't take the shortcut.

## THE TASK — the systemic risk YOU named. It blocks my release gate, so it is the whole turn.
Insert now shows a dialog on a non-empty canvas. **Any spec that inserts a 2nd operation onto an already-
populated canvas without clearing first will HANG on it** — you hit exactly one and fixed it. Your scoped gate
(36/36) could not see the rest, correctly, because I told you not to run the full suite.

1. **FIND THE CLASS, not the instances.** Sweep `tests/` for every spec that reaches `insertWiz()` (or any
   insert gesture) while the canvas is already non-empty — the tell is two inserts with no
   `ddcsLoadBlockStack([])` between them, but do not trust that single pattern; a canvas can be populated by an
   import, a project load, or a previous test's leftovers too.
2. **REPORT THE FULL LIST FIRST, WITH A COUNT**, then fix. If the answer is "only the one you already fixed",
   say that plainly — a negative sweep is a real result and I will act on it.
3. **FIX MINIMALLY, PRESERVING EACH TEST'S ORIGINAL INTENT.** Use the established clear-then-insert pattern, or
   accept the dialog via the existing `_appDialog.js` helper — whichever matches what that test was proving.
   ⚠ **Do NOT rewrite a test to exercise the new Add gesture** because it now can. A test that was proving
   something else keeps proving that thing.
4. **⚠ IF A SPEC HANGS FOR A DIFFERENT REASON, STOP AND TELL ME** — do not fix it into passing. A hang that is
   not the dialog is a different bug and I want to see it before it is absorbed.
5. **You MAY run broadly this turn** — this task IS a suite-wide sweep. I am NOT running my gate concurrently;
   the machine is yours. Report the failed COUNT, not just the tail (a tail showing "N passed" can hide "N
   failed" above it).

⚠ Still queued, not now: `collectOps`'s phantom row · the marker-free raw-text import door · the
`lathe-honest-3d-1301` near-miss · slice 1's unswept region (`macrosApp.js` et al) · slice 2 of the rename ·
collapse-on-delete (the symmetric rule's other half, still not built).

# ═══ t1946 — DESIGN: the other half of the symmetric rule (collapse-on-delete) + the reorder question ═══

t1944 accepted — a genuinely good sweep. **The best part was catching a flaw in your own method:** noticing
that the first full run was misleadingly clean because files load fresh mid-run and your in-flight edits landed
before some specs' turn came up, then re-running with everything already in place for a trustworthy count, and
cross-checking the JSON reporter because the terminal buffers unreliably here. Most sweeps would have reported
the first number. 7 files, root causes named per file, one shared `clickInsertChoice` helper instead of 4
inline copies. And `anchor-contamination-1786` was the right call for the right reason — its own title says *on
a REAL CONCATENATED PROGRAM*, so Add restores what it always tested; Replace would have left it unable to test
its own claim. That is preserving intent, which is what I asked for, not reaching for the new toy.

**MY RELEASE GATE IS RUNNING** on `e61e6b72` for the duration of this turn. **Read-only: no code, no specs.**

## THE TASK — design, do not build.
The user can now ADD operations. The very next thing they will do is REMOVE one and REORDER them. Neither is
designed, and one of them is a promise already made in code.

1. **COLLAPSE-ON-DELETE — the promise `addOperation`'s own doc comment makes.** It says a future delete path
   "re-runs this same function over what remains rather than hand-rolling its own mirror-image collapse rule."
   **Nothing calls it yet.** Answer concretely: **where does a delete actually happen today?** (Blockly's own
   block-delete in the Blocks tab is the obvious one — are there others: an editor edit that removes an
   operation's lines, a project load, an undo?) For each, name `file:line` and say whether the program passes
   through a single choke point on its way back into the model. **If one choke point exists, the collapse is one
   line there. If it does not, say so — that is the finding, and it changes the design.**
2. **⚠ THE FAILURE MODE TO DESIGN AGAINST:** a wrapper left holding ONE operation. The shape then disagrees with
   what `addOperation` would have produced for the same content — **two ways to represent one program**, which
   is the second-source defect this whole session has been deleting. Say what goes wrong downstream if it
   happens (setup sheet? `flattenOps`? emit?) — check, do not assume; `flattenOps` may well be immune.
3. **THE REORDER QUESTION — you named it UNVERIFIED, so settle what CAN be settled from source.** A real job is
   face → drill → contour and that order is the tool-change sequence. Trace whether a `multi_step`'s children
   render as draggable sibling blocks in the Blocks tab (`stackBridge.js` / `bridge.js` — the same mechanics you
   traced for `setup` in t1932). **State it as REACHABLE / NOT / NEEDS-A-BROWSER.** If it needs a browser, say
   so plainly and I will queue the check — do not guess, and do not build a reorder control.
4. **NAME WHAT YOU WOULD NOT DO.** If reorder-in-Blocks is enough and a Studio-tab reorder control would be
   unasked chrome, say that. The human decides, but I want your read.

⚠ Design only. No code, no specs, no suite run — my gate owns the machine this turn.
⚠ Still queued: `collectOps`'s phantom row · the raw-text import door · `lathe-honest-3d-1301` · slice 1's
unswept region · slice 2 of the rename.

# ═══ t1948 — ONE SHAPE FOR ONE PROGRAM: fix addOperation's nesting + wire collapse-on-delete ═══

t1946 accepted, and **the unplanned finding is the most valuable thing in it.** You went looking for the delete
design and found a live defect in code we shipped two turns ago:

> **`addOperation` NESTS instead of flattening when a 3rd operation is added to an existing 2-op wrapper** —
> contradicting its own doc comment, and never covered because the bridge test I specified only went to TWO.

That is a **second source** — the exact defect class this whole session has been deleting:

```
   import a 3-operation .nc   ->  multi_step( A, B, C )              flat
   add A, add B, add C        ->  multi_step( multi_step(A,B), C )   nested
                                  ^ two shapes, one program
```

They agree TODAY only because `flattenOps` and the emitter both recurse. The first thing that walks one level —
and `collectOps` already does — sees two different programs. **My test spec was the hole:** an equivalence
bridge that stops at 2 proves nothing about 3. That is my miss, not yours.

## THE TASK — one fix shape, two call sites. You already named it: flatten-then-regroup.
1. **FIX `addOperation`** so adding onto an existing wrapper produces ONE flat wrapper, never a nest. Make the
   doc comment true — or, if the comment is the thing that is wrong, say so and correct THAT instead. **One of
   the two is lying and it is not allowed to stay that way.**
2. **EXTEND THE BRIDGE TEST TO 3 AND 4 OPERATIONS.** Same claim as before — byte-identical G-code against the
   import path — but at the arities that actually exercise regrouping. **This is the assertion that would have
   caught it**, so it is the one that must exist now.
3. **WIRE COLLAPSE-ON-DELETE** at the single choke point you confirmed — `workspaceToStack`
   (`stackBridge.js:173`), the only path that can produce a malformed `multi_step`. Same flatten-then-regroup
   pipeline, so grow and shrink genuinely share one rule rather than two that match by hand.
4. **ASSERT THE SHAPE CONVERGES, both directions:** add 3 → delete 1 → the result is shape-identical AND
   emit-identical to having added 2. That is the symmetric-rule promise, finally testable.
5. **PROVE NON-VACUITY** on every new test — break it, watch it fail, restore. You have done this four turns
   running; keep it.

⚠ **STOP CONDITION:** if fixing the shape changes the emitted G-code for ANY arity, stop and tell me. The
G-code is currently CORRECT at every arity (both paths recurse) — this is a shape fix, not an output fix, and
byte-identical output is the proof it stayed that way.
⚠ **MY GATE IS KILLED, the machine is yours.** Run what you need. Gate: your new specs + `add-operation-1940` +
`insert-add-replace-1942` + the 4 t1928 features + node tier. I run the full suite after this lands.
⚠ Do NOT fix `collectOps` this turn (still queued) — but note whether this fix changes its phantom-row story.

# ═══ t1950 — 🛑 BLOCKER: regroupOps made the canvas round-trip LOSSY. Release is held. ═══

**My full gate on `57f0f854`: 2538 passed, 26 skipped, 29 flaky, 12 FAILED** (the last valid gate had 2).
I isolated two of them — **they reproduce, this is not load contention:**

```
  guard-roundtrip-1595  "no block is lost through the canvas"
      Expected: 54   Received: 52      <- two blocks EATEN by the round-trip
```

## THE CAUSE — and my review flagged the claim before the gate confirmed it.
`regroupOps` calls `collapseImportTerminators`, which **strips every `endprogram` from anywhere in the tree
(recursing into `.children`) and re-appends only the LAST one at top level.** Wiring that into
`workspaceToStack` put it on EVERY Blockly edit. An op that legitimately carries its own terminator inside its
body — **corner does, by original design** (`stripEndprogram`'s own comment says so) — gets it torn out and
hoisted on the next edit. Hence the Homing+Corner cluster: `marker-rebuild-1848` ×2,
`option-b-slice2-positioning-1872`, `option-b-slice3-live-visibility-1874` ×3, `cam-multiop-edit-blocks-s45`,
`fork-parity-1593`, `guard-roundtrip-1595` ×2.

**Your doc comment asserts the opposite:** *"can only change which ops share a wrapper, never what emits."* The
wrapper half is true; the terminator half is false, and the gate just proved it. **Correct the claim as part
of the fix** — a comment promising a safety the code doesn't provide is the defect, not a side note.

## THE FIX — separate the two concerns; do NOT weaken the shape rule.
1. **The SHAPE rule is shared and stays shared:** flatten any wrapper, then regroup. Both `addOperation` and
   `workspaceToStack` want exactly that.
2. **The TERMINATOR rule is NOT universal.** Deduping terminators is right when SPLICING a new op into an
   already-framed program (`addOperation`) and when concatenating framed programs (`importMarkedNc`). It is
   **wrong on a workspace read-back**, where every block the user placed must survive verbatim. Apply it where
   a terminator conflict can actually arise — not in the shared shape pipeline.
   ⚠ **This is a SEPARATION, not a second shape rule.** If you end up with two functions that both decide
   wrapping, STOP and tell me — that is the thing we just spent three turns deleting.
3. **ASSERT LOSSLESSNESS IN YOUR OWN SPECS**, not only in `guard-roundtrip-1595`: a workspace round-trip
   through `workspaceToStack` returns the same block COUNT and the same tree, including any `endprogram` a
   user placed or an op body carries. That assertion is what was missing.
4. **`probe-input-select-revival-1888` is on the known-chronic-flake list** — verify it in isolation before
   attributing it to this. Do not fold a flake into the fix's story, and do not dismiss it without checking.

## ⚠ AND THE GATE-SCOPING LESSON IS MINE, NOT YOURS.
Your scoped gate (12/12 + 19/19 + 118/118) was exactly what I named, and it could not have caught this — **I
named a feature-scoped gate for a change landing in a UNIVERSAL choke point.** Every Blockly edit goes through
`workspaceToStack`. New rule, and I am writing it into the dispatch template: **when a change lands in a
choke point every edit passes through, the gate includes the ROUND-TRIP and PARITY specs
(`guard-roundtrip-1595`, `fork-parity-1593`, `marker-rebuild-1848`, `option-b-*`), not just the feature's own.**

⚠ Gate for THIS turn: all 12 failing tests by name + your own specs + node tier. The machine is yours; I run
the full suite again after this lands. Nothing releases until it is clean.

# ═══ t1952 — DESIGN: stop the architecture-map citations rotting (read-only) ═══

t1950 accepted, blocker cleared. **The turn's real value was refusing to stop at the first fix.** Fix 1 made
`guard-roundtrip-1595` and `fork-parity-1593` green — and you noticed the other four named files were STILL
red, and treated that as evidence of a second distinct bug rather than as flakiness or a fixture problem. Two
bugs, found because the first fix's success did not satisfy you. Fix 2 is right for the same reason Fix 1 is:
**a workspace read-back must REFLECT what is there, not normalise it.** Wrapping two never-wrapped ops is a
mutation on read, the same class as eating a terminator. And you isolated `probe-input-select-revival-1888`
(5/5, the known chronic flake) instead of folding it into the story.

## ⚠ TWO THINGS FROM YOUR OWN REPORT, NOW QUEUED — do NOT do them this turn.
1. **🔴 `blkStartHints` NEVER RUNS `flattenOps` — it is a SIXTH site of the t1928 bug.** You surfaced it while
   chasing something else. It is the same defect as the four the setup sheet/time estimate/sim hints had:
   a multi-operation program's hints resolve wrong. **This is the next CODE task after the release.**
2. `hasWrapper` checks TOP-LEVEL items only. A `multi_step` dragged inside a `setup` container (t1932 proved
   that reachable) would not trigger collapse. Narrow, same territory as `collectOps`. Noted, not urgent.

## THE TASK — read-only design. My full gate is RUNNING; no code, no specs.
**The architecture-map citations have now drifted TEN times**, and three of those were this session alone —
every turn that edits a cited file pays a fix. You flagged it as "a maintenance cost, not restructuring." I
disagree: ten repetitions is not a cost, it is a design defect asking to be fixed. A map with a checker is a
guarantee; a map whose checker fails for a reason nobody cares about trains everyone to fix it mechanically —
and a check people fix without reading is a check that has stopped working.

1. **WHY do they drift?** If the citations are `file:line`, any edit above the line breaks them while the claim
   stays true. Name the actual mechanism, with examples from this session's three.
2. **WHAT WOULD NOT DRIFT?** Options to cost, not one recommendation: anchor to a SYMBOL (function/export
   name) and let the checker find its line · anchor to a distinctive source SUBSTRING · GENERATE the cited
   sections from the declarations themselves and mark them do-not-hand-edit · or narrow what earns a citation.
3. **WHICH CLAIMS ARE DERIVABLE vs GENUINELY HAND-WRITTEN?** Generated content cannot rot. Say roughly how much
   of the map falls in each bucket — that ratio decides whether this is worth doing at all.
4. **⚠ SAY SO IF IT IS NOT WORTH IT.** If the honest answer is "ten cheap fixes beat one migration", say that
   and I will drop it. A negative from you has been worth acting on every time.

⚠ Design only. No code, no specs, no suite run.
⚠ Queue behind the release: `blkStartHints` (🔴 first) · `collectOps` phantom row · raw-text import door ·
`lathe-honest-3d-1301` near-miss · slice 1's unswept region (`macrosApp.js`) · rename slices 2–4 · marker key.

# ═══ t1954 — 🔴 THE SIXTH SITE: blkStartHints never runs flattenOps ═══

**RELEASED V2026.08.15.12** (`f1d4aaac`, pushed). Gate: full suite on `3f018f1b` — 2549 passed, 26 skipped,
33 flaky, **unexpected 0**, both tiers exit 0. The prior run on this arc had 12 failures; all 12 traced to the
two shape bugs and are green. Node tier re-run on the release commit: 118/118.

t1952 accepted, and **I was right to overrule you — but you were right about the option.** The measurement is
what makes it actionable: 52 asserted citations counted from the arrays (not estimated), 10 sampled find
patterns tested against their real files with 8 of 10 NON-unique, and the generate-from-declaration option
**checked and eliminated** (0 of 52 are undiscovered candidates). Best single finding: symbol-anchoring would
**not** have caught either of this session's own drifts, because both moved from INSIDE their own anchor
function's doc comment. Recommending the option that covers the ACTUAL drift shape over the one that sounds
more principled is the right instinct. And the caveat is the part I'd have missed: **dropping the line number
without asserting uniqueness WEAKENS the checker while feeling like an improvement.** Option B is approved with
that assertion mandatory — but it is not this turn.

## THE TASK — close the t1928 bug's SIXTH site. You found it; it is yours to close.
`blkStartHints` never runs `flattenOps`, exactly like the four sites t1928 fixed. On a multi-operation program
the Blocks-tab sim start markers resolve against a wrapper instead of the real operations.

1. **FIX IT THROUGH THE DECLARED ENUMERATION** — `flattenOps`, the same one the other five use. If it needs
   something `flattenOps` does not give, **stop and tell me** rather than growing a variant.
2. **ASSERT WHAT THE USER SEES:** on a multi-operation program the Blocks tab shows a start marker for EVERY
   operation, at the right position — not one, and not one per wrapper. `marker-rebuild-1848` is the closest
   existing evidence; bridge to it rather than inventing a parallel claim.
3. **⚠ THEN ASK WHETHER THERE IS A SEVENTH.** Five sites were found by one sweep, a sixth surfaced by accident
   two turns later. That is a sweep that missed one. **Re-run the enumeration hunt properly** — every site that
   asks "what operations does this program hold" — and report the count with the method, so the answer is
   trustworthy this time. If six is genuinely all, say so and I will treat the class as closed.
4. **GATE — the new rule, because this lands near a shared path:** your specs + `marker-rebuild-1848` +
   `option-b-slice2/3` + the round-trip/parity set (`guard-roundtrip-1595`, `fork-parity-1593`) + the 4 t1928
   features + node tier. NOT the full suite; that stays mine.

⚠ Queued after: `collectOps` phantom row · the raw-text import door · architecture-citation Option B (with the
uniqueness assertion) · `lathe-honest-3d-1301` near-miss · slice 1's unswept `macrosApp.js` · rename slices 2–4.

# ═══ t1958 — 🔴 EDIT IS SILENTLY DEAD ON A MULTI-OPERATION PROGRAM (release-quality) ═══

t1954/1955 accepted (`6c7bc33c`). And **demanding the re-hunt was worth it: six was not all — eleven.** Five
more sites, each checked against live source with 34 candidates ruled out, not grep-trusted. That is the third
sweep of yours I have been able to act on without re-deriving it.

**Ranking your five — I agree `openForEdit` is first, and it is more urgent than you framed it.** I verified it
myself at `wizardManager.js:407`:

```js
const op = prog.find((b) => b && b.type === 'op' && b.id === opId);
if (!op || !op.opType) return;        // top-level only -> SILENT no-op
```

`ddcsOpAtLine` recurses, so the Edit chip renders **enabled and clickable**; the click then resolves nothing
and returns. **And V2026.08.15.12 — shipped yesterday — is what makes it reachable**: before Add, only an
import produced a wrapper. Now every multi-operation job a user builds hits it. Edit is dead on exactly the
programs the new feature exists to create.

## THE TASK — one operation, and it is NOT "add flattenOps here".
1. **⭐ THE DEFECT IS TWO LOOKUPS FOR ONE QUESTION.** `ddcsOpAtLine` recurses; `openForEdit` does not. Making
   them *agree* by patching the second is how they drift again. **Resolve an op-by-id ONCE, through one
   declared lookup both call** — the chip and the click must be incapable of disagreeing, not merely equal
   today. If that means exporting/naming a resolver in `programModel.js` beside `flattenOps`, do that.
2. **ASSERT WHAT THE USER DOES:** on a real Add-built two-operation program, click Edit on the **second**
   operation → the wizard opens, seeded with **that** operation's params (not the first's, not empty), and a
   changed value commits back to that operation. Drive the real gesture; a unit call on the resolver would pass
   while the chip stayed dead.
3. **⚠ ASSERT THE CHIP AND THE CLICK CANNOT DISAGREE** — the case where the chip renders and the click no-ops
   is the actual bug, so it needs its own assertion, not just a working-path test.
4. **PROVE NON-VACUITY** — revert, watch it fail, restore. Every turn so far; keep it.
5. **GATE (widened — `wizardManager.js` is the most-trafficked file in the repo):** your specs + the round-trip
   and parity set (`guard-roundtrip-1595`, `fork-parity-1593`) + `insert-add-replace-1942` +
   `add-operation-1940` + `collapse-on-delete-1948` + the 4 t1928 features + node tier.

⚠ **STOP CONDITION:** if the single-operation Edit path changes behaviour in ANY way, stop and tell me. That is
the common case and it works today.

## Queued — your other four, in my order (do NOT do them now)
`segmentFrame.js frameOwnerAtLine` (sim machine-frame flip never fires for a nested op — its own comment claims
it handles exactly that case, so the code is lying) → `editorOpHover.js glowEdited` → `editorManager.js
_firstOpTitle` (exported .nc titled `multi_step`) → `setupSheet.js collectOps` (the over-deep twin — **different
fix shape**, substitute-not-both). **Then: a CHECKER so a twelfth site cannot land silently** — eleven found
across three sweeps says the class needs a test, not a fourth sweep.

# ═══ t1960 — DESIGN THE CHECKER: make a twelfth site impossible to land silently (read-only) ═══

t1958 accepted (`37b27d80`) — **and you corrected MY diagnosis with live evidence, which is the best thing in
the turn.** I said "chip renders enabled, click no-ops." Your own test showed the chip rendered **disabled**,
because `findOpInStack` matched the WRAPPER (it checked its own level before recursing) and `canEdit('multi_step')`
is false. One layer upstream of where I pointed. You found it by testing the prediction instead of implementing it.
Three duplicate by-id lookups collapsed to one, `opGlow.js`'s private copy deleted, and you fixed
`opSession.js`'s `replaceOp` too — the commit path that would have failed one step *after* the open succeeded.

## ⚠ ONE RESIDUE, first thing next code turn (NOT now — my gate is running).
`wizardManager.js` (both sites) reads:
```js
window.ddcsFindOpById ? window.ddcsFindOpById(prog, opId) : prog.find((b) => b && b.type === 'op' && b.id === opId)
```
**The fallback branch IS the bug you just fixed**, kept alive behind a truthiness check. Either it can never
fire (dead code asserting a danger that doesn't exist) or it can (the bug is still reachable). I checked:
`programModel.js` does NOT import `wizardManager.js`, and `wizardManager.js` already imports from `./blocks/`
— **so import `findOpById` directly and delete the fallback.** If a real load-order/cycle reason forces
`window.`, keep it but make the absence LOUD (return null) — never silently fall back to a known-wrong lookup.

## THE TASK — read-only design. My full gate is RUNNING: no code, no specs, no suite run.
**Eleven sites, three sweeps, and a twelfth is a matter of time.** Three hand sweeps found them; a fourth is
not the answer. Design the test that fails when a new one lands.

1. **WHAT IS THE DETECTABLE SHAPE?** Every one of the eleven asks "which operations does this program hold" or
   "find the op with this id" and answers it by walking only the top level (or, for `collectOps`, by walking too
   deep). Is that mechanically detectable — a filter on `type === 'op'` / a `.find` on an id, in a file that
   does NOT go through `flattenOps`/`findOpById`? **Name the false positives**, because a checker that cries
   wolf gets suppressed and becomes decoration.
2. **WHERE DOES IT LIVE?** It is a file read and a grep — it belongs in the FASTEST tier (node), beside the
   architecture-map checker, not in a 32-minute suite.
3. **ALLOW-LIST vs DERIVE.** A hand-maintained list of blessed sites is the thing this project keeps deleting.
   Can the legitimate cases be *derived* instead (e.g. the walker itself, structural code that must see
   wrappers)? If an allow-list is genuinely unavoidable, say why and how it stays honest.
4. **⚠ SAY IF IT IS NOT WORTH IT.** If the honest answer is "the shape is too varied to detect without noise,
   fix the remaining four and move on", say that. Your negatives have been right every time.
5. **COST IT** against the alternative: fixing four more sites by hand and accepting a fifth sweep later.

⚠ Queued code work, in order: the `window.` fallback above · `segmentFrame.js frameOwnerAtLine` (its comment
claims it handles the nested case — the code lies) · `editorOpHover.js glowEdited` · `editorManager.js
_firstOpTitle` · `setupSheet.js collectOps` (over-deep, different shape) · then whatever this design concludes.

# ═══ t1962 — IS THE `window.X ? X : fallback` IDIOM SAFE ANYWHERE? (read-only) ═══

t1960 accepted, and **it overturned my ordering — correctly.** Rather than hand-sweep a fourth time you framed
the sweep MECHANICALLY (the shape, not "what else asks this question") and it found **6 brand-new sites the
three hand sweeps never named**. That is the evidence for the checker, produced by the design itself: "three
sweeps converged" was falsified for the cost of one dispatch. Two corrections of mine accepted: `collectOps`
is **not** this bug (it recurses correctly; its defect is the opposite, double-counting) and needs its own fix;
and `opContextMenu.js showOpMenu` finds by **bare id with no type test**, so a checker keyed on `type === 'op'`
alone would miss it.

## ⚠ MY RULING ON "SHIP IT RED" — a RATCHET, not an allow-list and not a permanent red.
You are right that allow-listing real bugs to green hides them. But a permanently-red checker breaks my
release gate: I could no longer tell a regression from the known debt. So:
**the checker carries an explicit INVENTORY of the currently-open sites, and FAILS on anything not in it.**
The inventory may only ever SHRINK — a checker that fails when it GROWS. The debt is visible, counted, and
cannot hide a new site. Build it that way, ranked above the individual fixes exactly as you recommended.

## THE TASK — read-only. My full gate is STILL RUNNING: no code, no specs, no suite run.
You found the guarded-fallback idiom `window.ddcsX ? window.ddcsX(...) : <inline fallback>` at **9 sites**.
I told you to delete it in `wizardManager.js` because its fallback is the exact bug we had just fixed. Before
that instruction generalises or stays local, I need to know what the other seven do.

1. **CLASSIFY ALL 9.** For each: what does the fallback branch actually do if `window.ddcsX` is missing —
   (a) a KNOWN-WRONG implementation (like `wizardManager`'s), (b) a benign no-op/empty result, or (c) a genuine
   equivalent? `file:line` each.
2. **CAN THE GUARD EVER FIRE?** Is `window.ddcsX` ever actually absent at those call sites, or is
   `initProgramModel()` always run first? **If it can never fire, every one of these is dead code asserting a
   danger that does not exist** — and the honest fix is a direct import, not a guard.
3. **IS THERE A LOAD-ORDER REASON** the `window.` bridge exists at all (a cycle, a boot sequence)? If yes, name
   it — that is the legitimate case and it changes the answer for all 9.
4. **RECOMMEND ONE RULE FOR THE WHOLE IDIOM**, not nine judgements: direct import everywhere · or guard-but-
   fail-loud · or leave it alone and only fix the known-wrong fallbacks. Say which and why.

⚠ Design only. No code, no specs.
⚠ Order after this, per your own ranking which I accept: **THE CHECKER (with the shrink-only inventory)** →
`window.` fallback → `segmentFrame.js frameOwnerAtLine` → `glowEdited` → `_firstOpTitle` → `collectOps` (its
own separate shape) → the 6 new sites.

# ═══ t1964 — 🛑 BLOCKER: one lookup, two OPPOSITE questions. Release held. ═══

t1962 accepted — and you corrected your own count (9 → 6) unprompted, traced the boot chain to prove the guard
can never fire, and traced the full import graph to prove there is no cycle. All 6 fallbacks are known-wrong
dead code; **direct import everywhere is approved.** Not this turn.

## MY GATE ON `37b27d80`: 2568 passed, 26 skipped, 15 flaky, **1 FAILED** — and it is REAL.
`blk-start-hints-multistep-1954` — **your own t1954 test, green when you wrote it.** I isolated it; it
reproduces deterministically. It fails at its *sanity* step:

```
  importMarkedNc(exported)  ->  expected 1 top-level op (the multi_step wrapper)
                                received 2 loose ops
```

## THE CAUSE — located, not guessed. `programModel.js:210`.
`serializeWithMarkers` (the .nc EXPORT) resolves each line's owning op via **`opAtLine` → `findOpInStack`** —
the function t1958 changed to **recurse-first / deepest-match-wins**. Import grouping was never touched, so it
is the EXPORT that moved: the markers now attribute lines to a different op, and the re-import therefore
reconstructs a different program.

**⭐ AND THE ROOT CAUSE IS THIS SESSION'S OWN RECURRING SHAPE — one name, two meanings:**

```
  the Edit chip needs   THE DEEPEST op    — the operation the user actually clicked
  the .nc exporter needs THE OUTERMOST op — the operation BOUNDARY a marker delimits

  findOpInStack answers ONE of those. t1958 flipped which one. Both consumers took it silently.
```

## THE TASK
1. **DO NOT simply revert.** The t1958 fix is correct for its consumer — Edit must resolve the deepest op.
   Reverting restores the padlock bug.
2. **DECLARE THE TWO QUESTIONS SEPARATELY.** They are not the same question and must stop sharing an answer.
   Name them so a reader cannot confuse them (deepest/innermost vs outermost/boundary), and give each consumer
   the one it actually needs. **Every caller of `opAtLine`/`findOpInStack` must be classified** — say which
   question each one is really asking; do not assume the two I named are the only consumers.
3. **⚠ THE USER-FACING STAKE, assert it:** an exported `.nc` must re-import to the SAME program. Bridge to
   `multi-op-import-1916`'s byte-identical claim. This is export/import fidelity — the worst thing to get
   silently wrong.
4. **PROVE BOTH SURVIVE TOGETHER:** the nested-op Edit path (t1958's own spec) AND the export round-trip
   (`blk-start-hints-multistep-1954`) green in the same run. Neither may be traded for the other.
5. **NON-VACUITY** on anything new. And say plainly whether the 15 flaky in my run overlap your area.
6. **GATE (widened, this is the export path):** `blk-start-hints-multistep-1954` + `edit-nested-op-1958` +
   `multi-op-import-1916` + the round-trip/parity set + `add-operation-1940` + `collapse-on-delete-1948` +
   `insert-add-replace-1942` + the 4 t1928 features + node tier.

⚠ **NOTHING RELEASES** until this is green. The Edit fix cannot ship while it corrupts export round-tripping.
⚠ Then, in order: THE CHECKER (shrink-only inventory) → the 6 dead guards → `segmentFrame` → `glowEdited` →
`_firstOpTitle` → `collectOps` → the 6 new sites.

# ═══ t1966 — PROVE THE ONE ASSUMPTION THE BLOCKER FIX RESTS ON (read-only) ═══

t1964 accepted pending my gate (running now). **You falsified my diagnosis before building on it — third time
this session, and right every time.** I said "Edit wants deepest, export wants outermost, two questions." You
TESTED it: exporting an already-wrapped stack with the deepest-match code produces correct per-op markers, so
**export wants deepest too**. One answer for all three callers, not two. My framing would have had you build a
split that nothing needed.

The real cause is narrower and far more interesting: homing's builder nests an internal `{type:'op',
opType:'homing'}` fragment inside its `user_root`, deliberately **id-less** — and a Blockly round-trip assigns
a real id to every block it renders, so t1958's `deepest + id != null` rule started matching that fragment the
moment a program passed through the Blocks tab. **The id-null guard was right in intent but depended on an
invariant Blockly can silently break.** Treating `user_root` as opaque doesn't depend on ids at all. That is a
declared boundary replacing a fragile guard, which is the better fix and not the one I asked for.

## THE TASK — read-only. My gate is RUNNING: no code, no specs, no suite run.
The fix rests on ONE semantic claim, stated in its own comment:

> *"NOTHING inside one op's own authoring body can ever be a DIFFERENT, independently-addressable op."*

If that is false anywhere, the boundary hides a real op and `opAtLine` silently returns the wrong owner — the
same class of silent-wrong-answer we have now hit three times. **Prove it or break it.**

1. **CAN A `user_root` BODY CONTAIN A GENUINELY ADDRESSABLE OP?** Not "does it today" — **can the authoring
   path produce one?** Check what the wizard-maker / custom-op authoring surface allows a user to drop into a
   twin's body. A user composing an op out of an existing op is the case that would break it.
2. **ENUMERATE what actually sits inside `user_root` bodies today** across the shipped twins — is homing's
   nested fragment the only `type:'op'` in any of them? Method as well as count, as you have been doing.
3. **IF IT CAN BREAK:** say what the user would see (a wrong marker? a wrong Edit target? a wrong export?) and
   what the boundary should be instead — do not build it.
4. **IF IT CANNOT:** say so plainly and name what enforces it. **If nothing enforces it, that is the finding** —
   an invariant with no enforcement is exactly the one that just cost us a release (the id-null guard).
   A cheap assertion that makes it enforced is worth proposing.

⚠ Design only. Then in order: THE CHECKER (shrink-only inventory) → the 6 dead guards → `segmentFrame` →
`glowEdited` → `_firstOpTitle` → `collectOps` → the 6 new sites.

# ═══ t1968 — BUILD THE CHECKER (shrink-only inventory) ═══

**RELEASED V2026.08.16.1** (`06169918`, pushed). Gate: full suite on `7928a139` — 2560 passed, 26 skipped,
22 flaky, 3 failed, all three `probe-input-select-revival-1888` isolated **5/5 green twice, independently**.
Node tier re-run on the release commit: 118/118. (An earlier run of the same tree returned 1918 unexpected in
1.4h — discarded as a starved run after confirming app boot and a real spec green. Not evidence, not reported
as findings.)

t1966 accepted, and **you broke the assumption instead of confirming it — which is what I asked for and the
harder thing to do.** You connected a placed Corner op into a `user_root`'s execution mouth via Blockly's real
`connect()` (the same compatibility check a mouse drag uses), got zero rejection because that input carries no
`check:`, and read it back through the app's own reader — preserved, unsanitised. Then you ruled OUT the
palette path first (`builderOf()` returns a bare `user_root`, so dragging from the palette is safe) so the
finding names the *actual* hazard rather than a category. And you swept all 32 registered ops to establish the
gap is **latent, not live**. The free finding — `_framed()`'s progstart/progend lift only inspecting the outer
`user_root`'s direct children — is logged and unchased, correctly.

**Your `USER_OP_PREFIX` proposal is APPROVED in principle** (reuse an already-declared convention rather than
blanket opacity), and so is the `validateUserOp` save-time assertion. **Both queued behind this task** — the
gap is latent and the checker is what stops the class growing while we work through it.

## THE TASK — build the checker. Your own ranking, which I accepted.
Ship it as a **RATCHET**, per my ruling: an explicit inventory of the currently-open sites; **FAIL on anything
not in the inventory; FAIL if the inventory GROWS.** Never allow-list a bug to green, never leave a permanent
red that blinds my release gate.

1. **THE SHAPE** you defined in t1960: a shallow `type === 'op'`-or-bare-id find/filter/loop over a
   `getStack()`-traced array with no `.children` anywhere in the enclosing function (brace-sliced, not
   per-callback), excluding the already-fixed guarded-fallback idiom.
2. **NODE TIER**, own file, beside `architecture-map-1698`. Sub-second. It is a file read and a grep.
3. **THE INVENTORY IS THE DEBT, AND IT MUST BE READABLE**: each entry `file:line` + one line of what breaks for
   the user. A future reader must be able to pick one off without re-deriving it. **Include a COUNT** so the
   ratchet is obvious at a glance.
4. **⚠ PROVE BOTH DIRECTIONS:** add a fake new violation → it FAILS. Remove an inventory entry without fixing
   the site → it FAILS. **A ratchet that only ratchets one way is half a ratchet**, and the loose direction is
   the one that rots.
5. **REPORT THE FALSE-POSITIVE RATE HONESTLY.** If it fires on innocent code you cannot cleanly exclude, say so
   — a noisy checker gets suppressed and becomes decoration, which is the failure this project keeps deleting.

⚠ Gate: your new node test + node tier + the round-trip/parity set. NOT the full suite; that stays mine.
⚠ Then, in order: the 6 dead guards → `USER_OP_PREFIX` boundary + `validateUserOp` assertion → `segmentFrame`
→ `glowEdited` → `_firstOpTitle` → `collectOps` → the 6 new sites.

# ═══ t1970 — DELETE THE 6 DEAD GUARDS (direct import) ═══

t1968 accepted, verified by me: `npm run test:node` → **126/126** (was 118), and I read the three assertions
that matter myself — the inventory matches the real tree, a new violation FAILS, and dropping an entry without
fixing the site FAILS. Both ratchet directions, proven against the REAL scan rather than a mock.

**Three things in that turn are the reason it worked:**
- **You calibrated against ground truth BEFORE writing the inventory**, and it caught **four of your own bugs**
  while tuning — the naive `.children` rule, the `flattenOps(` word-boundary miss, a 38KB function colliding
  two unrelated matches, and a doc comment being read as a call. A checker written from reasoning would have
  shipped with all four and been trusted anyway.
- **You keyed the inventory by `{file, function}`, not line** — applying the ARCHITECTURE.md citation-drift
  lesson from a different part of this session, unprompted. That is the difference between a fix and a lesson.
- **You named the remaining blind spot** (a program stack arriving as a PARAMETER rather than a direct
  `getStack()` call — zero cost today, all 10 sites call directly) instead of letting the file read as complete.

**And it found an 11th site while being built:** `macrosApp.js openCamAuthoring` silently skips everything
nested in a `multi_step` when auto-importing CAM-able ops. The checker earned its keep in the turn it was
written.

**Housekeeping done, not yours:** I reaped the ~11hr-old orphaned playwright test-server (PID 67592) you
flagged — confirmed dead, no others. It predates this session and may well be what starved the 1.4h/1918-red
run I discarded.

## THE TASK — delete the 6 dead guards. You already proved every premise for this.
`window.ddcsX ? window.ddcsX(...) : <shallow fallback>` at `opSession.js:552,560`, `envelopeCheck.js:184`,
`wizardManager.js:410,495,525`. You established: all 6 fallbacks are **known-wrong** (4 byte-for-byte the
pre-fix bugs), the guard **can never fire** (traced the boot chain), and there is **no import cycle** (traced
the graph; `opBuilders.js` is the declared leaf). `opGlow.js` already proves the direct-import path.

1. **DIRECT IMPORT at all 6.** Delete every fallback branch — no guard, no `window.` bridge at these sites.
2. **KEEP the `window.ddcs*` assignments** in `initProgramModel` (they are the app's own debug/bridge surface
   and other things may read them) — this is about the CALL SITES, not the bridge. If you find the bridge
   itself is now unreferenced, say so; do not delete it on your own initiative.
3. **⚠ STOP CONDITION:** if any of the 6 turns out to be reached during construction after all — i.e. the
   guard CAN fire — stop and tell me. That would falsify t1962's boot-chain trace and it is worth more than
   this cleanup.
4. **THE CHECKER MUST STILL PASS**, and its guarded-fallback exclusion may now be dead. **If removing these 6
   makes that exclusion unreachable, DELETE the exclusion too** — an exclusion for a pattern that no longer
   exists is the checker lying about what it protects against.
5. **Gate:** node tier (incl. the new checker) + `edit-nested-op-1958` + `export-import-fidelity-1964` +
   `blk-start-hints-multistep-1954` + the round-trip/parity set + the 4 t1928 features.

⚠ Then: `USER_OP_PREFIX` boundary + `validateUserOp` assertion → `segmentFrame` → `glowEdited` →
`_firstOpTitle` → `collectOps` → the remaining new sites (now 11 in the inventory).

# ═══ t1972 — ENFORCE THE user_root INVARIANT (USER_OP_PREFIX boundary + validateUserOp) ═══

t1970 accepted, verified by me: node tier **125/125**, and I confirmed by grep that the three `window.ddcs*`
bridges now have **zero call sites** — declarations only, exactly as instructed.

**Two things worth naming:**
- **You upgraded the STOP condition's answer instead of just satisfying it.** I asked "did the guard ever
  fire?"; you answered that a static import resolves before any application code runs, so **the timing question
  no longer exists** rather than merely evaluating false today. A structural answer beats an empirical one.
- **You deleted the checker's guarded-fallback exclusion** — constant, use, and its synthetic proof-test — once
  it became unreachable, per rule #4. Removing a test is the right move when what it guards is gone; keeping it
  would have made the checker claim protection it no longer provides.

**And you refused a tempting cleanup for the right reason:** four other `wizardManager.js` prose citations were
already stale *before* your edits (`this.open()` sits at 413 even on the pre-t1970 tree, 7 off from the map's
claim), so you named them rather than compound a guess on a wrong baseline. **That is itself a finding:** those
citations are PROSE-ONLY — nothing in the gate enforces them. The map is enforced in one half and decorative in
the other, which is the state this session keeps deleting. Folded into the approved Option B work, not lost.

## THE TASK — make the invariant real. It is currently a habit, not a rule.
t1966 proved a placed op can be dragged into a `user_root`'s execution mouth (Blockly's own `connect()`
accepts it, no `check:`), and that nothing sanitises it on read-back. `findOpInStack` treats `user_root` as
blanket-opaque, so such an op gets **no Edit chip and its export marker is silently dropped**. Latent today —
homing's fragment is the only nested `type:'op'` across all 32 registered ops — but unenforced.

1. **THE BOUNDARY, your own design:** don't descend into a `user_root`'s plain atoms, **but a nested
   `type:'op'` IS a real match when its `opType` is `user_`-prefixed** (`USER_OP_PREFIX`, already declared in
   `userOps.js` and already enforced by `validateUserOp` for top-level opType). Homing's fragment is not
   `user_`-prefixed, so it stays excluded — the t1964 regression cannot return. **Reuse the declared constant;
   do not re-spell the prefix.**
2. **THE ENFORCEMENT, your own proposal:** `validateUserOp` walks `def.template` and flags any `type:'op'`
   below the top level whose `opType` is not `user_`-prefixed-and-registered. **Catch it at save time**, where
   the user can still act on it.
3. **⚠ ASSERT THE USER-VISIBLE CONSEQUENCE, both halves:** a `user_`-prefixed op nested in a body DOES get its
   Edit chip and DOES keep its export marker through a round-trip (bridge to `export-import-fidelity-1964`);
   and homing's own fragment still does NOT resolve (the t1964 regression guard must stay green).
4. **PROVE NON-VACUITY** on both — you have done this every turn.
5. **Gate:** node tier (incl. the checker) + `export-import-fidelity-1964` + `blk-start-hints-multistep-1954` +
   `edit-nested-op-1958` + the round-trip/parity set + the 4 t1928 features.

⚠ **STOP CONDITION:** if making nested `user_` ops addressable changes ANY existing export byte, stop and tell
me. Today's shipped programs must be unaffected.
⚠ Then: `segmentFrame` → `glowEdited` → `_firstOpTitle` → `collectOps` → the rest of the 10-entry inventory →
architecture-citation Option B (now including the unenforced prose half).

# ═══ t1974 — segmentFrame.frameOwnerAtLine: the comment lies, the sim flip never fires ═══

t1972 accepted, verified by me: node tier **125/125 (fail 0)**, and I ran both halves myself — 3 passed. One
spec flaked in exactly the changed territory (`user_root wrapper is transparent at emit time`), so I isolated
it rather than accept the retry: **green on its own.** Not masking anything.

**The turn's best moment was a bug you did NOT ship.** You ran the naive `validateUserOp` rule against the real
tree first — standing discipline in this session — and it **threw on homing's own registration at every boot.**
A validator that bricks startup is about the worst thing to add to a save path, and it would have looked
completely reasonable in review. Testing the rule before trusting it is what caught it.

**And the fix for it was principled rather than hand-named:** `opToolbox.js`'s palette only ever offers
`user_`-prefixed `USER_DEFS`, never a bare `BUILDERS` key, so a legacy builder opType can only reach a template
as a twin's own internal self-wrap — excluding `BUILDERS` membership is safe *by construction*, and `BUILDERS`
is a closed existing registry rather than a new list that could quietly grow. That is an exclusion that cannot
rot, which is the only kind worth having.

**Also right:** non-vacuity proven on each half **independently** (two separate reverts, 3/3 red each, rather
than one combined claim standing in for both), and the STOP condition discharged against `fork-parity-1593`'s
byte-for-byte sweep across all 32 ops — no shipped export byte moved.

## THE TASK — the next LIVE bug in the inventory. `segmentFrame.js frameOwnerAtLine`.
The sim's machine-frame flip (hide-workpiece / DRO switch) **never fires for an operation nested in a
multi-operation program** — while **its own header comment claims it handles exactly that case**, naming the
same Homing-then-Corner example. Live since t1874. The code lies about itself, which is the family we have been
deleting all session.

1. **FIX IT THROUGH THE DECLARED LOOKUP.** It is inventory entry — resolve it via the canonical enumeration
   rather than a local walk. If the canonical one genuinely does not fit, **stop and tell me** rather than
   growing a variant.
2. **⚠ MAKE THE COMMENT TRUE, or delete it.** A comment asserting a behaviour the code does not have is worse
   than no comment: it stops the next reader checking. Do not leave a corrected code path under a stale claim.
3. **ASSERT WHAT THE USER SEES:** on a real multi-operation Homing-then-Corner program, the workpiece hides
   through Homing's own lines and reappears at Corner's first line, and the DRO reads machine-frame for the
   right span. `option-b-slice3-live-visibility-1874` is the existing evidence — bridge to it.
4. **THE CHECKER'S INVENTORY MUST SHRINK BY ONE** — and its count updated. That is the ratchet doing its job
   for the first time; confirm it actually fails if you fix the site without updating the inventory.
5. **PROVE NON-VACUITY.** Gate: node tier (incl. checker) + `option-b-slice2/3` + `marker-rebuild-1848` +
   `user-root-boundary-1972` + `export-import-fidelity-1964` + the round-trip/parity set + the 4 t1928 features.

⚠ Then: `glowEdited` → `_firstOpTitle` → `collectOps` (different shape) → the rest of the inventory →
architecture-citation Option B (including the unenforced prose half).

# ═══ t1976 — editorOpHover.glowEdited, + one bounded question about overclaiming tests ═══

t1974 accepted, verified by me: **inventory 10 → 9**, node tier 125/125 fail 0, both ratchet directions green.
**The ratchet worked in anger exactly as specified** — you fixed the code, left the entry in place, watched the
checker fail with `staleEntries`, then removed it and got clean. That is the direction that rots, proven on a
real fix rather than a synthetic one.

**⭐ AND YOU FOUND THE BEST THING BY REFUSING TO TRUST A TEST'S NAME.** `option-b-slice3-live-visibility-1874`
calls itself **PRIMARY EVIDENCE** — and it loads UNWRAPPED ops, so it never exercised the wrapper bug at all.
It has been vouching for a behaviour it does not test. That is the same defect family as the lying comment you
fixed in the same turn, wearing a test's clothes: **a confident name stops the next reader checking.** You
bridged it by extending that same file with a genuinely wrapped program built through the real declared
grouping function, rather than writing a parallel claim elsewhere.

## THE TASK — `editorOpHover.js glowEdited`, next in the inventory.
The nested edit-glow never renders for an operation inside a multi-operation program.

1. **Fix via the canonical lookup**, same as `segmentFrame`. If it does not fit, stop and tell me.
2. **ASSERT THE VISIBLE RESULT:** edit a value on a nested operation and the glow appears on that operation's
   own lines — not the wrapper's, not nowhere. This one is *pixels*; if the honest assertion needs a screenshot,
   take one.
3. **INVENTORY 9 → 8**, count updated.
4. **PROVE NON-VACUITY.**

## ⚠ PLUS ONE BOUNDED QUESTION — you are already in that file family, so answer it there and stop.
You proved one `PRIMARY EVIDENCE` test didn't exercise its own claim. **Do its siblings?** Check the other
`option-b-*` PRIMARY EVIDENCE tests: do any of them build a WRAPPED program, or are they all unwrapped —
i.e. is the whole family vouching for multi-operation behaviour it never runs? **Report only; fix nothing.**
Two or three greps, then stop — I do not want this turning into a suite-wide audit.

⚠ **Gate:** node tier (incl. checker) + `option-b-slice2/3` + `marker-rebuild-1848` + the round-trip/parity set
+ the 4 t1928 features.
⚠ **RELEASE PLAN:** I am batching — `glowEdited` → `_firstOpTitle` → `collectOps`, then ONE full gate and one
release, rather than a 30-minute gate per one-line fix. Say so if any of the three looks bigger than that.

# ═══ t1978 — editorManager._firstOpTitle (3rd of the batch) ═══

t1976 accepted, verified by me: inventory **9 → 8**, node tier 125/125, ratchet green both directions again,
and **I looked at your screenshot** — the glow lands on the nested surfacing op's own lines (the highlighted
`7` tokens at 52/55/63/66), not the wrapper's. That is the assertion made visible, which numbers alone could
not have shown me.

**Your bounded answer was exactly the right size:** `option-b-slice2-positioning-1872`'s PRIMARY EVIDENCE test
is unwrapped too — grep-confirmed, same bare-array shape slice3 had before t1974. So **the whole family was
vouching for multi-operation behaviour neither test ran**, and you said plainly that whether it *matters* for
slice2 is unverified rather than guessing. Two greps, a real answer, and you stopped.

## ⚠ ONE THING I SPOTTED IN THE SCREENSHOT — check it, do not chase it.
That program is in an **error state**: line 75 emits `#1505=1 ;ERROR: stepover / stepdown must be greater than
zero`, and the header badge reads **"can't verify"**. The glow claim still holds (it is about which lines
glow). But a fixture whose program cannot verify is weaker evidence than one that can — and if the *default*
Add-gesture surfacing op emits that error, that is a separate real bug. **Say which it is:** your edit made it
invalid, or it was invalid from the defaults. One check, then move on.

## THE TASK — `editorManager.js _firstOpTitle`, next in the inventory.
An exported `.nc` is titled `multi_step` instead of naming the real operation. User-visible on every
multi-operation export.

1. **Fix via the canonical enumeration**, same shape as the last two.
2. **ASSERT THE EXPORTED FILENAME/TITLE** a user actually gets for a multi-operation program — a real name, not
   the wrapper's type. Bridge to `export-import-fidelity-1964` if the title rides the same path.
3. **INVENTORY 8 → 7**, count updated.
4. **PROVE NON-VACUITY.**
5. **Gate:** node tier (incl. checker) + `export-import-fidelity-1964` + the round-trip/parity set + the 4
   t1928 features.

⚠ Then `collectOps` (the over-deep twin — **different fix shape**, substitute-not-both), and that closes the
batch: I run ONE full gate and cut a release.
⚠ Queued after the release: **bridge `option-b-slice2-positioning-1872` to a wrapped program** the way t1974
did for slice3 — a PRIMARY EVIDENCE test that never runs the case it names is the defect we keep deleting ·
then the rest of the inventory · then architecture-citation Option B (incl. the unenforced prose half).

# ═══ t1980 — collectOps: the OVER-deep twin (closes the batch) ═══

t1978 accepted, verified by me: inventory **8 → 7**, ratchet green a third time.

**My screenshot flag was a false alarm and you settled it in one check, correctly.** The `#1505` line is a
static refuse-guard branch (jumped over by `GOTO94`, reached only if the condition trips — same shape as
drill's own zero-bite guard) and the amber badge is the generic no-WCS test-boot state. Both present on a
fresh untouched default insert. **You checked and stopped**, which is exactly the scope I asked for.

**And you did NOT bolt the test onto the file I suggested.** I proposed bridging to
`export-import-fidelity-1964`; you checked and found it only covers the G-code BODY round-trip, never
`buildProgram()`/`.name` — a genuinely different mechanism — so you bridged to `export-title-975` instead, the
title mechanism's own origin file. Taking a suggestion that does not fit is how evidence ends up in the wrong
place, and refusing it is the harder call.

**The bug was bigger than "a title":** every multi-operation export **and** every `bridgeTransfer` TRANSFER has
been filed as `multi_step.nc` since t975 — including files sent to the controller.

## THE TASK — `setupSheet.js collectOps`. LAST of the batch, and the ODD ONE OUT.
⚠ **This is NOT the shallow bug.** `collectOps` already recurses correctly; its defect is the **opposite** — it
pushes a `multi_step` wrapper AND then its children, so the printed setup sheet shows a **phantom operation
row** alongside the real ones. **Substitute, do not add:** a wrapper must be REPLACED by its children, never
counted beside them — the same rule `flattenOps` already encodes.

1. **Reuse the declared enumeration** rather than hand-writing the substitute rule a second time. If
   `collectOps` genuinely needs its own traversal (it also has to handle `setup` containers), then make it
   *delegate* the wrapper rule rather than re-spell it — and say why it could not simply call the canonical one.
2. **ASSERT WHAT PRINTS:** a setup sheet for a multi-operation program inside a `setup` container lists exactly
   the real operations with their own tools — no phantom row, no missing row. `setup-sheet-850` is the evidence
   file; extend it rather than starting a parallel claim.
3. **⚠ REACHABILITY, honestly:** t1932 traced this as REACHABLE by dragging a wrapper into a `setup` container
   but never observed it live. **Reproduce it for real this time** — if it turns out NOT to be reachable, say so
   and I will decide whether it is worth fixing at all rather than you fixing a ghost.
4. **INVENTORY 7 → 6** if it is tracked there; if `collectOps` is deliberately NOT in the inventory (different
   shape), say so and leave the count.
5. **PROVE NON-VACUITY. Gate:** node tier (incl. checker) + `setup-sheet-850` + the 4 t1928 features + the
   round-trip/parity set.

⚠ **THIS CLOSES THE BATCH.** After it: I run ONE full gate and cut the release. Then `option-b-slice2` bridged
to a wrapped program → the rest of the inventory → architecture-citation Option B.

# ═══ t1982 — IS TWO-SIDED SETUP A DEAD FEATURE? (read-only) ═══

t1980 accepted — **and "no fix" was the right answer.** You reproduced the reachability question LIVE instead
of inferring it, and found the case cannot occur: no UI creates a `setup` block, the `.nc` marker path never
emits or restores one, and — the decisive part — **a `setup` with ANY children throws the moment the Blocks tab
renders it** (`recToJson: block setup (kind setup) carries 1 children but its def declares no mouth`). That is
much stronger than "unobserved": the surface the hazard needs is actively broken first. You did not fix a
ghost, and you confirmed `collectOps` was deliberately never in the inventory (it is cited as a correctly-
EXCLUDED genuine recursive walker) so the count correctly stays at 7.

## ⚠ YOUR FINDING #2 IS BIGGER THAN THE THING IT WAS CHECKING.
I verified your lead myself. `setupBlock` (`transform.js:40`) is **registered in the palette** — it sits in
`ops/index.js:119`'s block list, `category: 'Transforms'`, beside `arrayBlock`/`fillZigzagBlock` **which all
declare `mouth: 'DO'` and it declares none.** Meanwhile the machinery that consumes it is fully built:
`blockEmitter.js:625` applies the per-setup FLIP at emit, and `setupSheet.js` builds per-setup pages with flip
instructions. So the two-sided workflow is **declared, wired at emit, wired in the printed sheet, and offered
in the palette — while being structurally impossible to use.** A palette entry promising a capability the block
cannot perform is the lying-codebase family at feature scale.

**This matters to the human specifically: two-sided machining (flip the part, cut the back) is a real shop
workflow, and they are the machinist.** So this is a product question, not just a defect.

## THE TASK — read-only. My full gate is RUNNING: no code, no specs, no suite run.
1. **CAN A USER PLACE ONE TODAY?** Confirm whether `setupBlock` actually renders in the Blockly toolbox (I
   traced the registry, not the rendered palette). If it renders, what happens when a user drags it out —
   does it look like a container that just refuses ops, or does it fail some other way?
2. **WHAT WOULD MAKE IT WORK?** Is it genuinely a missing `mouth` declaration, or is `mouth` only the first of
   several gaps? **Cost it honestly** — one word, or a feature's worth of work. Do not build it.
3. **HOW MUCH OF THE FEATURE IS REAL?** The emit-side flip and the setup-sheet pages appear complete. Are they
   *tested*? If specs exist, what do they construct — hand-built stacks that bypass the broken path (the
   `PRIMARY EVIDENCE` shape again), or something a user could actually produce?
4. **WAS IT PARKED DELIBERATELY?** Check `WORK-LOG`/`ROADMAP` for t879. A feature parked on purpose is not a
   bug — say so if that is what the record shows.
5. **⚠ DO NOT BUILD, DO NOT ADD THE MOUTH.** The human decides whether two-sided setup is wanted. I want the
   cost and the honest state, so they can rule on it.

⚠ After my gate + release: `option-b-slice2` bridged to a wrapped program → the rest of the 7-entry inventory
→ architecture-citation Option B (incl. the unenforced prose half) → whatever the human rules here.

# ═══ t1984 — WHICH FEATURE SPECS NEVER DRIVE THE REAL PATH? (read-only, bounded) ═══

t1982 accepted. **Sharper than my own framing:** `setupBlock` does not "render as a container that refuses
ops" — it renders as a **flat 209×40 pill**, no C-notch at all, indistinguishable from `xform`/`entry`. And you
found a **second gap behind the first**: `mouth:'DO'` alone fixes drop-and-read-back (the generic machinery
already handles any mouth-declaring kind), but `workspaceToStack` only inspects top-level blocks and
`regroupOps` only ever runs on that array — so two ops dropped into one setup would read back as loose
children, never auto-wrapping. **Cheap line for basic drop-in; a real design ruling on top.** Costing the
*second* gap is what stops "it's one word" becoming a half-shipped feature.

## ⭐ THE PATTERN YOU HAVE NOW CONFIRMED THREE TIMES IS THE REAL FINDING.
`two-sided-879` (5/5), `two-sided-881` (4/4) — both build every setup group from hand-written JSON through
`ddcsLoadBlockStack`, **zero `showApp`/`__blkws`**. Same as `option-b-slice2` and `option-b-slice3`. So:

```
  a feature's BACK half is real, tested, green
  its FRONT half (the user-reachable path) is broken or absent
  the tests construct the state programmatically -> they never touch the broken half
  -> the suite reports a working feature that no user can reach
```

That is how a whole workflow stayed dead in the palette with green tests over it. **Three instances in one
session means it is a class, not bad luck.**

## THE TASK — read-only, BOUNDED. My gate is RUNNING: no code, no specs, no suite run.
1. **COUNT THE CLASS.** Which `tests/*.spec.js` files assert a FEATURE's behaviour while constructing their
   program **only** via `ddcsLoadBlockStack` / hand-built records — never `openWiz`/`insertWiz`/`showApp`/
   `__blkws` / a real gesture? Method as well as count, as always.
2. **⚠ SEPARATE THE INNOCENT.** A unit-ish spec testing an emitter or a pure function SHOULD construct
   programmatically — that is correct, not a defect. The defect is only where the spec's own claim is about a
   **user-reachable feature**. Say how you drew the line; a count that lumps both is useless.
3. **RANK BY EXPOSURE:** which of them guard a feature whose user-reachable path might ALSO be broken right now
   — i.e. where else could a dead front half be hiding behind a green back half? **Name suspects; verify
   nothing.** That is the next hunt, not this one.
4. **IS IT CHECKABLE?** Could this be a ratchet like `op-lookup-scan-1968` — feature specs must touch a real
   gesture — or is the innocent/guilty line too blurry to mechanise? **Say if it is not worth it**; your
   negatives have been right every time.

⚠ Report only. Do not fix, do not rewrite a spec, do not add the mouth.
⚠ **The human has NOT yet ruled on two-sided setup.** Do not build any of it.

# ═══ t1986 — WHICH COMPOSITE SHAPES HAVE NO CREATION DOOR? (read-only) ═══

t1984 accepted. **The class is CLOSED at 4** — 809 spec files, 115 hits narrowed to 29, all 29 read
individually, and only the four already known are guilty. That negative is worth more than a longer list: it
says there is no hidden mass, so we stop hunting here. The 25 innocents resolved into three *named* legitimate
shapes (self-declared algorithm/foundation tests, the declared reconciler-invariant pattern that calls the same
function a real Insert does, and incidental seeding — `blocks-roundtrip-toast`'s hit was literally
`ddcsLoadBlockStack([])`, an empty-canvas clear). **Matching the call and not its argument** is exactly the
bluntness a careless sweep would have reported as a finding.

**Your NO on the ratchet is accepted, on your reasoning:** classification needs English prose plus per-feature
knowledge of whether a real door exists, so a hard gate would either block the legitimate reconciler pattern
constantly or invite a one-line disclaimer escape hatch that decays exactly like a stale inventory entry.
**Cheap standing report, not a gate.** You have been right on every negative this session and I am not
overruling this one.

**And the reframe is better than my question was:** the issue is not "more specs like this" — it is
**"which composite structures have no real creation door?"** That is the generalised form of this whole
session: we shipped Add, then found Edit dead on the very shape Add creates.

## THE TASK — read-only. My gate is RUNNING: no code, no specs, no suite run.
Take your own three candidates and settle each: **is there a real, user-reachable way to CREATE this shape,
and do its consumers work on it?**

1. **A `group` nested inside a `group`.** Can a user make one (the right-click Group gesture on a run that
   already contains a group)? If yes — do Edit / the glow / the setup sheet / export markers handle it?
2. **A `multi_step` nested inside a `user_root`.** t1972 made nested `user_`-prefixed ops addressable — can a
   user actually produce this shape, or is it only reachable by the `connect()` route you proved in t1966?
3. **2+ ops in one `setup`** — contingent on the human's ruling, so **note the state and move on**; do not
   design it.

**For each: CREATION DOOR yes/no · CONSUMERS ok/broken/unknown · what the user would see if broken.**

4. **⚠ THE METHOD IS THE DELIVERABLE.** Name the cheap repeatable way to ask "does this shape have a door?" for
   a shape we have not thought of yet. If the honest answer is "you have to know the feature", say that — I
   would rather have a true limit than a procedure that pretends.

⚠ Report only. Nothing built. **The human has still NOT ruled on two-sided setup.**

# ═══ t1988 — GROUP-IN-GROUP GLOW (the new finding from your own hunt) ═══

**RELEASED V2026.08.16.2** (`7cb3ae7c`, pushed). Gate: full suite **2571 passed, 26 skipped, ZERO failures**,
node 125/125 — run at `--workers=3`. **The config's `workers: 6` was measured when this box had its RAM free;
with ~11GB free (30 Chrome processes hold the rest) six browsers starve into mass timeouts.** Three runs of
this same tree reported 1918 / 2382 / 79 "failures" — all of it contention, all discarded, no code changed in
response. Worth knowing for your own runs: **if you see mass reds, check free RAM before believing them.**

t1986 accepted. You settled both suspects **live** rather than by inference, and the honest limit you stated on
your own method — connectivity-checking settles a NAMED candidate in ~10s but cannot DISCOVER an unnamed one,
that still takes someone wondering about the data model's shape — is worth more than a procedure that pretends
to generalise. **And the systemic fact you surfaced reframes the whole hunt: no statement mouth in this
codebase declares a `check` constraint** (I verified — the only `check:` uses are on value inputs). So every
composite shape is drag-reachable. The question was never "can a user make this?" — it is always yes.

## THE TASK — the genuinely new bug from that hunt.
A `group` nested inside a `group` (drag-reachable, you confirmed live): a real field edit on the inner group's
own atom **records correctly** (`isOpBlockEdited(innerId) === true`) but **never lights the glow**, because
`glowEdited` iterates `flattenOps()`, which by design does NOT descend into a non-`multi_step` op's children.

1. **⚠ THE DESIGN TENSION IS THE POINT — do not just add a special case.** `flattenOps` deliberately treats a
   `multi_step` wrapper as transparent and every other op as opaque. That is *correct* for "which operations
   does this program hold" (a group IS one operation). The glow is asking a **different question**: "which
   op-record owns this edit?" **Name the two questions apart** rather than widening `flattenOps` and breaking
   the setup sheet / time split, which legitimately want a group counted once.
   **If widening `flattenOps` is genuinely right, argue it — but the setup-sheet and time-estimate consumers
   must be checked, not assumed.**
2. **ASSERT WHAT THE USER SEES:** edit a value on an atom inside a nested group → the glow appears on that
   atom's own lines. Screenshot it; this one is pixels, like t1976.
3. **⚠ ALSO FIX / WIDEN the `setGroupChildParams` entry's own "why" text** — you found nesting-in-group is a
   SECOND path to that already-tracked shallow lookup. The inventory entry should say so.
4. **PROVE NON-VACUITY. Gate:** node tier (incl. checker) + `word-glow` + `setup-sheet-850` + `time-estimate-844`
   + the round-trip/parity set + the 4 t1928 features.

⚠ **MY GATE IS NOT RUNNING — the machine is yours. Browser work is fine this turn.**
⚠ Still awaiting the human on two-sided setup. Then: `option-b-slice2` bridged to a wrapped program → the rest
of the 7-entry inventory → architecture-citation Option B.

# ═══ t1990 — BRIDGE option-b-slice2 TO A WRAPPED PROGRAM (close the last overclaiming test) ═══

t1988 accepted, verified by me: node tier green, inventory holds at 7, and **I looked at your screenshot** —
line 3's edited `9` glows, lines 1–2 clean. Exactly the claim.

**⭐ You held the design tension instead of taking the easy fix, and that is the whole point of that dispatch.**
You checked `setupSheet.js` and `timeEstimate.js` FIRST and confirmed both genuinely want a group counted once
— a widened `flattenOps` would have double-listed a nested group on the printed sheet and split its time twice.
Neither file touched, byte-for-byte unchanged. **And the fix you chose is a strict SUPERSET, not a second
case:** sweeping rendered lines through the canonical `ddcsOpAtLine` and collecting distinct owners means the
glow now handles `multi_step`, group-in-group, *and any future nesting `opAtLine` already resolves* — so that
loop stops needing an edit every time a new container shape is invented. That is the difference between fixing
a bug and closing a class.

## THE TASK — the last of the four overclaiming tests.
`option-b-slice2-positioning-1872`'s PRIMARY EVIDENCE test builds an UNWRAPPED program (bare array →
`ddcsLoadBlockStack`), so it has never exercised the multi-operation case it is named for. t1974 already did
exactly this repair for slice3 — **follow that precedent rather than inventing a second approach.**

1. **Bridge it to a genuinely WRAPPED program** built through the real declared path (the same
   `groupConsecutiveOps` / real-Add construction t1974 used), reusing the file's own helpers.
2. **⚠ KEEP THE EXISTING UNWRAPPED TEST.** Both shapes are legitimate programs and both should be asserted —
   this is an ADDITION, not a replacement. Do not trade one coverage gap for another.
3. **REPORT WHETHER IT WAS ALREADY PASSING.** You flagged in t1984 that `blk-start-hints-multistep-1954` may
   already cover slice2's dependency. **If the wrapped case passes first time, say so plainly** — that is a
   real result (the claim was true, the evidence was just absent) and I would rather hear it than have a green
   test quietly recorded as a fix.
4. **PROVE NON-VACUITY** if it does fail. **Gate:** node tier + `option-b-slice2/3` + `marker-rebuild-1848` +
   `blk-start-hints-multistep-1954` + the round-trip/parity set.

⚠ The machine is yours — my gate is not running.
⚠ Then: the remaining 7-entry inventory → architecture-citation Option B (with the mandatory uniqueness
assertion, incl. the unenforced prose half). Two-sided setup still awaits the human.

# ═══ t1992 — THE FIVE opSession.js SITES (one file, one pattern) ═══

t1990 accepted. **And you said the thing I asked you to say:** the wrapped test **passed first try**, you re-ran
it 3× isolated to be sure, and **no product code was touched.** That confirms the t1984 speculation —
`blkStartHints` routing through `flattenOps` had already made slice2's per-pass tagging multi_step-aware, so
the claim in the test's name was true all along and only the evidence was missing. **Reporting "already
correct" instead of filing a green test as a fix is exactly the honesty this whole session has been about.**
Your non-vacuity reasoning for that case was right too: there is nothing to revert, so the standard does not
apply — the 3× isolated repeat plus the sanity-shape assertion (a REAL `multi_step` wrapper, not silently
unwrapped) is what separates signal from rubber-stamp. **All four overclaiming tests are now closed.**

## THE TASK — five of the seven remaining inventory sites live in ONE file.
`opSession.js`: `deleteOp` · `duplicateOp` · `setGroupChildParams` · `replayReconcile` · `mergeOpBlocks`.
Five entries, one file, almost certainly **one repeated shallow-lookup pattern**. Fix it as ONE thing, through
`findOpById` / `replaceOpById` — the declared pair that already exists. **If you find yourself writing the same
resolve five times, stop and declare it once**, exactly as `flattenOps` was.

**⚠ SEVERITY ORDER — `mergeOpBlocks` IS THE WORST BUG LEFT IN THE INVENTORY.** Its own entry says it *"silently
no-ops for a nested op, discarding the user's hand edits with no error."* **That is data loss, silent, on work
the user typed by hand.** Do that one first and do it most carefully; if the turn has to be cut short, that is
the one that must land complete.

Then `deleteOp` / `duplicateOp` — right-click Delete and Duplicate **silently do nothing** on a nested
operation. Same shape as the Edit bug already shipped, and **the Add feature made all of these reachable in
ordinary use**: before Add, only an import produced a wrapper.

1. **ASSERT WHAT THE USER DOES, per site** — right-click Delete on a nested operation removes *that* one and
   leaves its siblings; Duplicate produces a real second copy; a hand-edited nested op's edits **survive** a
   merge. Drive real gestures; a unit call on the resolver would pass while the menu item stayed dead (that is
   precisely how `openForEdit` hid).
2. **INVENTORY 7 → 2**, count updated. The ratchet must fail if you fix a site without updating it.
3. **PROVE NON-VACUITY** per site, not once for the file.
4. **⚠ IF THIS IS TOO BIG FOR ONE TURN, LAND EACH SITE COMPLETELY AND PARK THE REST** — say which you parked.
   Five half-fixes is worse than two finished ones, and I would rather review two solid than five hurried.
5. **Gate (widened — `opSession.js` is core):** node tier (incl. checker) + `edit-nested-op-1958` +
   `word-glow` + `group-edit` + `insert-add-replace-1942` + `add-operation-1940` + `collapse-on-delete-1948` +
   the round-trip/parity set + the 4 t1928 features.

⚠ **STOP CONDITION:** if fixing any of these changes single-operation behaviour, stop and tell me.
⚠ The machine is yours. Then: `opContextMenu.showOpMenu` · `macrosApp.openCamAuthoring` · citation Option B.

# ═══ t1994 — THE LAST TWO INVENTORY SITES ═══

t1992 accepted, verified by me: **inventory 7 → 2**, node tier `fail 0`, ratchet green both directions, and the
toolkit is one declared set of four (`findOpById` / `replaceOpById` / `removeOpById` / `insertOpAfterId`) with
all five sites routed through it rather than five hand-rolled resolves.

**⭐ THE BEST THING YOU DID WAS CATCH YOUR OWN WEAK TEST BEFORE SHIPPING IT.** Your first `mergeOpBlocks`
non-vacuity check used a G-code substring search — and it **passed against the broken code**, because the
wizard's own automatic Replace-fallback still applied the form's new value when the merge silently failed. A
test that goes green whether or not the fix works, on the *data-loss* bug, would have been the worst possible
thing to ship: a confident guarantee over the exact defect. You traced why, rewrote it to track the edited
atom's own id via `getSurroundParent()` (a `math_number` shadow has no record identity; the owning atom does),
and re-ran: 3/3 red. **That is the discipline working on itself.**

**Also right:** `replayReconcile` has ZERO live UI callers, so you verified it function-level and said so —
rather than inventing a gesture that does not exist. And `setGroupChildParams`'s real UI door needs a derived
group def + generic widget form, which you judged beyond the turn's honest budget: **verified function-level
against a REALISTIC nested shape and NAMED AS PARKED, not silently substituted.** Parking loudly is what makes
your "done" believable.

## THE TASK — close the inventory.
1. **`opContextMenu.js showOpMenu`** — the right-click menu on a nested op falls back to a thinner, stale
   record (missing params/children) for its CAM-authoring actions. Route through the declared toolkit.
2. **`macrosApp.js openCamAuthoring`** — "auto-import all CAM-able program ops" **silently skips every op
   nested inside a wrapper**, so a multi-operation program's later operations never reach CAM authoring at all.
   This is the one you found while BUILDING the checker; it earns its place as the last entry.
3. **ASSERT WHAT THE USER GETS:** auto-import on a real Add-built multi-operation program brings in **every**
   operation, not just the first; the right-click menu on a nested op carries its real params.
4. **INVENTORY 2 → 0.** ⚠ **When it hits zero, say what the checker should DO with an empty inventory** — does
   it still guard (fail on any new violation, which is the whole point) or does an empty list read as
   "nothing to check"? **An empty ratchet that silently stops ratcheting is the decoration we keep deleting.**
5. **PROVE NON-VACUITY per site.** **Gate:** node tier (incl. checker) + `cam-build-mode` + `cam-multiop-edit-
   blocks-s45` + `edit-nested-op-1958` + the round-trip/parity set + the 4 t1928 features.

## Queued behind it — three things YOU surfaced, none lost:
- **`setGroupChildParams`'s real-UI test** (parked above) — the fuller pass you named.
- **`RECONCILERS.surfacing` is stale** against its own current `surfaceraster` emit shape (`surfacingWizard.js`'s
  t1359 guard confirms the old stepdown shape it checks for is test-only dead code today). Found while looking
  at something else; flagged, untouched.
- architecture-citation **Option B** (symbol/substring anchors + the **mandatory uniqueness assertion**, incl.
  the unenforced prose half).

# ═══ t1996 — ARCHITECTURE-CITATION OPTION B (node-tier only; safe beside my gate) ═══

**THE INVENTORY IS EMPTY.** t1994 accepted, verified by me: `the inventory (0 open sites) matches the real tree
exactly`, ratchet green both directions, node tier `fail 0`. The class opened at t1954 — code that asked "which
operations does this program hold" and answered only for the top level — is **closed**, 11 sites plus 6 found
by the checker itself.

**⭐ YOU CAUGHT A SECOND WEAK TEST IN THE SAME TURN.** Your `showOpMenu` non-vacuity check only asserted the
modal's field table was non-empty — and it **passed against the broken code**, because each field's DECLARED
DEFAULT fills in when real params are missing (`seedFromOp` cannot tell a real value from a fallback). You
seeded a distinctive non-default (137 against a declared 100) and got 3/3 red. **Two self-caught vacuous tests
in two consecutive turns** — both of which would have shipped as guarantees over the exact defect they missed.

**And you answered the empty-inventory question by VERIFYING, not reasoning:** `diffInventory` is a plain
symmetric set difference never conditioned on length, so at `[]` it gets **stricter**, not weaker — then you
*ran it at the genuinely empty state* to prove it. **Then you found the real fragility that question was
pointing at:** `ratchet direction 2` sliced `INVENTORY[0]`, which **throws at length zero** — the mechanism's
own test would have broken at the exact moment the debt was paid off. Rewritten to a synthetic pair,
independent of the real array's size. That is the second-order catch; the ratchet now survives its own success.

## THE TASK — Option B, approved back at t1952. **Node tier only: NO browser, NO Playwright.**
**My release gate IS RUNNING** — this task is safe beside it *because* it never launches a browser. **If any
part of it turns out to need one, park that part and say so; do not run it.**

1. **Re-anchor all 52 asserted citations** from `{file,line}` to `{file, distinctive substring}` — your own
   measured recommendation, chosen because symbol-anchoring would NOT have caught either of this session's real
   drifts (both moved *inside* their own anchor function's doc comment).
2. **⚠ THE UNIQUENESS ASSERTION IS MANDATORY** — your own caveat, and the reason the option is approved: the
   checker must **fail loud on 0 matches AND on 2+ matches.** Dropping the line number without it makes the
   checker WEAKER while feeling like an improvement. You measured 8 of 10 sampled patterns as non-unique, so
   expect real find-tightening work, not a mechanical swap.
3. **⚠ THE PROSE HALF IS UNENFORCED — that is the other half of this task.** t1970 found four
   `wizardManager.js` prose citations already stale *before* that turn's edits (`this.open()` at 413 vs the
   map's claim). Nothing in the gate checks prose. **Either bring prose citations under the same checker, or
   state plainly that prose stays unenforced and why** — a map enforced in one half and decorative in the other
   is the state this session keeps deleting.
4. **PROVE IT CATCHES DRIFT:** move a cited function within its file → the checker still finds it. Delete the
   cited content → it FAILS. Make the pattern match twice → it FAILS.
5. **Gate: node tier only.** Report the count re-anchored and any citation you could not make unique.

⚠ Also queued, both yours: `setGroupChildParams`'s real-UI test · `RECONCILERS.surfacing` stale against its own
current `surfaceraster` emit shape.

# ═══ t1998 — RECONCILERS.surfacing: is it stale, and does it matter? (node-tier only) ═══

t1996 accepted. 52/52 citations re-anchored to verified-unique substrings, **0 that could not be made unique**,
and the drift proof done properly — move a cited line 200 lines away → still found; delete it → 0 matches;
duplicate it → 2 matches — all against a **scratch copy**, never the real file.

**⭐ AND YOU FOUND A LIE INSIDE THE CHECKER ITSELF.** INV8 cited `userOps.js:746` — **the wrong function
entirely** — and was "protected" by a `find:/./` placeholder that matches anything and therefore **checked
nothing**. A citation that could never fail, sitting inside the mechanism whose whole job is to make citations
fail when they rot. You fixed the anchor *and* the same wrong line in the prose. That is the third
never-could-fail check you have caught in three turns, and this one was in the guard rather than the guarded.

**And the prose half you stated rather than fudged:** 149 citations total, 52 now enforced, **~97 unenforced** —
sized comparably to that whole turn again, so not attempted, with the boundary named (a citation earns a check
by graduating into a named TRAP/INVARIANT). A true limit beats a partial sweep presented as complete.

**Good hygiene, noted:** you spotted two `verification/*.png` modified by MY concurrent gate and left them
unstaged rather than absorbing someone else's side effects into your commit.

## THE TASK — node tier only. **My release gate is STILL RUNNING: no browser, no Playwright.**
You found this while looking at something else in t1992: **`RECONCILERS.surfacing` is stale against its own
current `surfaceraster` emit shape** — `surfacingWizard.js`'s own t1359 guard confirms the old stepdown shape
it still checks for is **test-only dead code today**.

1. **IS IT ACTUALLY STALE?** Confirm against the current emit rather than the comment. Name the shape it
   expects and the shape that is emitted now.
2. **⚠ WHAT BREAKS FOR THE USER — or does nothing?** A reconciler that no longer matches may (a) silently
   fail to reconcile a real hand-edit, (b) reconcile it wrongly, or (c) be entirely unreachable dead code. **The
   three have very different severities and I do not want them conflated.** If it is unreachable, say so — that
   is the "delete it" answer, not the "fix it" answer.
3. **IS THE TEST-ONLY DEAD CODE LOAD-BEARING FOR A TEST?** If a spec only passes because it feeds the old
   shape, that spec is asserting a shape the app no longer produces — the `PRIMARY EVIDENCE` family again.
4. **RECOMMEND: fix, delete, or leave — with the reason.** Do not build it.
5. **If answering honestly needs a browser, PARK IT and say so.** Node tier only this turn.

⚠ Then: `setGroupChildParams`'s real-UI test (needs a browser — after my gate) · two-sided setup awaits the
human · and I release as soon as the gate lands.

# ═══ t2000 — FIX RECONCILERS.surfacing (live, silent, invisible) ═══

**RELEASED V2026.08.16.3** (`72a12b57`, pushed). Gate: **2581 passed, 26 skipped, ZERO failures**, node
125/125, at `--workers=3`.

t1998 accepted — **and keeping the three severities apart is exactly what made it actionable.** You separated
`reconcileActiveOp → pullFromBlocks` (LIVE, wired to the Studio tab switch, silently drops a real hand edit)
from `replayReconcile` (zero live callers, therefore inert) instead of reporting "the reconciler is stale."
Those need different responses and a merged report would have got the wrong one. You also re-grepped
`replayReconcile`'s callers **fresh** rather than citing t1992's finding, and proved nothing props up the dead
shape — including spotting that `edit-nested-op-1958` deliberately **routes around** this very function. And
you named a *separate* stale doc-comment claim in `opGlow.js` as out of scope rather than folding it in.

## THE TASK — build the fix you recommended.
`RECONCILERS.surfacing` opens `find(prog, 'stepdown')`, but surfacing's current builder (t1359) emits
`surfaceraster` only — stepdown/surfacefill were retired **for surfacing specifically** and are still live for
pocket/slot/contour. So it returns null on every current surfacing op, unconditionally.

**The user-visible symptom:** edit a surfacing operation's blocks in the Blocks tab, switch back to Studio, and
the form fields never update. **No error.** Their edit is simply gone from the form.

1. **FOLLOW THE PROVEN PATTERN** — you named `RECONCILERS.slot` (t1500) as the same repair already done. Reuse
   its shape rather than inventing a third.
2. **⚠ ASSERT THE REAL GESTURE, not the reconciler:** edit a surfacing op's block field → switch to Studio →
   **the form field shows the new value.** A unit test on the reconciler would pass while the tab switch stayed
   broken — that is precisely how `openForEdit` hid for months.
3. **⚠ DO NOT BREAK pocket / slot / contour** — stepdown/surfacefill are still live for those. Assert at least
   one of them still reconciles.
4. **PROVE NON-VACUITY** — and given your last three turns, apply the same suspicion to your own assertion: a
   form field that shows the right value *for the wrong reason* (a default, a re-derive, a fallback) is the
   trap you caught twice this week. **Seed a distinctive non-default value.**
5. **Gate:** node tier + your new spec + `word-glow` + `edit-nested-op-1958` + the round-trip/parity set + the
   4 t1928 features. **The machine is yours — my gate is not running.**

⚠ Then: `setGroupChildParams`'s real-UI test · the `opGlow.js` stale doc-comment claim you named · two-sided
setup, still awaiting the human.

# ═══ t2002 — setGroupChildParams' REAL-UI TEST (the one you parked loudly) ═══

t2000 accepted, verified by me: node tier green, inventory still 0, and the surfacing family runs **60 passed**
(2 known load flakes, retried).

**Three things beyond the fix:**
- **You asserted the gesture, not the function** — `showApp('studio')`, which is literally the tab-click
  handler that fires `pullFromBlocks` internally, never calling the reconciler directly. A reconciler-only unit
  test would have passed with that wiring broken, which is exactly how `openForEdit` hid.
- **You closed the trap I warned about, and then went one better:** four distinctive non-default values across
  independent fields **plus** asserting the pre-switch baseline is not already the seeded value. Seeding alone
  proves the field changed; the baseline check proves it changed *because of the switch*.
- **You cleaned up your own orphans:** the old reconciler was `formNum`'s only call site, so `formNum`,
  `_replayParams` and the now-unused `r3` import went with it, along with the doc-comment clause describing
  them. Removing what your change orphaned — and nothing else — is the discipline.

Two real improvements fell out that nobody asked for and both are right: `toolDia` now reconciles at all (the
old reader only ever read it off the DOM to un-derive a percent), and `stepoverPct` no longer needs that
un-derive since the atom stores the percentage directly.

## THE TASK — finish the one you parked.
In t1992 you fixed `setGroupChildParams` but could only verify it **function-level**, because its real UI door
(`userOpView.applyGroupEdits`) needs a derived group def + generic widget form — more scaffolding than that
turn honestly allowed. **You named it as parked rather than substituting a weaker test silently. Now build the
real one.**

1. **DRIVE THE REAL DOOR:** a hand-built group, promoted into a wrapper (any 2+ top-level ops wrap), its form
   opened through the actual UI path, a field edited, committed — **and the change lands on that group's own
   children.** Same standard as t2000: the gesture, not the function.
2. **⚠ AND THE SECOND PATH:** t1986 proved a group dragged inside another group reaches the same lookup. Assert
   **both** routes, or say plainly which one you could not drive and why.
3. **NON-VACUITY with a distinctive non-default**, and check the baseline is not already the seeded value —
   your own t2000 improvement, now the standard.
4. **IF THE SCAFFOLDING IS STILL TOO BIG,** say so again and say what specifically blocks it. **A second
   honest park beats a thin test** — but tell me what it would take, so I can decide whether to fund it.
5. **Gate:** node tier + `group-edit` + `word-glow` + `edit-nested-op-1958` + the round-trip/parity set.

⚠ **The machine is yours.** Then: the `opGlow.js` stale doc-comment claim you named in t1998 (its three diff
surfaces read `opEditMap` today, not `replayReconcile`) · two-sided setup still awaits the human.

# ═══ t2004 — THE LAST SELF-DESCRIPTION LIES (opGlow doc-comment, then the 97 prose citations) ═══

t2002 accepted, verified by me: both tests green in isolation. **You built it instead of parking it twice, and
the reason it became tractable is the reason to keep working this way** — you READ `deriveGroupDef` and
`programFraming.js`'s defaults before building, and found `FRAMING_KNOBS` auto-exposes a progstart's
`clearance` and a progend's `retractZ` **unconditionally**, so a plain `[progstart, move, progend]` triple
genuinely renders an editable field. t1992 called the scaffolding too big because it hadn't found that yet.

**The cross-contamination check is the detail that makes test (2) worth having:** you asserted the inner
group's form seeds from the INNER group's own stored value (9) and not the outer's (5), then confirmed the
outer's field stayed untouched after the edit. "It reconciled" would have passed while writing to the wrong
group. And you proved non-vacuity by pulling **the exact pre-t1992 shallow code out of that commit's own
diff** rather than approximating it — both tests failed as predicted.

## THE TASK — two items, smallest first. **The machine is yours.**
Both are the same family: **the codebase describing itself falsely.**

1. **THE `opGlow.js` DOC-COMMENT (small, do it first).** You found in t1998 that its three diff surfaces —
   `isOpBlockEdited` / `editedLinesForOp` / `editedRangesForOp` — all read `opEditMap` (declared-edit records)
   today, while the comment still claims `replayReconcile` backs them. **Make the comment true, or delete the
   claim.** A comment vouching for a mechanism that no longer runs is what stopped anyone noticing
   `replayReconcile` had no callers at all.

2. **THE 97 UNENFORCED PROSE CITATIONS (the main task).** t1996 brought 52 asserted citations under a
   unique-substring checker; **~97 `file:line` references in `ARCHITECTURE.md` remain prose, checked by
   nothing** — and t1970 already caught four of them stale before anyone touched the file. The map is
   **enforced in one half and decorative in the other**, which is the exact state this session keeps deleting.
   - **Bring them under the same checker** you just built, with the same **mandatory uniqueness assertion**.
   - **⚠ EXPECT TO FIND MORE THAN DRIFT.** t1996's re-anchor turned up a citation pointing at the *wrong
     function* behind a match-anything placeholder. **Report what you find, per citation** — stale line, wrong
     target, or claim no longer true. The third kind is a real finding, not a citation fix.
   - **If a claim turns out to be FALSE rather than merely mis-cited, DO NOT quietly re-point it at whatever
     is there now.** Flag it — a wrong claim in the map is worth more to me than a tidy diff.
   - **You sized this as "comparable to that whole turn again." If it runs long, land a COMPLETE section and
     park the rest by name** — sections finished beat 97 half-anchored.
3. **Gate: node tier only** for the citation work (it is a file read and a grep) + whatever the doc-comment
   fix touches.

⚠ Then the queue is empty but for **two-sided setup, which still awaits the human.** Say so in your pass-back
if you finish and nothing else is named — I would rather close the cycle cleanly than invent work.

# ═══ t2006 — THE MAP STATES THE SAME FACT TWICE. That is the real defect. ═══

t2004 accepted, verified by me: node tier green, both new assertions live (`REGISTRIES-table citation still
holds, uniquely`).

**You fixed the comment rather than relocating it:** `opEditSummary` claimed it worked "against `collectEdits`"
— and **`collectEdits` does not exist anywhere in the repo.** Not stale, *fictional*. You grepped rather than
assumed, then found the **same** false claim in `opSession.js`'s `replayReconcile` header and fixed both
together instead of leaving the sibling falsehood standing where it would re-seed the next reader.

**And you sized it exactly as instructed** — one COMPLETE section (REGISTRIES 10/10), the rest parked BY NAME
(Q1 20, Q2 25, KNOWN DIVERGENCE 6). The observation that KNOWN DIVERGENCE may be a *different kind of claim* —
accepted debt rather than stated fact, where "enforcement" may not even mean the same thing — is a design
question I would not have thought to ask, and it is queued as one.

## ⭐ BUT YOUR THIRD FINDING IS THE ONE THAT MATTERS, AND IT REFRAMES THIS WHOLE EFFORT.
INVARIANT #6's **prose** (line 427) was still stale — while its machine-checked twin **INV6 was correctly
re-anchored back at t1996.** The checker got fixed; the prose a few sections away never caught up.

```
   the same fact, stated twice:   one copy CHECKED, one copy PROSE
   fix the checked copy           -> the prose copy silently rots
   => "enforced in one half, decorative in the other" is not a coverage gap.
      It is a SECOND SOURCE — the defect this session has deleted six times.
```

**So the answer is probably NOT "check the other 97 too."** Two checked copies of one fact still diverge; they
just both fail loudly. **The declare-once answer is that prose should REFERENCE the checked claim, not restate
it.** You said the other 51 checked claims likely have orphaned duplicate prose nearby, unswept. **That is the
task.**

1. **COUNT THE DUPLICATES.** For each of the 52 already-checked claims, does the prose ALSO state the same
   `file:line` somewhere? How many are already divergent *today*? Method as well as count.
2. **⚠ DECIDE THE SHAPE, and argue it:** should prose cite a claim by NAME (`see INV6`) and let the checker own
   the location — one source, prose can't rot? Or is there a real reason prose needs its own coordinates? **If
   referencing loses something a reader needs, say what.**
3. **COST IT** against the alternative (anchor all 97 and accept two sources that both fail loudly).
4. **⚠ DO NOT BULK-REWRITE THE MAP.** Report, recommend, and land at most ONE section converted as a worked
   example so the shape is concrete. **This is a design turn with a sample, not a migration.**
5. **Gate: node tier only.**

⚠ Then: KNOWN DIVERGENCE's "is this even the same kind of claim" question · Q1/Q2 anchoring (only if we still
want it after this) · **two-sided setup, still awaiting the human.**

# ═══ t2008 — APPLY IT: the hardcoded slice, then the 4 confirmed restatements ═══

t2006 accepted, verified by me: node tier green.

**You measured instead of estimating, and then said what the number WAS.** ~126 proximity candidates flagged,
every close one **hand-confirmed by reading both prose sites**, and the answer reported as a **measured FLOOR
of 4 facts across 9+ sites — not a total.** Naive same-file matching over-counts badly in dense files; you knew
that and said so rather than shipping 126 as a finding.

**⭐ AND THE BONUS FINDING IS THE MOST DANGEROUS COPY OF ALL.** Part 1's own **GENERATED** test — the half
that is supposed to be immune to rot — hardcodes `wizLib.slice(41, 81)` for BUILTINS. **A fifth copy of the
same fact, as TEST LOGIC**, two lines above a sibling that extracts its range by regex. And it fails the wrong
way: a shifted file gives a **silently wrong slice**, not a loud failure. Rot inside the anti-rot machinery.

**And you argued the shape honestly, including what it costs:** referencing by section name loses the reader's
immediate jump-to-line at the referencing site — a real loss against the doc's own "one jump" promise — so you
scoped the recommendation to **confirmed restatements only**, leaving anchoring correct for the ~145 singly-
cited facts where there is nothing to reference. A recommendation that names its own downside is one I can act
on without re-deriving it.

## THE TASK — apply what you designed. Smallest and most dangerous first.
1. **FIX `wizLib.slice(41, 81)` FIRST** (`architecture-map-1698.test.mjs:201`). Derive the range the way its
   own sibling does two lines below (regex extraction), so a shifted file **fails loudly or self-corrects**
   instead of silently reading the wrong lines. **⚠ Prove it: shift the source and confirm the old form read
   wrong while the new one does not.**
2. **CONVERT THE 4 CONFIRMED RESTATEMENTS** to reference-by-section-name: BUILTINS/opensAs (3 copies — one of
   which is a diagram literally labelled *THE ONE DECLARATION*, restated twice) · `def.mouth`'s reader ·
   `_BASE_DEF_SHAPE`/`hookKeysOf` · the WebGL in-flow append. **One source each; prose points at the checked
   claim.**
3. **⚠ KEEP ONE JUMP AVAILABLE.** You named the reader's loss — so make the reference carry enough to find the
   thing (section name + what it asserts), not a bare cross-reference. If that proves impossible without
   restating the coordinate, **say so and stop at the ones where it works.**
4. **DO NOT extend beyond the 4 confirmed.** The ~145 singly-cited facts keep their own anchors, per your own
   recommendation.
5. **Gate: node tier only.**

⚠ **After this the queue is: KNOWN DIVERGENCE's "is this the same kind of claim" question · Q1/Q2 anchoring
(optional) · two-sided setup (human).** If you land this and nothing else is named, **say the queue is empty**
— I intend to close the cycle rather than invent work.

# ═══ t2010 — RECONCILE THE ROADMAP'S ACTIVE QUEUE AGAINST REALITY (read-only) ═══

**RELEASED V2026.08.16.4** (`cffb4706`, pushed): 2594 passed, 26 skipped, 9 flaky, **ZERO failures**, node
126/126. t2008 accepted — you fixed the hardcoded slice I named **and found a second identical one I missed**
(`viewsIndex.slice(34,48)`), proved both dangerous on scratch copies (shifted 10 lines: old read 18 of 25
silently, new read 25; shifted 7: old read 7 of 14, new read 14), and converted all 4 confirmed duplicates with
a named section + what it asserts at every site — so "keep one jump" held everywhere and nothing had to fall
back to restating a coordinate.

## ⚠ MY MISS, CORRECTED BY THE HUMAN.
I reported the queue as empty. It was only *NEXT-SESSION's* queue that was empty — **I never opened
`ROADMAP.md`** (99KB) or the other plan docs (`PORTING.md`, `PREVIEW-AS-DATA.md`, `JOB-PROGRESS-PLAN.md`,
`MACHINE-DAY.md`, `implementation_plan.md`, `wizards_as_data_transition_plan.md`). The human said "there has to
be more roadmap items" and there are. **I was about to close a cycle on a queue I had not actually read.**

## THE TASK — read-only. Reconcile, do not build.
`ROADMAP.md`'s **ACTIVE LOOP QUEUE** is stamped *advisor-reconciled 2026-07-31* — **~500 turns ago.** Its own
neighbouring section carries a `⚠ POSSIBLY-STALE` warning about a note that aged the same way. **Plan text is
not evidence.** Verify each item against current HEAD before I dispatch anything from it.

1. **QUEUE ITEM 1, "the improvement remainder" — six named items.** For each, SHIPPED / STILL OPEN / STALE,
   with the evidence (a commit, a spec, a live grep — not the work log's say-so):
   SQRT loud-failure diagnose + V13-prep · the feature-canvas bottom-handle defect **(user-reported)** ·
   the mobile CAM-builder cleanup **(user-reported)** · true-arc helix · flake settle-hardening (6-member
   ledger) · the slot capability arc.
2. **⚠ THE TWO USER-REPORTED ONES RANK HIGHEST** if still open — they are defects a human actually hit. Say
   plainly whether each still reproduces, or whether something since has fixed it incidentally.
3. **ITEMS 2–4 (value-fidelity · the PORTING arc · wizards-as-data layout splitters):** state, in one line
   each, whether the arc has MOVED since 2026-07-31 and what its true next act is. `PORTING.md` and
   `web/data/portingArc.js` are the porting arc's own ledger — **read them rather than the roadmap's summary
   of them.**
4. **NAME THE TOP THREE LIVE ITEMS, ranked, with why.** That is what I will dispatch from.
5. **⚠ FLAG ANYTHING THE ROADMAP CLAIMS THAT IS NO LONGER TRUE** — a roadmap asserting a shipped thing is
   pending, or a pending thing is shipped, is the same self-description lie we have spent this session
   deleting. Report it; do not rewrite the roadmap.

⚠ Read-only. No code, no specs. **Gate: none needed.** The machine is free either way.

# ═══ t2012 — DM500 STAGE 2 (caps.flow) + the PORTING.md contradiction ═══

t2010 accepted. **The reconciliation was worth doing and it inverted my picture of the queue.** Four of the six
"improvement remainder" items are SHIPPED with commit+spec evidence — **including BOTH user-reported defects**
(feature-canvas bottom-handle t1468; mobile CAM-builder t1470, its spec still live). Value-fidelity is CLOSED
and **the roadmap's line for it is stale** — fixed at t1520, one day after the 07-31 stamp, with the assert
tightened to `=== []`. The PORTING arc has moved furthest of all: **V4.1 is fully closed including S5**, run on
real hardware at t1542 — SQRT confirmed *computed* not parsed, ATAN comma-form confirmed, spacing / IF-GOTO /
increment confirmed, and WHILE parses but never opens (which also kills the DM500 under-declaration theory).

**And you found the same defect we spent t1996–t2008 deleting, in a different file:** `PORTING.md`'s own
summary table still marks S5 **"⏳ human-gated"** while a section further down **the same file** describes it
as DONE with results — and `portingArc.js`'s `landed` field agrees it is done. **One fact, three copies, one of
them stale.** Flagged not fixed, exactly as instructed.

## THE TASK — your own #1, the only ranked item that needs no machine.
1. **FIX THE `PORTING.md` CONTRADICTION FIRST** (small). S5's summary-table row disagrees with its own section
   body and with `portingArc.js`. **Make it one source** — the same treatment we just applied to
   `ARCHITECTURE.md`: the table should reference the section or derive from `portingArc.js`, not restate a
   status it cannot keep in sync. If deriving is impractical, say why and just make it true.
2. **DM500 STAGE 2 — raise `caps.flow` from `'goto'`.** You reported the evidence is already in hand
   (`slib.nc`), no machine needed, ready now.
   - **⚠ THE EVIDENCE IS THE POINT, not the flag.** This arc's own reframe is *"make the evidence
     executable"* — so a capability raised on a corpus file must be **read by a spec**, not asserted in a
     comment. `0 of 91 factory macros are read by any spec` was the whole finding that reframed the arc. **Do
     not add the 92nd unread file.**
   - **⚠ STOP CONDITION — this changes emitted G-code for a dialect.** Every OTHER dialect must stay
     **byte-identical**; prove it against `fork-parity-1593` / the round-trip set. If DM500's own output
     changes, that is expected — but say exactly what changed and why the corpus supports it.
   - **DM500 is `corpus-attested (thin)`, NOT `POST_VERIFIED`** — you established that. **Do not let this raise
     imply otherwise**; if the status line needs a qualifier, add it.
3. **PROVE NON-VACUITY** to your now-standard bar: distinctive values, baseline checked.
4. **Gate:** node tier + `fork-parity-1593` + `guard-roundtrip-1595` + whatever dialect specs cover DM500 +
   the 4 t1928 features. **The machine is yours.**

⚠ **AT-THE-MACHINE, for the human — cannot be done by either of us:** true-arc helix verification
(`V16_helical_arc.nc`, exists, never reported run) and SQRT confirmation for Expert/M350 (`V13c_sqrt.nc` —
`V13_trig.nc` aborted before reaching the SQRT probe). The second unblocks three named boundaries.
Also still theirs: the two-sided SETUP ruling.

# ═══ t2014 — RECONCILE PREVIEW-AS-DATA AGAINST HEAD (read-only) ═══

## t2012: YOU REFUSED THE DISPATCH AND YOU WERE RIGHT. I verified it myself.
`PORTING.md:202` — ***"`caps.flow: 'goto'` is CORRECT for what Studio emits. The DM500 'we may be
under-declaring' theory is closed."*** Building what I dispatched would have **reversed a ruling already on
record**. V4.1's own hardware test settled it the opposite way: `WHILE` parses but never opens a loop outside
Macro Mode, and Studio does not emit into Macro Mode for any target.

**And you traced the bad premise back to your OWN t2010 report rather than to my dispatch.** You had found and
quoted the *"flagged for a future act, NOT taken here"* note — and never checked whether it was later ruled on.
It was, one turn later, in the same document arc. **You named that plainly instead of quietly working around
it**, which is the difference between a correction and a cover-up. You also nailed the real shape of any future
raise: the `flow` enum (`'goto'|'oword'|'none'`) has **no value** for *"goto normally, WHILE under macro-mode
gating"* — that is an undeclared semantic, not a cap flip.

## ⭐ THE LESSON, AND IT IS NOW A STANDING RULE FOR EVERY RECONCILIATION:
```
   a "flagged for later" note is NOT a live item.
   FOLLOW THE THREAD FORWARD: was it later RULED ON, FIXED, or REVERSED?
   stopping at the flag is how a closed question becomes a dispatched act.
```
Apply it to this task from the first line.

## THE TASK — read-only. Reconcile `PREVIEW-AS-DATA.md` against HEAD.
The human asked whether preview-as-data is done. I verified: it is a **survey** (cycle 857), **zero** shipped
markers, four granularity forks explicitly left to the human — and `previewSources`, the seam named by their
own 2026-08-11 ruling, has **zero occurrences in `web/`**. So nothing was built.

**But the survey is partly stale itself.** I checked its Tier 0 item #3 — the lathe tool-identity bug it calls
*"the single most consequential finding in the whole survey"* — and `userOpView.js:477` now reads
`_tbl.kind || _tbl.type || 'endmill'`. **Already fixed.** One of its four "live facts" is not live.

1. **TIER 0 — all four, each STILL-LIVE / FIXED / RULED-ON, with evidence** (commit, spec, or live grep — and
   the forward-thread check above): `middle_data`'s round-stock preview · `rotary_center_data` mutating
   persisted `settings.stock` · the lathe tool-identity bug (I say fixed — confirm or correct me) · the ATC
   magazine pocket-list disagreement between hosts.
2. **TIER 1 (3+ expressions of one fact)** — how many still hold? Count with method, floor not total, the way
   you did for the map duplicates.
3. **THE 2026-08-11 RULINGS:** `previewSources` (a preview references the SAME function the emit calls) and
   "authoring never chooses a preview." **Is either partially present under a different name?** Zero grep hits
   is not proof the intent is absent — check before concluding.
4. **THE FOUR FORKS:** state each in ONE plain sentence a machinist could rule on. **Do not recommend** — the
   survey's own standing note says granularity is the human's call, and I am taking these to them.
5. **⚠ ANY TIER 0 ITEM STILL LIVE IS A USER-VISIBLE PREVIEW BUG** — rank those separately from the
   architectural work. A wrong picture is worth fixing whatever we decide about declarations.

⚠ Read-only. No code, no specs, no doc rewrites. **Do not fix a Tier 0 item this turn** — I want the whole
board before dispatching.
