# NEXT SESSION — handoff

## ⭐ Current state (2026-06-27) — READ THIS FIRST
**LATEST — the CANVAS-WIDGET consolidation advanced through Stage 2 (COMPLETE) into Stage 3 (started).** 9 commits,
**local / NOT pushed** (no `.ver` bump → pushing triggers no release), full suite **329 green** (lone flake = known
`middle-animator`). Stage 2: all 6 draggable views (text/drill/surfacing/pocket/slot/contour) now DECLARE their handles
via the registry, adding the `rect` / `radial` / `projLength` gestures, each gated byte-identical (unit math + real
drags). Stage 3 (first increment `46c4195`): the custom-op Form+2D preview renders its handles FROM the registry + a new
end-to-end declarable `ncircle` (2D circle) gesture. Detail + the next decision → the "▶ Immediate next task" section.

The two threads below ran EARLIER the same day on `main` (pushed; suite was 320 green at that point):

**A · Wizards-as-data Stage 5 — three more ports + a restructure pass (DONE).**
- The two-session surfacing **"Blockly bridge recursion" was ROOT-CAUSED + fixed** — it was NEVER the bridge: the value-GLOW
  (`opGlow._localizeValue`) perturbs each flat numeric param to a ~1e6 sentinel to localize its token, and surfacing's
  flattened `h` exploded the scanline fill → `push(...bigArray)` overflow. Surfacing flattened to a `surfacefill` atom
  (byte-identical) + the glow now bails on a throwing perturbation. `8404429`. ⇒ [[glow-safety-childless-multiplier]].
- **Restructure pass** (drill/bore/array/atc_warmup, adversarially verified) found 2 real defects: bore's helical glow
  **HANG** (a synchronous 47M-line build BEFORE any throw → uncatchable by try/catch → a KERNEL cap in bore.js, `7248bce`)
  and atc_warmup's **stale operator message** on a fork (interpolated rpm froze in the template → a lie at the machine →
  made static, byte-identical, `45c6c2c`).
- **Ports shipped byte-identical** (`{template,bindings}` data-def + sweep + structural binding-wiring): **surfacing**
  `8b43c19`, **slot** `38b2260`, **text** `b4ef8ee` (drill/atc_warmup were already done). Each RESTRUCTURED THE SOURCE,
  not the format: a flat atom / the FORM precomputes `tool·%` → a flat `stepover` / region-local-at-0 so PlaceOnStock owns
  the origin / a leaf `extent()` so stock-attach tracks live. Frontiers held UNBOUND (clearance fan-out, pattern
  structure-swap). The old "grow the format" take is SUPERSEDED — see ROADMAP + [[restructure-source-not-abstraction]].

**B · Text customization + the CANVAS-WIDGET consolidation (the ACTIVE initiative).**
- Text engraving made customizable: **width** (condense/extend) + **slant** (oblique) — pure layout transforms,
  byte-identical at the defaults, bound in text-as-data, GUI-verified. `7c4007e`. A **font registry SEAM** also shipped
  (`font` is a bound socket, `strokeFont` FONTS/getFont/registerFont) — but **TTF/OTF + V-carve fonts were PARKED on
  purpose** (V-carve is a whole toolpath engine, not a font tweak); the seam stays so they land later with no rework.
- **CANVAS-WIDGET consolidation — STAGE 1 SHIPPED `6b08676`.** The agreed scope: every milling op's **handcoded** 2D-canvas
  GUI → ONE declarative, reusable, end-user-authorable widget system (the canvas analogue of `formWidgets.js`). Built:
  `web/viz/canvasWidgets.js` — gesture types **point/length/scaleX/shear**, each owning place + drag + click-to-edit,
  behind `buildCanvasWidgets(decls, setFields) → {handles,onDrag,onEdit}`. **Text is the first consumer** (textView): pos +
  height REUSE point/length (hand-rolled onDrag deleted), width=scaleX, slant=shear — the four corners of the text box.
  FeatureCanvas's move/size/corner/stock-snap plumbing reused as-is; only the two missing gestures were added. Proven by
  `tests/canvas-widgets.spec.js`. *(Stage 1 was the "then decide" checkpoint; this session CONTINUED it through Stage 2 —
  all 6 views — and into Stage 3. See the LATEST banner above + the "▶ Immediate next task" section.)*

---

## Earlier (2026-06-26 session)
**Current state (2026-06-26):** a large wizard-maker session is **merged to `main` @ `0422cbe`** (redeployed to
ddcs-studio.pages.dev; no `.ver` bump yet → no new desktop release). Shipped this session, on `main`:
- **Spatial-GUI PRODUCER seam** (the prior handoff's "next task", done) — "2D point/rect (numbers)" authoring → custom-op
  preview **drag-to-edit**; both author paths (param-pill + dev-mode expose). `userOps`/`formWidgets`/`bridge`/`devMode`.
- **ONE Blocks mode** — dissolved the normal/dev toggle; authoring is **always on** (quiet "knob" markers that light up
  when a value is exposed). One render path. `devMode.js`.
- **Live block↔form round-trip (custom ops)** — the centrepiece: a `FORM [LIVE]` pane in the Blocks tab derives the
  wizard's form from the blocks (no save), **two-way** (edit a block → the form updates; edit the form → it writes
  surgically back to the block + the G-code/preview), with an editing-context UI (breathing glow + "✎ Editing: <name>"
  chip) and **non-destructive save** (Save-as-new vs an explicit Update). `blocksApp`/`devMode`/`stackBridge`.
- **Polish/fixes** — one form frame (no doubled section borders) + probe-input/STOP overlap; `recordBlockEdit` ignores
  the dev fields; centred toolbox ✕ + smoother palette slide; `macros-tabs.spec` refreshed to the sidebar-tree layout.

**Unmerged on branch `feat/learner-library`** (5 commits, suite 308 green — **MERGE / RELEASE is the obvious next step**):
- **Learner library** (ROADMAP MID #14, shipped) — the Blocks toolbox is now a TREE: **⚛ Atoms · 📚 Snippets · 📦 Complete
  Programs**, where Snippets/Programs hold themed sub-categories of curated, drag-in compositions (each a stack rendered
  as ONE connected flyout block via `stackBridge.stackToFlyoutBlock`). Validator-gated (`learner-library.spec`). Starter
  set incl. a Probing snippet + program. `data/learnerLibrary.js`, `bridge.buildToolbox(extraCategories)`.
- **Enum atom fields → dropdowns** — `dir`/`flow`/`arc`/`end`/`direction`/`order`/`strategy` were free TEXT (a one-letter
  typo silently mis-emitted — coolant `mist`→`mis`→M9); registered in `bridge.SELECTS` → valid by construction.
  (`filltext.align` still text — value set unconfirmed; see ROADMAP Gaps.)

**The backlog lives in one place now:** [`ROADMAP.md`](ROADMAP.md) — the code-verified canonical roadmap
(NEAR / MID / STRATEGIC + non-wizard + gaps + parked). This handoff is only *"where we are + the next task."*
The old planning docs (`NEXT-TASKS`, the vision, `CRAZY-IDEAS`, `FUSION-INTEGRATION`, `docs/*`) were archived to
[`docs/archive/`](docs/archive/) and folded into ROADMAP.md — that sprawl is exactly why they went stale.

## ⚑ Reframe worth carrying
The "wizards-as-data engine" the vision treated as future is mostly **already built**: expressions (`expr.js`),
loops/control (`count`/`iff`/`array`/`flow`), and raw-emit atoms (`macro.js`) all ship. **Stage 4 (express ONE built-in
as data + the equivalence harness) is now done** (drill). What remains is **Stages 5–6** — port the rest (gated on the 3
frontier format extensions the drill port surfaced) → self-host. See ROADMAP "Key reframe" + STRATEGIC #2/#3.

**⇒ REFRAME (user, 2026-06-27) — restructure the wizards, don't extend the format.** The Stage-5 wall (surfacing/
contour resist binding — nested params, computed stepover, fan-out) is better solved by **rebuilding those awkward
wizards into flat, port-friendly shapes** (lift nested geometry to top-level params; let the **FORM** do the `tool·%`
math and store a flat value; one-param-one-socket) than by building 4 engine-level binding-format extensions — **~3
of the 4 evaporate** this way, only genuine branching may still need `iff`/`count` atoms or wizard variants. Keep the
**byte-identical** equivalence gate where legacy output is fine; relax only deliberately. Existing wizard internals
are NOT sacred; keep the data-def format DUMB. **DIRECTIVE (general): the worker agent should ASK the user whether a
wizard/builder can be CHANGED to align with the north star, rather than building machinery to preserve a structure
the user doesn't care about.** See ROADMAP Conventions + STRATEGIC #3 + memory [[restructure-source-not-abstraction]].

## ✅ Shipped this session (2026-06-26)
- **MID #6 — Federated schema registry `[S]` + STRATEGIC #2 — Wizards-as-data Stage 4 `[L]` — COMMITTED `128ae7e` (pushed to `main`).**
  MID #6: built-in `BUILDERS`/`SCHEMA` PRISTINE; user ops in separate `USER_BUILDERS`/`USER_SCHEMA`/`USER_LABELS` layers
  resolved by `builderOf`/`specOf` (built-in-first; `user_`-prefixed → disjoint); ~13 read-sites + 4 opSchema helpers
  rerouted; `USER_LABELS` split fixes the `OP_LABELS` leak. Stage 4: **drill as a `{template,bindings}` data def**
  (`dataOps/drillData.js`) + reusable **equivalence harness** (`dataOps/equivalence.js`); proven via emit-equivalence
  (grid-at-origin/cut/skip/wcs sweep) AND structural binding-wiring (all 21 bindings). Adversarially reviewed.
- **STRATEGIC #3 — Stage 5, 1st additional port — `atc_warmup`** (COMMITTED `cd0537f` — note: that commit is
  MISLABELLED "feat(analytics)" because a concurrent session's `git add -A` swept it up; the work is all there). Spindle
  warmup as `{template,bindings}` — STATIC-shape, 4 numeric bindings; FUNCTIONAL emit-equivalence via the new reusable
  **`stripAnnotations`** normalizer + binding-wiring. Surfaced the **4th frontier — computed annotation TEXT** (COSMETIC).
  *(`wcs` REJECTED — conditional branch + boolean-gated inclusion → not `{template,bindings}`-able.)*
- **⚑ Frontier-coverage map (all 19 remaining built-ins classified) + ✅ FUNCTIONAL blocker (a) placement-bbox SOLVED**
  (the north-star fix — UNCOMMITTED in the working tree). Map: `atc_warmup` was the ONLY free port; everything else hits
  a FUNCTIONAL blocker (most are conditional-structure-dominated → unportable as pure data). **The bbox fix** (principle
  #4 — the frozen snapshot was a duplicate that goes stale): geometry atoms now DECLARE `extent(params)` (`drill`/`bore`
  = a point; `array` = points ⊕ child extent) and the place fold recomputes it LIVE (`blockEmitter.liveExtent`),
  falling back to the snapshot for un-migrated ops. **`drill` is now fully placement-portable** (off-origin/circle/line/
  rect/stock-attach all byte-identical; a latent circle-`x0` placement bug fixed). Behavior-preserved (full suite green);
  an adversarial check caught the circle-`x0` regression a test gap had missed. Files: `wizards/ops/{drill,bore,array,
  placement}.js`, `blocks/blockEmitter.js`, `blocks/dataOps/drillData.js`, `drill-as-data.spec.js`.
- Full suite **311 green serial** (parallel runner flakes ~5 UI specs under load — pass in isolation/serial).

## ⚠️ CORRECTION — `surfacing`/`contour` are NOT clean next ports (the coverage map over-rated them)
Investigated surfacing for the next migration; it CAN'T be a data-def even with the placement-bbox fix: its geometry
`w`/`h` are NESTED in `stepover.params.region` (the flat `(blockIndex,key)` binding can't reach `region.w`), `so` is
COMPUTED (`toolDia·stepoverPct/100`), `strategy` is MAPPED, and `originX`/`clearance` FAN OUT. So a surfacing data-def
can't vary the footprint → the placement fix is undemonstrable there. `contour` is the same. **`drill` was the only
cleanly-portable placement op; `atc_warmup` the only clean leaf.** The `liveFootprint` opt-in mechanism (declared
`extent` + a per-op flag so shared atoms like `stepover` don't regress pocket) is DESIGNED and proven on drill, but
landing it for surfacing was a NO-OP (footprint can't vary) so it was reverted — land it only after binding works.

## ✅ RESOLVED (2026-06-27) — the "bridge recursion" was never the bridge; it was the value-GLOW. + restructure-pass done
The surfacing blocker is SOLVED and shipped. The `Maximum call stack` was **not** a Blockly-bridge cycle — it was the
select/hover **value-glow** (`opGlow.valueRangesForSubtree`/`_localizeValue`) perturbing surfacing's now-FLAT `h` param
to the sentinel `987654.321` to localize its token → ~137k scanline rows → `out.push(...bigArray)` overflow. The old
StepOver(Region) **pill** hid `w/h` as object params the glow skips; flattening SURFACED them. (The earlier "transient
cyclic stack" hypothesis was wrong — proven by reproducing the throw in a plain emit clone, no bridge involved.)
Shipped:
- `8404429` — surfacing → flat `surfacefill` atom (byte-identical, git-diffed vs the Region version) + `opGlow._localizeValue`
  bails on a throwing perturbation (general fix). studio-to-blocks/blocks-hover updated. Full suite green.
- `7248bce` — **restructure PASS** (drill/bore/array/atc_warmup + an exhaustive glow-safety sweep, each adversarially
  verified). drill/array/atc_warmup already MET the standard; the sweep found ONE real defect: **helical `bore`** is a
  childless leaf whose `depth` MULTIPLIES the toolpath, and at the sentinel it builds ~47M lines **synchronously** →
  the tab HANGS *before* the push-spread can throw → `try/catch` can't catch it. Fixed with a **kernel cap** in bore.js
  (real bores untouched → byte-identical; absurd → tiny capped placeholder → glow line-count bail). `tests/bore-glow-cap.spec.js`.
  Rejected (not real gaps): `line.depth` (throws fast → already caught), `concentricRect` NaN-hang (finite sentinel never
  triggers it; polygon/ellipse already fall through to scanline). ⇒ design rule for every future fill-op restructure:
  [[glow-safety-childless-multiplier]].
- `45c6c2c` — **atc_warmup → byte-identical** (NOT the "cosmetic frozen text" I first wrote off): the wizard interpolated
  rpm/time into comment + **operator HMI-message** text the data-def freezes, so a forked 8000-RPM warmup told the operator
  "6000 RPM" — a *stale message = a lie at the machine*, not cosmetic. Fixed at source: made the annotation text STATIC
  (rpm/time stay the single source of truth in the executable Spindle/Dwell atoms; principle #4). Spec now asserts FULL
  byte-identical (no stripAnnotations) + a no-stale-message regression.
  **Annotation-TEXT taxonomy (apply to EVERY future port):** classify each op's messages — VALUE-FREE → make static (done
  here); VALUE-BEARING (an operator reads it before acting, e.g. a probe `Probing 50mm — press Enter`) → needs a GENERAL
  annotation-text atom that renders from a BOUND param (like Spindle renders `M3 S<rpm>`), built when an op FORCES it, NOT
  speculatively. Never silently drop a number an operator confirms against.

## ▶ Immediate next task — CANVAS-WIDGET consolidation, Stage 3 (IN PROGRESS — first increment shipped `46c4195`)
Stage 1 (the reusable registry `web/viz/canvasWidgets.js` + text) `6b08676`. **Stage 2 is DONE** — agreed SCOPE met:
every milling op's **handcoded** 2D-canvas GUI now DECLARES its handles via `buildCanvasWidgets([...])` (the canvas
analogue of `formWidgets.js`). All 6 views with draggable handles are migrated: **text, drill, surfacing, pocket, slot,
contour**. (`grep onDrag wizards/views` = exactly those 6 — "array/bore/circular" from the old sweep list are NOT
separate canvas views: bore is a drill variant; the rest are probe/rotary views without FeatureCanvas drag handles.)

**✅ Stage 2 shipped this session (2026-06-27):**
- **`0fafda2` drill + surfacing** — the "rich shapes first" stress test. Added the two gestures the doc predicted as
  "rotate + corner": **`rect`** (2D corner via a per-axis DIVISOR: `1`=W/H · `cols-1`=grid pitch · `0.5`=half-extent
  radius · `0`=skip axis) and **`radial`** (polar → radius + angle; the "rotate" fused with radius; `rScale` maps
  drag-distance→Ø/pitch; omit `fieldA`=radius-only, omit `rScale`=pure rotate). `onEdit` gained an `editMin` clamp.
- **`a6d8f91` pocket** — SAME two gestures, no new code; done 2nd on purpose to discharge the sweep's load-bearing
  "rect+radial cover pocket, no rework" claim BY CONSTRUCTION (was inspection-only).
- **`5e6ccae` slot** — the op that FORCED the **3rd gesture, `projLength`** (width = a perpendicular projection onto the
  slot normal: |cursor·n̂|·scale clamped to the tool Ø; A↔B reuse `point`). The real proof the registry absorbs new
  gesture TYPES cleanly — one new gesture, declared.
- **`c192b36` contour** — last draggable view; reuses pocket's vocabulary, zero new code → Stage 2 complete.
- **Rigor (held to, per review):** every view gated by exact-formula **unit math** (`canvas-widgets.spec` — old formulas
  as constants, incl. a tilted-axis projLength case) **AND real pointer drags** (`{drill,pocket,slot,contour}-canvas.spec`
  — fields actually move). Byte-identical, not waved through as "free reuse." Full suite **326 green** (lone flake =
  known `middle-animator`). Gesture set now: `point · length · scaleX · shear · rect · radial · projLength`.

**✅ Stage 3 first increment shipped (`46c4195`) — the custom-op preview renders its handles FROM the registry, + a new
declarable gesture.** Two parts:
- **Part A (unify):** `panelTypes.layoutSpecFromOp` (the custom-op Form+2D preview) stopped hand-rolling its onDrag — it
  now DECLARES its handles and builds them with the SAME `buildCanvasWidgets` registry the built-in views use
  (`point`/`rect`), `setFields → _writeParam` to the bound form fields. Behavior-preserving (the existing point/rect
  handle tests pass unchanged). The custom-op canvas now shares gesture code with drill/pocket/slot — every registry
  gesture is one role-mapping away.
- **Part B (declarable reach):** a NEW **`ncircle`** number-role family (2D circle · X/Y/Ø) is authorable end-to-end
  (`userOps` CANVAS_DECODE/ROLE_WIDGETS/ROLES), and the preview maps an `{x,y,dia}` group → `point` + a radius-only
  `radial` — so an author who tags three number params gets a draggable circle with a Ø ring, ZERO per-op code. The
  rule-of-three third spatial shape (point/rect → +circle), proving the registry generalizes to custom ops. Rigor:
  unit + end-to-end declarability + a REAL panel drag of the RING (a size handle, never exercised in a real panel
  before). `tests/custom-op-canvas-handles.spec.js`, `tests/custom-op-form2d-drag.spec.js`.

1. **STAGE 3 — CONTINUE.** The seam is proven; remaining work is breadth + reach, each pulled by a real authoring need
   (rule-of-three, not speculative): **(a)** more declarable gestures as authors want them — `length`/`scaleX`/`shear`
   (text-like) and `projLength` (slot-like) each = one `CANVAS_*` role family + one `layoutSpecFromOp` mapping, same
   pattern as `ncircle`; **(b)** surface the new "2D circle" choice in the dev-mode inline-expose UI flow + a learner/
   docs note (the dropdown already lists it via `CANVAS_ROLE_WIDGETS`, but confirm the authoring gesture is discoverable);
   **(c)** OPTIONAL — the form mini-canvases (`xyPadWidget`/`rectPadWidget` in `formWidgets.js`) still hand-roll their
   FeatureCanvas onDrag; the ROADMAP calls them "spare parts" (preview-canvas-first), so migrate only if kept. REUSE the
   binding/widget-as-data system — NOT a parallel registry. [[widget-library-custom-op-wizards]],
   [[gui-blocks-roundtrip-target]], [[spatial-gui-form-vs-canvas]]. Files: `web/wizards/ops/panelTypes.js`,
   `web/blocks/userOps.js`, `web/blocks/devMode.js`.

## ▶ Form-editability of custom & hand-built ops (★ the user's HEADLINE goal — BOTH gaps RESOLVED 2026-06-27)
**✅ Status: both gaps handled (verify-first).**
- **① Custom-op hover-Edit chip (Gap #11) — VERIFIED NOT REPRODUCIBLE + regression test (`e3f1afe`).** Drove the EXACT
  repro (Save-as-wizard fork "Tool Length" `atc_length` → insert → hover) at runtime: the chip APPEARS (`✎ Tool Length
  Copy`); `builderOf` defined, `commitActiveOp` true, commits AS an `'op'` block. The hypothesised builder-less mechanism
  CAN'T fire — "probe/ATC = builder-less" is a STALE comment; every built-in has a builder now (`less: []`), and forking
  registers one. The user's dead op is a LEGACY localStorage def (older builder-less build) OR the older DEPLOYED build
  (the fixing commits are LOCAL until pushed — **the push is the actual fix for the live-site case**). `custom-op-chip.spec.js`
  locks the working behavior. Defensive "wrap builder-less as op" NOT added (nothing to wrap; revisit if a legacy def surfaces one).
- **② FORM [LIVE] for a fresh hand-built stack (Gap #12) — FIXED (`a22d252`).** Verified the symptom + Gate-5 op-wrapper
  dependency first, then: `authoringBody(ws)` derives a BARE atom chain (not just an op wrapper) so collectAuthoring/
  writeAuthoredValue work hand-built; the guard widened to show when the stack exposes knobs (not just while editing a saved
  wizard). `hand-built-form.spec.js` (bare stack + knob → form shows + writes back; no-knob → hidden). Suite 334 green.

**⚠ PUSH PENDING:** all session commits are LOCAL — the harness auto-mode classifier blocked `git push origin main`
(bypasses PR + triggers the Cloudflare deploy). The user must `git push origin main` (clean fast-forward) — that ships the
canvas-widget Stage 2/3 work AND, per #11 above, fixes the deployed-build case if their dead op was the older-build symptom.

*(Original strategy-session diagnosis below, kept for reference.)*
The user wants **any custom op / hand-built block stack editable via a FORM** (north-star "one stack, many views"). Two concrete gaps surfaced — both VERIFIED against code (not yet run); same goal at two surfaces:

- **① Custom-op hover-Edit chip is DEAD in the Studio editor** *(= ROADMAP Gaps #11; USER-CONFIRMED).* Make a custom wizard → insert → hover its G-code in the editor → **NO ✎ Edit chip**; the "custom wiz → hover → Edit" loop is dead. Every gate reads wired (`canEdit(user_*)`=true, `openForEdit`→`userOpView`, `commitActiveOp` uses `builderOf`, `recordOp` on open, `findOpInStack` op-agnostic) → break is RUNTIME. **By elimination:** `wizardManager.insert()` runs `commitActiveOp() || commitDecodedCode(code)`; if `commitActiveOp()` returns **false** for a fresh custom op, the fallback decodes raw atoms with **no `'op'` wrapper** → `findOpInStack` finds no op → no chip. **Decisive 1-run trace:** log `commitActiveOp()`'s return (+ `getLastOp()`) for a just-opened custom op; false → make custom ops commit AS an `'op'` block. Files: `wizardManager.js`, `blocks/opSession.js`, `wizards/views/userOpView.js`, `blocks/programModel.js`, `ui/editorOpHover.js`.

- **② FORM [LIVE] doesn't show for a FRESH hand-built stack** *(NEW = ROADMAP Gaps #12; the user's "a hand-built block code should be viewed as a form too").* The live-form pane is gated at `blocks/blocksApp.js:326` — `if (!editingWizardType()) { pane.hidden = true; return; }` — so it renders ONLY while editing an already-saved custom op. **The engine is general & built:** `deriveAuthoredDef` (`devMode.js:130` — *"pure function of the blocks; save is just persistence"*) + surgical two-way `writeAuthoredValue`. So this is a **completion of FORM [LIVE], not a new feature.** **Change:** widen the guard to show whenever the stack has exposed knobs (`def.bindings.length>0`), not just `editingWizardType()`. **⚠ Gate-5 verify FIRST:** the deriver/writeback assume an **op wrapper** (`deriveAuthoredDef`→`a.opRec.children`; `writeAuthoredValue:156` hunts an `'op'` block) — a bare atom stack may derive nothing, so the real change = widen-guard **+ ensure a fresh hand-built stack is wrapped as an op** (or make `collectAuthoring` handle a bare stack). Add a test (fresh hand-built stack shows + edits its form). Sieve: safety/declare/one-source/valid all ✓; only the op-wrapper needs a runtime check. Files: `blocks/blocksApp.js` (~326), `blocks/devMode.js`.

## ▶ ★★ THE USER'S HEADLINE NEXT TASK (2026-06-27) — the editor edit-CHIP on a HAND-BUILT stack

**In the user's words:** the floating edit button that pops up when you hover a built-in op's G-code in the STUDIO editor (e.g. *"⚠ Homing"* / *"✎ Tool Length Copy"*) — the user wants it **on the stacks they build BY HAND in Blocks**, so they can hover → click → edit the stack as a form. **This is the ONE unifying goal behind #11/#12/#13** — the user kept pointing at the chip the whole time ("form button" = this chip). #11/#12 being marked "resolved" does **not** deliver it yet.

**Why it doesn't work today:** the editor chip (`ui/editorOpHover.js` → `programModel.opAtLine` → `findOpInStack`) only attaches to a `type==='op'` block. A hand-built stack is **loose atoms** (no op wrapper) → `opAtLine` returns null → no chip. (Same root as #11's builder-less path: no `'op'` wrapper = no chip.)

**The feature = let a hand-built stack BE one editable op.** Three pieces, in order:
1. **Wrap-as-op (the NEW core).** A hand-built stack becomes a named `type==='op'` block (id + opType) so the editor's line→op map finds it → the chip appears. ✅ **RESOLVED (advisor gate + user design, 2026-06-27): a SIMPLE GROUP block (C-shaped container) is the editable-unit boundary.** The user picked zero-click, then solved the mixed-program boundary ambiguity with a clean idea: **a generic "group" block — C-shaped, like an op block but unnamed / un-registered** — dropped around the atoms the user wants as one editable unit. **Why this beats the worker's pure-C (synthetic op at the chip layer):** (1) **DECLARE-not-infer** — the boundary is a block you PLACE, not a "loose run" the app guesses (north-star #3); (2) **REUSES the op machinery** — a group block IS an op-like container, so `findOpInStack` finds it → chip → `openForEdit` → form → apply ALL come free (NO synthetic-op `replaceOp` rework, which the worker flagged as C's biggest cost → this is LESS work, not more); (3) **round-trips** (a real block, not a chip-layer synthetic). **Shape:** a pure hand-built stack can auto-be one editable unit (preserves zero-click where unambiguous); a MIXED program (a real drill op + hand moves) → wrap the loose part in a group block to carve its boundary. **Implementation — ⚠ CORRECTION v2 (2026-06-27, user): create the group IN-CONTEXT — NO palette block (no sidebar clutter), NOT a function/auto-trigger.** The user MANUALLY groups: **select the atoms → right-click → "Group"** (or an equivalent in-context gesture) → they're wrapped in a visible C-shaped `group` op *right there*. This is manual + explicit (the user PICKS what to group — NOT the app auto-grabbing "loose atoms") + declarative (a real `group` op in the stack) + a visible boundary — WITHOUT adding a block to the Blocks palette (user: *"id rather not clutter the side bar with blocks if we dont need them"*). The `group` op stays a `type==='op'` record → `findOpInStack`/`opAtLine` match with ZERO model edits; add a **"Group" item to the block context menu** (`opContextMenu.js` infra already exists). Reuse increment 1's `'group'` op + chip; then the #12 / stored-`_expose` form derive (increment 2) + chip unlock. (`groupLooseAtoms` may stay as the internal helper the context action calls on the SELECTED blocks — NOT auto-detected loose atoms, NOT a global trigger.) ⛔ Earlier v1 (a draggable palette block) is SUPERSEDED — no sidebar entry. ❌ NOT Option A (auto-mutate the model — reverses #12 + boundary-ambiguous; superseded by the group block). **PREREQUISITE: #13 (knob persistence) FIRST** — greenlit; blocks the value regardless (the form opens empty until exposures survive a round-trip). **▶ BUILD ORDER (user, 2026-06-27): GROUP NOW — this IS the next task.** #13 is DONE (`0233c72`, advisor PASS `4e6a569`). Build the explicit in-context group now (NOT deferred, NOT AUTO-first): increment 1 (group op + chip) ✅ `b2394e7` → **increment 2** = chip→form, derived from the group's STORED children `_expose` (the new off-records derive path; #13 is what makes it possible) → **increment 3** = the in-context **"Group" gesture** (select atoms → right-click → "Group"; `opContextMenu.js`) + the real-hover-survives-reproject regression the advisor requires. **AUTO** (a single loose run auto-getting the button = auto-apply the SAME group op, no gesture) is a **deferred LATER layer** — same op, zero rework — for the simple single-stack case; build it only after the explicit group lands.

**▶ ACTIVE TASK NOW (advisor, 2026-06-27): INCREMENT 2 — chip → editable form.** Increment 1 ✅ (`b2394e7`) and increment 3 ✅ (`04c4871`, advisor PASS — real gesture + reproject + mixed-program all verified, 338 green) are DONE. **⚠ WORKER: increment 3 is ALREADY COMMITTED (`04c4871`) + WORK-LOG'd (`14fcb1b`) + advisor-PASSED — do NOT re-commit it; nothing is uncommitted (clean tree). The inc-3-before-inc-2 order was intentional (advisor scope-down), not a problem. Don't touch NEXT-SESSION/ROADMAP (advisor-owned).** **Do increment 2:** unlock the group's chip (`wizardManager.canEdit('group')`→true; route `'group'`→`userOpView` like `user_*`), and `openForEdit` for a group derives its form from the group op's STORED children `block.data._expose` (the OFF-RECORDS path — NOT `deriveAuthoredDef(ws)`, which reads live workspace EXPOSE_ fields); form edits write back to the group's children. **Verify-first (non-negotiable):** drive the REAL gesture — right-click→Group a hand-built run, click the chip, the form OPENS, edit a knob, it writes back, AND it survives a reprojection (Blocks-tab round-trip). Keep the suite green; commit; append WORK-LOG; STOP. (AUTO stays the deferred later layer.)

**⚠ WORKER — read this, there is NO message inbox.** The advisor's only channel to you is THIS FILE; re-read it for instructions, don't poll for messages. **Git-state check FIRST:** if you see increment-3 as uncommitted, or you have stray uncommitted source files, you are NOT on `main`. Run `git branch --show-current` — if it isn't `main`, switch (`git checkout main`). On `main`: inc 3 is committed (`04c4871`), the tree is clean, and `04c4871`/`14fcb1b` + every plan update live there. There is nothing to commit for inc 3. Then build **increment 2** (above).

**✅ INCREMENT 2 DONE — GROUP FEATURE COMPLETE (advisor PASS, 2026-06-27, `8de09a6`).** A grouped run's chip is now ✎ editable; clicking it derives the form from the group's STORED children `_expose` (off-records `devMode.deriveGroupDef`, NOT live `deriveAuthoredDef(ws)`); edits write back surgically (`setGroupChildParams`, bypassing the builder-only `replaceOp`); survives a reprojection. 338/341 green. **The headline goal is DELIVERED** — right-click a hand-built run → "Group" → click the chip → edit its form → writes back. (Increments 1+2+3 all done + passed.) **▶ NEW ACTIVE TASK = AUTO** (human said continue, 2026-06-27): a SINGLE unambiguous loose run (a pure hand-built stack, no real ops) auto-gets the editable group/button — NO right-click gesture. Reuses the group op + the inc-2 form. **✅ GATE PASSED (advisor, 2026-06-27) — BUILD your synthesis, with one added constraint.** Approved: auto-**SHOW** the ✎ chip on a lone loose run on render (NO model mutation — resolve it via `ddcsLooseRunAtLine` from inc 3; the chip just appears, nothing is wrapped yet), and on **CLICK** auto-**WRAP** (`groupLooseAtoms()` → `openForEdit`, the inc-2 form). That gives the zero-gesture button with no silent mutation-on-render, and lazily wraps to a real `group` op only on the explicit edit-click — so the form/writeback reuse everything. **⚠ ADVISOR CONSTRAINT — scope auto-SHOW to the UNAMBIGUOUS case ONLY:** show the auto-chip only when the WHOLE program is a SINGLE loose run (a pure hand-built stack, no real ops). In a MIXED program (loose runs among real ops), do NOT auto-show — the right-click "Group" gesture owns those (the boundary is ambiguous; this is the single-vs-multi split we agreed). **Verify-first:** (1) auto-chip appears on a pure stack with NO gesture → click → wraps + form opens → edit a knob → writes back → survives a reprojection; (2) a MIXED program does NOT auto-show (still uses the right-click gesture). (Canvas-role knob writeback gap stays deferred.)

**✅ AUTO DONE — GROUP FEATURE FULLY COMPLETE (advisor PASS, 2026-06-27, `c8f6890`).** A pure hand-built stack auto-shows the editable ✎ chip on hover, NO gesture — no mutation on render (`autoGroupRunAtLine` reads-only, returns null if ANY real op exists → the single-run-only scope is one DECLARED model guard); clicking wraps (`groupLooseAtoms`) → the inc-2 form. Verified both halves (pure auto-show→click→wrap→edit→writeback→reprojection; mixed does NOT auto-show), suite green. **The headline goal is fully delivered — both the EXPLICIT path (right-click "Group") and the AUTOMATIC path (pure stack auto-shows).** **▶ NEW ACTIVE TASK = canvas-role knob writeback in the group form (human said continue, 2026-06-27).** The group form's derive + writeback handle NUMBER knobs but NOT canvas-role knobs (a `point`/`rect` 2D param exposed as a group knob). Extend `devMode.deriveGroupDef` (surface a point/rect-role binding from the child's `_expose`) + the form→child writeback (`setGroupChildParams` — widen its filter past number-only) so editing a point/rect group knob writes back to the group child like number knobs do. Reuse the existing `formWidgets` point/rect renderers. **Verify-first:** a hand-built stack with a `point` (or `rect`) param exposed as a knob → Group → click chip → the form shows the point/rect widget → edit it → writes back to the group child → survives a reprojection. Keep the suite green. **⚠ If there's a real design choice** (how a 2D widget renders/writes in the group form, or whether the canvas-preview write-back path is needed) **surface it at the gate** — propose + STOP for advisor sign-off before building that part.

**✅ GATE DECISION (advisor + human, 2026-06-27): A + B.** Your verify-first found number-role 2D knobs (point/rect as x/y fields) ALREADY edit + write back — so **A = LOCK that with a verify-first test** (a hand-built stack with a `point`/`rect` param exposed → Group → form shows the x/y fields → edit → writes back to the group child → survives a reprojection). **B = give the group form a `form2d` 2D-PREVIEW DRAG pane** — reuse the custom-op `renderLayout2D` + `layoutSpecFromOp` drag handles so the 2D group knobs are DRAG-editable on a preview canvas (drag the handle ↔ the x/y numbers update), per `spatial-gui-form-vs-canvas`. Reuses existing custom-op machinery (you confirmed NO A→B rework) + supersedes the 0×0 inline xy-pad/rect (don't support those inline). **Verify-first for B:** drag a 2D knob's handle on the preview → the group child param updates → the form numbers update → survives a reprojection. Keep the suite green. **Build A (the lock-test) first, then B** — one commit each so I review each.

**✅ A + B DONE — canvas-role gap CLOSED (advisor PASS, 2026-06-27).** A (`94d2d6c`) = a test locking the working number-role 2D knob edit+writeback. B (`fd3e941`, 7 lines of source) = `deriveGroupDef` returns `panel:'form2d'` when the group has a complete 2D knob → the group form opens two-pane with the SHARED custom-op 2D preview (`renderLayout2D` + `layoutSpecFromOp` drag handles); dragging the handle writes the bound x/y fields → writes back to the group child → survives a reprojection (real-pointer-drag test). Reuses the custom-op spatial-GUI machinery exactly as gated — no rework. **THE GROUP FEATURE IS FULLY COMPLETE + POLISHED.** **▶ NEW ACTIVE TASK = test-view sweep (human said go, 2026-06-27).** The older group specs (`group-chip`, `group-gesture`, `group-edit`, `group-auto`) use `showApp('editor')`, which does NOT un-hide the shell — only `showApp('studio')` un-hides `#studio-app` (which holds BOTH `#editor` + `#wizard`) → they run in a HIDDEN 0×0 DOM and pass only because the logic is visibility-independent (which is exactly why the form2d 0×0 bug hid until B used the real view). **Sweep them to `showApp('studio')`** (the real visible view, like `group-canvas-drag.spec.js` (B) does) so they verify the REAL render. **Verify-first:** after the swap, re-run each spec — it must still pass IN THE REAL SHELL. **⚠ GATE:** if the sweep SURFACES a real visibility-dependent bug (a spec that now fails because the visible render was actually broken), STOP — log it + `pass --to advisor` for review; do NOT fix production logic unsupervised. Otherwise: sweep → green → commit → WORK-LOG → pass back. Keep it surgical: **test-view only, no production-logic changes.**

**✅ Sweep DONE + PASS (`35ad42c`, advisor turn 4):** chip/gesture/edit/auto → `showApp('studio')`, test-view only, 343/345 green in the real shell, gate didn't trip (no visibility bug — confirms the feature renders in the real view). **▶ FINAL TASK = sweep the LAST spec (human said go, 2026-06-28).** `group-canvas-knob.spec.js` (the A test, new from the canvas-role cycle) still uses `showApp('editor')` — the last group spec in a hidden shell. **Same one-line swap → `showApp('studio')`** so EVERY group spec verifies the real view. **Verify-first:** re-run it green IN THE REAL SHELL. **⚠ GATE:** if it now fails because the A/number-role render was actually broken in the visible view, STOP + `pass --to advisor` (no unsupervised prod-logic fix). Otherwise: swap → green → commit → WORK-LOG → pass back. Test-view only, surgical. **After this, group-spec view-consistency is COMPLETE → the list is DONE.**

**✅ FINAL SWEEP DONE + PASS (`048b493`, advisor turn 6) — LIST COMPLETE, LOOP ENDED.** `group-canvas-knob.spec.js` → `showApp('studio')` (2 swaps, test-view only); 2/2 green + 343/345 full suite in the real shell. The first exit-1 was the KNOWN Playwright stale-cache collection artifact ([[playwright-stale-cache-testuse-error]]) — cleared + re-ran green, correctly diagnosed as NOT a render bug, so the gate did not trip. **ALL 6 group specs now model the real studio view — verify-real-symptom view-consistency COMPLETE.** **NO ACTIVE TASK — the loop ENDS (advisor does NOT `pass`; the worker idles on its waiter; stop its window when ready).**

**▶ NEW TASK — loop RE-OPENED (human, 2026-06-28): a hand-built group form must include the FRAMING blocks (parity with built-in ops).** The user nailed a real inconsistency. A built-in op (e.g. surfacing) is a stack that **INCLUDES `progstart`…`progend` as its own children** ([surfacingData.js:40-41](DDCS-Studio/web/blocks/dataOps/surfacingData.js#L40-L41) — `[progstart · wcs · placeonstock · stepdown · surfacefill · progend]`), so its form exposes spindle/clearance/retract alongside the body. A hand-built group **EXCLUDES** the framing — `looseRunAtLine`'s `_isLooseTop` walls off `progstart`/`progend` ([programModel.js:59](DDCS-Studio/web/blocks/programModel.js#L59)) — so the user's OWN op covers LESS than a shipped one, backwards vs the north star ("built-ins have no privilege"). **Make a hand-built group span the framing**, so its form derives the framing fields (`rpm`=spindle speed, `dir`, `spinUp`, `clearance` from progstart; `retractZ`/`park`/`end` from progend) as knobs, exactly like a built-in op. **Framing-presence is the USER's to manage — NO guardrail, no "are you sure":** for a multi-op stack they'll delete Program Start/End themselves; the tool just includes whatever blocks are in the group's span. **⚠ Verify-first (the real risk):** the framing blocks reach the form a DIFFERENT way than ordinary atoms — they're `progstart`/`progend` leaves with `fields` (program.js), not `_expose`d atoms — so confirm `deriveGroupDef` actually surfaces their fields as knobs (it may not yet; that's likely the bulk of the work). Repro on the single hand-built program from the user's screenshot (G90/M3 S12000/G0 Z5 … facing pass … M5/M9/G53/M30): group it → the form shows **spindle speed + clearance + the cut params TOGETHER** → edit one → writes back → survives a reprojection. **⚠ GATE:** dropping the `_isLooseTop` framing exclusion affects BOTH the AUTO chip AND the explicit right-click gesture (and the multi-op case). If including framing can't be cleanly scoped to the single-hand-built-program case without disturbing the explicit/multi-op gesture, STOP — surface options (A/B) + `pass --to advisor` before widening it. One commit; keep the suite green.

**✅ FRAMING-IN-GROUP DONE + PASS (`b4de899`, advisor turn 8) — LOOP DONE.** `groupLooseAtoms` spans the adjacent `progstart`/`progend` into the group (run-finder UNTOUCHED → gesture undisturbed, gate sidestepped; framing kept in position → byte-identical emit); `deriveGroupDef` auto-surfaces the framing knobs (`rpm`/`clearance`/`retractZ` — framing has no `_expose`). Verify-first `group-framing.spec.js`: real AUTO gesture → group spans framing → form shows the 3 knobs → rpm writeback (S10000→S8000) → survives reproject. 344/346. **Human confirmed (2026-06-28): the curated set (spindle/clearance/retract) is correct; the remaining framing params (`dir`/`spinUp`/`park`/`end`) STAY editable in BLOCKS, not the form.** No follow-up. **LOOP ENDED via `handoff.py done`.**

2. **Chip → form (mostly free).** Clicking the chip (`ddcsEditOp` → `wizardManager.openForEdit` → `#wiz_user` form) already works for ops; once wrapped, it comes along. Form derives from the stack's exposed knobs (the #12 `deriveAuthoredDef` / FORM-LIVE work).
3. **Knobs must persist — Gap #13 (this REOPENS #12).** Exposure (`EXPOSE_`/`PNAME_`/`WIDGET_` dev fields) RESETS on any round-trip (`devMode.js:16` — not in `fieldsOf(def)`, so `stackBridge.toRecord` drops them) → the form goes empty. Fix = serialize the exposure into `block.data` (which DOES round-trip — `stackBridge.js:101`/`:218`). Without this the chip opens an empty form.

**Verify-first (non-negotiable — the user found #11/#12/#13 by USING it, not from tests):** reproduce the exact gesture — build a stack by hand → hover its code → expect NO chip — before building; the regression must drive the REAL editor hover on a hand-built stack AND survive a reprojection (the missing step in every green-but-incomplete test this session).

**Files:** `ui/editorOpHover.js`, `blocks/programModel.js` (opAtLine/findOpInStack + wrap), `blocks/opSession.js` (commit/wrap), `wizardManager.js` (openForEdit), `blocks/devMode.js` + `blocks/blockly/stackBridge.js` (#13).

## ▶ Independent tracks (NOT blockers for the widget work)
- **`contour`-as-data EMIT port** — the LAST of the wizards-as-data trio (its design agent failed mid-run; not built).
  Surfacing-shaped (a Region reporter pill + a StepDown) → needs a dedicated flat atom like `surfacefill`, then
  `contourData.js` + `contour-as-data.spec.js`. Orthogonal to the widgets (contour's canvas GUI just rides the Stage-2 sweep).
- **Genuine BRANCHING** (probe/ATC/comm/homing, conditional-structure-dominated) — the only ports that may still need
  `iff`/`count` atoms IN the stack or wizard variants. ⚠ The first op with a VALUE-BEARING operator message (a number the
  operator confirms before acting, e.g. a probe `Probing 50mm — press Enter`) FORCES the general annotation-text atom
  (renders from a bound param) — build it THEN, not speculatively. Classify each op's messages droppable-vs-value-bearing.
- **Stage 6 self-host** (STRATEGIC #4, gated on the ports + registry): built-ins become forkable; `resetToFactory` clears `USER_*`.
- **TTF/OTF + V-carve fonts** — PARKED (user call). The font seam is in (`font` bound socket + `strokeFont` registry); a
  loader just `registerFont`s an outline font. V-carve = a SEPARATE toolpath engine (medial-axis / depth-mapped) — the big piece.

**DIRECTIVE: when a port/migration is blocked by wizard structure, ASK whether the source can change + propose restructuring
it — don't silently build machinery to preserve a structure the user doesn't care about.**

*Loose ends (optional):* round-trip **step 5** — a referential-integrity guard when a removed knobbed block is
referenced elsewhere (the corner `#1→#7/#8` case); edge-casey, deferred. More learner-library **curation** (the real
ongoing work). `filltext.align` → dropdown (value set unconfirmed). The earlier false-glow / spatial-GUI diagnosis
archive below is historical reference.

## 🗄️ Session-2 diagnosis archive (false-glow → declare-edit; SHIPPED `2789c37`, kept for reference)
**Middle false-glow bug — ✅ SHIPPED (`2789c37`, declare-edit B).** The glow/chip/merge-guard now read the user's
DECLARED edits (`opEdits.js`, recorded on the Blockly change event) instead of inferring editedness by re-derivation,
so the round-trip's representation drift can never read as a false edit. Recorder + `blocksApp` listener hook + 4
`opGlow` surfaces rewritten + `.mjson` persistence (a saved block-edit fires no reload event, so it must ride with the
program); word-level glow localizes by the old→new emit diff (no sentinel collision); ~134 lines of inference removed.
**SUPERSEDES MID #1** — the reconciler "surfaced edits are silently reconstructable → not edited" optimisation is gone
(it WAS the inference); a surfaced block-edit now correctly trips the chip (a form Replace would lose it without the
reconciler). Deleted `op-edited-reconcile.spec`; consumer specs now declare their model-injected edits. Full suite
green. **Residuals (follow-ups, NOT blockers):** (a) a pure DELETION isn't flagged (its atom id is gone — documented
in `opEdits.js`; revisit if a delete-then-Replace clobber surfaces); (b) the BENIGN emit drift itself (`G0 X#9` →
`Y0 Z0`, a no-op in incremental but latent for abs-mode single-axis moves) is unfixed — the `omitEmpty` faithful-move
fix (empty axis sockets stay unset, distinguished from a deliberate 0 via empty vs shadow) is the clean fix if wanted;
(c) the `m_both↔twoAxis` reconciler key-mismatch (reverse-sync, not the glow) still drops a real `twoAxis` form edit.
*(Original diagnosis kept below for reference.)*

**0. (superseded scoping — kept for reference)** — **FULLY DIAGNOSED + SCOPED (2026-06-26, session 2, repro'd empirically).**
- **Root = blocks round-trip is NOT representation-faithful** (the `m_both↔twoAxis` hypothesis was a RED HERRING — the
  glow hits EVERY middle config incl. single-axis, and `twoAxis` survives). `stackToWorkspace→workspaceToStack`
  NORMALIZES atom params in ≥2 ways that the clean `BUILDERS` rebuild doesn't, so the diff-based glow fires:
  - **(i) absent move axes → `0`** — `middleStack` builds `MV(ax,v)` = `{mode:'rapid', x:'#9'}` (sparse); `recToJson`
    fills the move block's empty Y/Z `value` sockets with `math_number` shadow `0`, `toRecord` reads `0` back → `G0 X#9`
    becomes **`G0 X#9 Y0 Z0`**. This one CHANGES THE EMIT (6 lines on single-axis). **Harm: BENIGN for middle** — the
    moves are after `DM('inc')` (`middleWizard.js:95`), so `Y0 Z0` = incremental no-op. Would be harmful only for a
    single-axis move in G90 **absolute** mode (latent risk for other ops).
  - **(ii) `#var` string → `variable` record** — a param like `to:'#8'` round-trips to `{type:'variable',params:…}`
    (intended #var-survival, `recToJson:206` / `toRecord:94`). Emit-EQUIVALENT but the param representation differs →
    also feeds the glow. Affects ANY op with `#var` atom params, not just middle.
  - ⇒ Making the round-trip byte-identical to the rebuild is **whack-a-mole** (0-axes, #var-records, likely more).
- **Fix fork (both real, both have costs):**
  - **(A) faithful round-trip** — only PARTIAL for the glow (fixes (i) not (ii)); and (i)'s clean fix has a tradeoff:
    a `math_number` shadow can't express "axis absent" (empty socket inline-edits as `0`, and `0` is a valid abs move).
    The clean form = move def opts into **`omitEmpty`**: `recToJson` leaves an absent optional `value` field's socket
    EMPTY (no shadow); `toRecord` OMITS an empty optional socket (no default) — this DISTINGUISHES absent (empty
    socket) from a deliberate `0` (shadow 0). Cost: unset axes show empty (draggable) sockets, not inline `0`. **This
    is a worthwhile EMIT-faithfulness fix on its own (stops `Y0 Z0`), but it does NOT fix the glow alone (ii remains).**
  - **(B) declare-edit refactor (user's call) — the right glow fix.** Glow = what the user ACTUALLY edited, not a
    representation diff, so ANY round-trip normalization is invisible. **No existing infra** — `777490a` is DOCS-ONLY;
    `saveStates.js` is full-program undo snapshots, NOT a per-op delta recorder. **Key design insight (the cheap path):
    diff the op's live children against a baseline that has been THROUGH THE SAME ROUND-TRIP** (e.g. capture the op's
    children right after insert + first reproject, persist it on the op) — the drift is then identical on both sides and
    CANCELS, leaving only real edits. (Alt: an `edited` flag set on a Blockly change within the op's subtree handles the
    WHETHER for the chip/merge-guard; the three glow surfaces' WHERE still needs the delta.) Rewire
    `isOpBlockEdited`/`editedLinesForOp`/`editedRangesForOp` (`opGlow.js`) onto it; `replayReconcile` then becomes
    secondary. ⚠️ This refactors the EDIT PIPELINE — the area that just had a live regression (`039244d`); do it as a
    focused effort, test-first (the repro: a no-edit round-trip must NOT glow; a real edit MUST), not half-landed.
- **Separate latent bug (not symptom a):** the `m_both`→`both` strip vs `middleStack`'s `params.twoAxis` (`opSession.js:184`
  / `middleWizard.js:28`) would drop a genuine `twoAxis` BLOCK edit on round-trip. Worth a one-line align regardless.

▸ **B build status (session 2 — STARTED, parked at a real design catch; user chose B emphatically):**
  - **Built (parked WIP, uncommitted):** `web/blocks/opEdits.js` — the per-op declared-edit recorder (`recordEdit`/`opEditMap`,
    keyed `opId → Map<atomId, {paramKey,from,to}>`); `tests/op-declared-edits.spec.js` — the two-direction regression
    (no-edit middle round-trip ⇒ NOT edited; a real `setFieldValue` ⇒ edited + glows). **Designed but NOT wired:** the
    `blocksApp` listener hook (record on `!e.isUiEvent && !muteChanges`, reuse `resolveHoverTarget` to map the changed
    block → its model atom + paramKey; the drift fires during MUTED reloads so it's never recorded) + the 4 `opGlow`
    surface rewrites (`isOpBlockEdited`/`editedLinesForOp`/`editedRangesForOp`/`opEditSummary` read `opEditMap`, counting
    only edits whose atom STILL EXISTS in `op.children` — so a Replace's fresh atom-ids auto-clear stale records; the
    leaf-id fix `dc581b3` keeps ids stable across the round-trip so a real edit survives it).
  - 🛑 **THE CATCH (must resolve before cutover):** pure declare-edit (live change events) **can't see a block-edit in a
    LOADED program** — `.mjson` saves the FULL stack incl. edits (`programFile.js:17`) and `ddcsLoadBlockStack` restores
    it with NO event firing. So a Replace after reload would clobber loaded block-edits, AND the 3 consumer specs that
    inject via the model (`op-edited-reconcile`, `op-header-edit-merge`, `informed-merge-notice` — all do
    `op.children=[…,{type:'raw'}]; ddcsLoadBlockStack`) would read un-edited. Inference-on-load doesn't save us either
    (it false-glows on the same drift). ⇒ **B MUST persist the declared-edit record**: serialize `opEdits` into
    `serializeProject` + restore in `loadProject` (atom-ids match — the stack is saved/loaded WITH ids). Then update the
    3 consumer specs to ALSO declare their injection (or drive it via a live gesture). Net B scope = recorder + listener
    hook + 4 surfaces + **file-format persistence** + consumer-test updates — a focused effort, not a one-sitting tail.

## ✅ Shipped 2026-06-26 (session 2)
- **Middle false-glow → declare-edit** (`2789c37`) — chip/glow/merge-guard read the user's DECLARED block edits
  (`opEdits.js`, recorded on the Blockly change event), not a re-derivation diff — so a blocks round-trip's
  representation drift can never read as a false edit. Recorder + listener hook + 4 `opGlow` surfaces + `.mjson`
  persistence; word-level glow by old→new emit diff; ~134 lines of inference removed. SUPERSEDES MID #1. Residuals:
  deletions unflagged (v1 gap); benign `Y0 Z0` emit drift unfixed (`omitEmpty` fix if wanted); `m_both↔twoAxis`
  reverse-sync mismatch open. *(Full diagnosis in the Session-2 archive above.)*
- **Hover/select → projected-code highlight** (`dc581b3` + `e309963`) — the learner feature, both granularities (user
  asked for "both"): **block hover** → its emitted lines glow lighter than selection (`.warm`, no scroll, innermost
  block via Blockly's `data-id`); **value-field hover** → the exact emitted token boxed (`.thot`) via
  `opGlow.valueTokenRanges` (perturb the socket to a sentinel, diff the re-emit — declared, no regex); **select a leaf**
  → all its value tokens boxed (`valueRangesForSubtree`, leaf-scoped — a container shows lines only, kept cheap +
  uncluttered). All from the ONE emit map (no second map). Overlays re-applied after each render (`renderCode` rebuilds
  the spans). Tests `blocks-hover.spec` (incl. innermost-resolution + mouseleave + value-token + select-to-token, all
  stress-stable) + `value-token-ranges.spec` (exact span via a non-circular splice-reconstruct + `[]`-guards). Built
  understand→implement→review across two ultracode workflows; the review's "critical `diffRange` inversion" was a
  false positive (verified — `s < max-p` precludes inversion). *DEFERRED:* value-token highlight for **container**
  selections (perf + clutter — currently leaf-scoped).
- **🐞 Pre-existing root-cause fix surfaced by the above** (`dc581b3`) — `recToJson` preserved `id: rec.id` for **op**
  blocks but **not leaf atoms**, so a stack→workspace load gave leaves fresh random Blockly ids → the panel's per-line
  ancestry (model ids) didn't match the workspace (random ids) until an async reproject realigned them. That broke
  **click-selection AND hover** on first open (a brief, self-healing transient). One-line fix (carry the leaf id);
  fixes selection too.

## ✅ Shipped 2026-06-26
- **🔴→✅ Blocks tab regression — was DEAD on a non-empty program** (`039244d`, live showstopper on `pages.dev`).
  `showBlocks()` (module scope) called `renderFromModel()`, a `buildWorkspace()` closure-local → `ReferenceError` on
  `getStack().length > 0`, swallowed by the try/catch, so the Blocks tab opened blank with any accumulated program.
  A 3-agent audit (ultracode) confirmed it's the **ONLY** such leak (no churn siblings) and caught a bug-amplifier:
  even in-scope, `renderFromModel()` was called with **no projection arg** → `renderViews(undefined)` →
  `undefined.lines`. Fix: route line 98 through **`api.refresh()`** (= `renderFromModel(getProjection())` +
  `panel.setActive`) — reachable at module scope AND supplies the projection. Test-first
  `tests/blocks-open-seeded.spec.js` (seed an insert → open Blocks → no swallowed error + program renders) — the
  exact gap the 284-green suite had (nothing exercised `showBlocks()` on a non-empty program;
  [[verify-core-flow-before-features]]). Suite 287 green. *(Minor still-open: the `Pixelated Arial` web-font fails
  OTS `cmap` decode — corrupt font asset, cosmetic.)*
- **Informed Merge/Replace modal (FORM path)** (`6f7e8fc`). The form's block-edit notice now SHOWS what a Replace
  would discard instead of a blind 3-way choice — `opGlow.opEditSummary(opId)` reuses the **same MID #1 diff**
  (`collectEdits(replayReconcile baseline, op.children)` + `emitMapped`) to render the block-only residue (injected
  lines `+`, value overrides old→new) above the buttons; `showBlockEditNotice(label, summary)` renders it (backward-
  compatible), `wizardManager.insert()` passes it. FORM only — Blocks stays silent-merge (#3). Test-first on the real
  rendered output (`tests/informed-merge-notice.spec.js`). Suite 286 green. *(Optional follow-on: a 3rd "merged
  result" preview pane.)*
- **MID #1 — One diff at 3 surfaces** (`5d348af`). `isOpBlockEdited` now means exactly "would a form Replace lose
  something?" `opSession.replayReconcile(opId)` replays the DECLARED Replace path (reconcile live blocks → params →
  `BUILDERS`), sourcing untouched form-only values (toolØ, wallOffset) from the op's **STORED params, not the DOM** —
  faithful **wizard-closed** (where the chip + Blocks-guard run); memoized by op-object identity. All three surfaces
  (`isOpBlockEdited` + `editedLinesForOp` + `editedRangesForOp`) diff against that one baseline, fail-safe to the
  stored-params rebuild where an op has no reconciler. A SURFACED edit no longer trips chip/notice/glow; an
  injection/unrepresentable residue still does. Built **test-first, wizard-CLOSED** (`tests/op-edited-reconcile.spec.js`),
  incl. a non-default-toolØ case that *forces* stored-state sourcing. Approach A held; the cycle worry
  (`opGlow→opSession→opBuilders→opGlow`) was a false alarm (`opBuilders` only *mentions* opGlow in a comment).
  `editorOpHover.js` needed no change — it consumes the re-based glow. Suite 284 green (macros-tabs known-stale).
  - 🐞 **OPEN BUG + APPROACH CORRECTION (user-reported 2026-06-26, MID #1 follow-up).** On a **middle probe** op the
    user saw: (a) **probe lines glow as edited though never touched**, and (b) **a block edit didn't survive
    round-trip**. Investigation (partial, stopped at user request — NOT fully proven):
    • `replayReconcile` rebuilds from `_builderAtoms(opType, { ...op.params, ...overrides })` where `overrides` =
      the reconciler's recovered fields with the prefix stripped (`m_axis`→`axis`). So a false glow on an UNTOUCHED
      op can only be a **recovered field that DISAGREES with the stored param** (a mis-fire), NOT a "lost field" —
      un-recovered fields correctly come from `op.params`. (Corrects my earlier "partial-rebuild smear" guess.)
    • **Confirmed candidate:** the `middle` reconciler emits `m_both`, stripped to **`both`**, but `middleStack`
      reads **`params.twoAxis`** (`middleWizard.js:28`) — so the override key doesn't match the builder param: the
      recovered value is silently dropped (→ a `twoAxis` block-edit is LOST on round-trip = symptom b) and is a
      no-op for the rebuild. `m_circular`→`circular` DOES match (`middleWizard.js:29`). Which recovered field
      actually drives the probe-line glow (symptom a) was NOT pinned before stopping — verify before fixing.
    • **APPROACH CORRECTION (user's key point):** a manual edit is a **one-time, specific** event, but MID #1
      *detects* edits by re-running the WHOLE reconciler + rebuilding the WHOLE stack + diffing — through a reconciler
      that's partial AND partly inferential. So one mis-recovered/un-recoverable field **smears glow across lines the
      user never touched** and **drops edits** the reconciler can't represent. The cleaner model: **RECORD the edit
      as a one-time declaration when it happens** (Blockly fires the change event; transactional-snapshot machinery
      exists, `777490a`) → glow = exactly the recorded deltas (no smear), round-trip carries them (no drop). I.e.
      *declare* the edit instead of *inferring* it by full-stack re-derivation. Tradeoff: re-derivation is stateless
      but needs a faithful reconciler (the failing assumption); edit-recording is precise but must catch every
      mutation path. Reconcilers ARE (disciplined, closed-world) inference — editable blocks force it — and that's
      exactly where this bites.
- **Dev-mode panel → Save dialog** (`eb70de2`). The lingering authoring panel is gone; Dev mode shows just the
  per-field "expose" affordances + a "Save wizard…" button, and name/panel-type/preview-rig are collected in a
  dismissable Save dialog at save time (stale-model guard preserved: bindings frozen from the live workspace before
  the dialog awaits).
- **Honest flat category taxonomy + Wizard UI group** (`2c6743a`). Retired the hidden `RECAT` remap (each `ops/*.js`
  declares its real category); Ops→Toolpaths, Modify→Transforms, Cutting→Spindle & Feed; the authoring blocks
  (param/region-pick/coord-list/panel/preview-rig) gathered into a new **Wizard UI** category.

*▶ **UX DIRECTION (queue → ROADMAP) — ONE Blocks mode: authoring always present, chrome subordinate. DISSOLVE the
normal/dev split entirely** (NOT "default to dev" — there's no other mode to fall back to; both the "normal" and
"dev" labels + the toggle go away, leaving just "the Blocks tab" with authoring built in. **Blocks tab ONLY** —
operators stay in the **wizards** with their clean form UI unchanged).
Rationale (user, 2026-06-26): the Blocks tab is inherently an **author + learner** surface — operators live in the
**wizards** and may never open it, so the "don't overwhelm casual users" concern doesn't apply here. Authors and
learners both need to **read the whole macro at a glance** (it's the thing raw G-code does right), so **nothing is
hidden on selection** — values + structure always visible (NOT collapse-by-default; NOT show-on-select — that was
considered and rejected as a glanceability "trap"). This supersedes the old "normal mode lets users acclimate"
reasoning. The ONLY refinement: the authoring chrome (widget-type dropdowns, expose markers) should be **visually
light / subordinate** so the code stays the thing your eye lands on — present but quiet, not competing with the
values. **What survives:** the authoring capability (expose value → knob, save-as-wizard, widget pick), always on;
glanceability, preserved by styling not a toggle. **What goes:** the toggle, the two-state split, both mode names.
**Bonus:** a simplification — one render path instead of two conditional states to keep in sync (single-source,
applied to UI).*

*(NEAR #3 — app-wide Merge/Replace/Cancel — was initially **resolved-by-analysis** (a docs-only commit, `9e37ed7`);
counter-verification refuted that: `appendIntoProgram` IS append-only (Leg 1 ✓) but the guard was NOT centralised —
a real unguarded `replaceOp` lived at `blocksApp.js:373` (header-field edits on typed op blocks), which post-dated
the notice (`4e5ce98`) and was never retrofitted. **Fix now in tree**: the listener checks `isOpBlockEdited`
(imported L18 → guard is live) and routes to `mergeOpBlocks` instead of `replaceOp`. **Verified by code-read
(2026-06-25)** — both `replaceOp` callers safe from silent clobber. Before marking DONE: (1) this path
**auto-merges SILENTLY** — no 3-way prompt like the wizard `insert()` path. **CONFIRMED INTENTIONAL (user,
2026-06-25):** Blocks is the granular surface, so a coarse dropdown change should let the granular body survive —
merge, no modal. The path is REACHABLE, not dead code: typed ops are dropdown + editable-`DO`-body hybrids
(`bridge.js:197` gives every op a `DO` statement input; `stackBridge.js:193` fills it with editable atoms), so
hand-edit-a-child-then-flip-a-header genuinely collides. (2) **COMMITTED** (`e5d808c`) — guard + test; (3) **regression test ADDED + passing** (2026-06-25) —
`tests/op-header-edit-merge.spec.js` drives the real gesture (insert edge probe → inject a `raw` body atom → flip
the `edge_op` AXIS dropdown in `__blkws`) and asserts the injected atom survives + the op stays block-edited (under
the buggy `replaceOp` both would fail). This was the OPPOSITE-case gap in `op-params-complete.spec.js` that let #3
be falsely closed the first time — now closed. **NEAR #3 is DONE.**)*

**Shipped this session:**
- NEAR #4 — Field-targeting / non-numeric param mechanism (`230245a`) — extended dev-mode's inline exposure so dropdowns, text, corner-grids, checkboxes, and coordlists become fully saved valid-by-construction wizard knobs.
- NEAR #1 — re-icon any wizard (built-ins incl.) + line-art icon picker (`ef0ee43`); shared `web/ui/wizIcons.js` registry.
- NEAR #2 — in-block ✎ editor for the coordlist positioner (`105c837`); `buildCoordEditor`/`openCoordEditor` shared by the form widget + the block ✎ affordance.

## Environment — fresh-checkout gotchas (cost real time this session)
- Git root has a **doubled `DDCS-Studio/` dir**; the npm project + app code is under `DDCS-Studio/DDCS-Studio/`. Use absolute paths — a stray relative `cd DDCS-Studio` lands you one level too deep.
- `node_modules` is gitignored → run `npm ci` **and** `npx playwright install chromium` before the suite (a bare `npx playwright test` silently fetches a mismatched throwaway and fails on `@playwright/test`).
- Running the suite churns tracked `tests/_*.png` screenshots → `git restore 'DDCS-Studio/tests/*.png'` before any release commit.
- **Release flow:** `npm run bump-version` (bumps the `.ver` chip in `web/index.html`) → push the chip change to `main` → `desktop-release.yml` builds the exe and **creates the `v<chip>` tag + release itself** (idempotent). Don't tag locally; push the bump commit as the tip (a batched push tags the wrong commit — that's how `v10.35` drifted).

## Test baseline (2026-06-25)
**279 passed, 2 skipped, 1 known-stale failing:** `macros-tabs.spec.js` (asserts the old flat-tab macros layout;
the UI is a sidebar+tree now — pending the macrosApp restructure). `middle-animator.spec.js` is flaky (passes in
isolation). The `header-responsive:47` off-by-one was a stale assertion (Copy moved to a floating button) — fixed
this session.

## Traps / rules (also in ROADMAP "Conventions")
- **Blockly v13 Class-B render trap** — a valid block model isn't drawn until the async render queue runs; load via `ddcsLoadBlockStack` and add a render-guard (`getHeightWidth().height > 0`), not just an emit assertion.
- **Valid by construction** — `BUILDERS(op.params) == op.children`; GUI param pills resolve to numbers in `instantiate` so committed ops stay clean.
- **GUI over fields** — default to a visual/canvas picker, not a text field.
- **Verify the real symptom at runtime** — a green emit ≠ a working app; reproduce the user's exact symptom in the right viewport.
- **One stack, many presentations (transparency axis)** — atom → **op** (opaque: header+knobs, for *doing*) → **snippet** (transparent: bare atoms, for *learning*) → **program** (framed, complete) → **wizard** (parameterized + form). Same IR, different fold × parameterization — windows on one truth, not different kinds of thing. A new presentation (learner library) is a *view*, not new machinery.
- **Decompose where STORED, never where COMPUTED** — an op header wraps real *stored* child blocks → divides losslessly; **toolpath atoms** (`bore/contour/drill/line/slot`) + an **`array`'s repetition** *compute* their output → exploding bakes the formula into dead moves (irreversible, severs recalc); a **probe** is stored-but-*safety-critical* (read-safe, edit-guarded). Fold-floor = wherever authored structure ends. ⇒ snippets/programs are *authored*, never auto-exploded.
- **Declare edits, don't infer them** — record the edit on the Blockly change event (`opEdits.js` → `.mjson`), never re-derive (`reconcile→BUILDERS→diff`) and diff against live (re-derivation IS inference → false-positives on round-trip drift). Companion: the live form↔block round-trip writes **surgically** to the bound socket, **never regenerates** — the form is a *pure view* of the blocks (blocks = the one truth). "Like the Matrix."
