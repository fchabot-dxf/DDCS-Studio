# PREVIEW AS DATA — survey (cycle 857 ACT 1)

**Read-only survey. No source changed. No engine built. No preview "fixed."** EMIT is 32/32 declared
(`tests/fork-parity-1593.spec.js`, `blocks/dataOps/equivalence.js:30`). FORM is 32/32 declared (the
`SEED_BUILDERS` registry sweep). PREVIEW has a *regression* gate since 2026-08-10
(`tests/node/preview-spec-gate-1688.test.mjs` — a snapshot per twin × 2 param sets) but **no declared
source of truth**: nothing stops two renderers from independently computing the same geometric fact and
disagreeing. The snapshot gate catches a *future* drift from *today's* frozen state; it does not prevent
today's renderers from already disagreeing with each other in a way nobody wrote a snapshot for. This
survey maps that gap: who draws each of the 32 twins, what each renderer reads, and where the same intent
is expressed more than once — the exact shape of "the two panes disagree" before it becomes a user report.

This document assumes `ARCHITECTURE.md`'s Q3 section ("WHO DRAWS WHAT, AND IN WHICH FRAME") as ground truth
for the *general* renderer machinery and does not re-derive it — see especially the renderer inventory, the
frame algebra, and the "three different shifts" table there. This survey adds the *per-op* layer
ARCHITECTURE.md doesn't cover: which of the 32 twins reaches which renderer, through which declared hook
(or hand-rolled name branch), and reading what.

---

## The renderer inventory (from ARCHITECTURE.md Q3 — cited, not re-derived)

| renderer | file | draws |
|---|---|---|
| WebGL 3D scene | `viz/gcodeViz3d.js` | machine-frame content on the scene; part-frame content in a `PartFrame` group shifted by `partZeroShift` |
| 2D toolpath raster | `viz/toolpath2d.js` | full mode (grid+envelope+stock+path+labels+handles) or overlay mode (path+head+pulses+chip only) |
| 2D Layout SVG | `viz/featureCanvas.js` | grid/crosshair, stock/envelope/paths/guides/holes, handles+labels+pickers — knows nothing of ops, takes a plain spec |
| lathe spec builder | `viz/latheProfileCanvas.js` | **not a renderer** — builds a FeatureCanvas spec (lathe Z→x, radius→y) |
| composer | `viz/createPreviewPanel.js` | owns ONE trace (`traceToolpath`), one execution engine, the 2D/3D toggle |
| twin spec compiler | `wizards/ops/panelTypes.js` | `layoutSpecFromOp` turns a def + live params into a FeatureCanvas spec — the ONLY source the Layout pane reads for a twin |

Two DECLARED per-op hooks already exist (confirmed live, not assumed):
- `setUserPreviewGeometry(opType, fn)` / `getUserPreviewGeometry` (`blocks/userOps.js`) — shape geometry for
  a mill op's 2D/3D preview.
- `def.simStartsProvider` — where a probe op's SIM START MARKER renders (preview-only, never emitted).

---

## Per-op survey — who draws it, what it reads, where duplicated

*(populated from a 4-way parallel file:line audit across all 32 twins, grouped by op family)*

### Probe / utility ops (8)

**A structural fact this sub-survey surfaced that the other three didn't need to** (worth stating once, up front): every one of these 8 twins has a SECOND, INDEPENDENT renderer still live — the pre-port **built-in wizard view** (`middleView.js`, `edgeView.js`, `alignmentView.js`, `rotaryCenterView.js`, `rotaryClockView.js`, `homingView.js`, `wcsView.js`) remains registered in `wizards/views/index.js` and is reached whenever an op carries its RAW built-in type (an old save file, or a Blocks-authored raw block) instead of the twin's `user_*_data` type. Only `corner`'s legacy view was actually deleted (`git log` shows a full-remove commit `cbe08b03`) — `corner_data` is the one op in this group with a single renderer. This means **6 of 8** ops in this family have a live "second truth" not exercisable from today's menu but reachable by an old file, which is exactly the shape of bug that stays invisible until someone imports a 2026-Q1 save.

**Per-op table:**

| op | who draws it (twin / legacy) | what it reads | expressed twice | broken/missing |
|---|---|---|---|---|
| `alignment_data` | Twin: declared `simStartsProvider`+`simStartParams`+`sim.seatStart`. Legacy `alignmentView.js` (menu-unreachable, file-reachable): hand-rolled DOM + `AlignVizAnimator`, delegates to the SAME `opSimStarts('alignment',…)` for position (no duplicate there) | both via `opSimStarts.js:99-108` `alignMarkersXY` | **capability gap, not a math duplicate**: legacy declares `twoPane:true` but never imports `FeatureCanvas` — a permanently blank 2D pane | legacy's 2D pane is dead space; cosmetic only since menu-unreachable, but a landmine for old files |
| `corner_data` | Twin ONLY — legacy view fully deleted. `def.simStartsProvider = cornerSimStartsProvider` (custom, chains reposition passes); 2D via a name-sniffed `cornerBind` (`panelTypes.js:573-580`) | `cornerSimStartsProvider` reads `dirsOf(cornerId)` from `cornerWizard.js:34` — the SAME sign source the emit uses (one-source, verified) | **real duplicate**: `cornerDatumXY` (`panelTypes.js:116-120`) hardcodes its OWN `{FL,FR,BL,BR}` corner map, parallel to `dirsOf()` — agree today, nothing ties them. **Orphaned 3rd copy**: `CornerWizard.inferStart` (`cornerWizard.js:424-450`) carries a THIRD hardcoded corner map, confirmed unreferenced anywhere live — a resurrection trap, not a live bug | editing a legacy `corner`-typed op is now a dead end (`open()` shows nothing) — not exercisable today, a real gap for old files |
| `edge_data` | Twin: `def.simStartsProvider` → generic `opSimStarts.js` `'edge'` case. Legacy `edgeView.js` (still registered): its OWN standalone `EdgeWizard.inferStart` formula, **never ported** into `opSimStarts.js`'s registry (unlike middle/alignment/rotary) | twin via `rowToStart`'s `minSide` rule; legacy via its own hand-written `pos ? -outset : sx+outset` | **confirmed real duplicate, 4-way**: the "pos direction ⇒ near/0 face" rule is independently hand-typed in `edgeWizard.js` (legacy start), `opSimStarts.js:228` (twin start), `edgeView.js:26` (legacy's own 2D wall glyph), AND `panelTypes.js:522` (twin's 2D wall glyph) — 4 copies, currently agree, nothing ties them | `edge` was never added to `opSimStarts.js`'s `BUILT_IN` dict — an inconsistent porting job; a raw legacy `edge` op gets NO start hint at all in the Blocks-tab generic preview, unlike its siblings |
| `middle_data` | Twin: `def.simStartsProvider`. Legacy `middleView.js` (still registered): own `renderStartCanvas`+`tieDiagTravel`+`syncStockShape`, delegates position to the SAME `opSimStarts('middle',…)` | position: shared, no duplicate. Axis order: both read the one `middleAxes()` resolver | **confirmed real duplicate**: `panelTypes.js`'s `diagAim` handle math and `middleView.js`'s `tieDiagTravel` independently re-derive the SAME "diagonal ends on ②" geometry, two hand-written formulas for one concept | **CONFIRMED REGRESSION**: `middleView.js:67-79` `syncStockShape` mutates the GLOBAL `settings.stock.shape` so the 3D scene shows a round bar for Feature=Boss+Circular — `middleData.js` declares NO `def.simStock` (unlike `rotaryCenterData.js`, which DOES, non-mutating), so opening "Middle (data)" with a circular feature no longer shows round stock in preview — it inherits whatever the global stock currently is. A real behavior loss on the twin vs. the legacy view, logged not fixed |
| `rotary_center_data` | Twin: `def.simStartsProvider` + `def.simStock` (**non-mutating** derived round-bar stock, explicit in its own comment). Legacy `rotaryCenterView.js` (still registered): delegates position to `opSimStarts` too, but its own `activateCylinderStock()` | position shared, no duplicate | **confirmed real behavioral divergence (side-effect, not math)**: legacy's `activateCylinderStock()` calls `applySettings({stock:{...}})` — a GLOBAL, PERSISTED mutation of the user's stock config; the twin's `def.simStock` explicitly avoids this (own comment: "WITHOUT mutating the global settings.stock"). Same intent, two mechanisms, materially different side effects | if the legacy view is ever reached, it silently overwrites `settings.stock` — undocumented, absent from the twin path |
| `rotary_clock_data` | Twin: `def.simStartsProvider`+`def.simStartParams`. Legacy `rotaryClockView.js` (still registered): delegates position, same pattern as rotary_center | position shared | same capability-gap pattern (legacy has no 2D canvas; twin gets full drag handles) | the `isRotaryOp`/param-name-sniff 2D gating in `panelTypes.js` already broke once for `alignment`'s reuse of the `span` param name (documented in the file's own comment) — a fragile pattern, not a live bug |
| `homing_data` | Twin: `def.simStartsProvider`+`def.statusHint`; machine-envelope backdrop via `opSimContext(...).toolMachineFrame` (declared). Legacy `homingView.js` (still registered): **hardcodes** `ctx.previewMachine(...)`/`ctx.previewToolMachineFrame(...)` directly instead of going through the shared `applyPreviewIntent`/`opSimContext` seam every OTHER legacy view in this family uses | twin reads the declared table; legacy bypasses it with 2 literal `true`s | **confirmed real duplicate**: the "mid-envelope start" formula (`{x:m.x/2,y:m.y/2,z:m.z/2}`) is independently written in `homingData.js:98-101` AND `homingView.js:88-89`, byte-identical, two files | legacy's the ONE view that reads a hardcoded literal instead of the declared table — happens to agree today, would silently NOT track a future change to `opSimContext`'s declared table |
| `wcs_data` | Neither renderer draws anything, by design — `panel:'form'` → `viz===false` → the dispatcher never enters a drawing branch | N/A | **none — the one op with zero preview on both sides, and both sides correctly agree by omission** | none — correctly "no preview" for a register-write-only op |

**Cross-cutting findings:** `def.previewGeometry` is unused by all 8 (confirmed by grep) — this family relies entirely on `def.simStartsProvider`+`def.sim`+(2 ops) `def.simStartParams` instead. `gcodeViz3d.js`/`featureCanvas.js` are fully generic for this cohort (zero opType literals in either file) — the duplication problem is concentrated one layer up, in `panelTypes.js` itself and in the still-registered legacy views. `panelTypes.js` DOES hand-sniff by param NAME and by an opType REGEX in three places (`edgeAxisBind`/`cornerBind`/`rotCenterBind`+`rotClockBind`) — opt-in-by-shape rather than a `switch(opType)`, but fragile string/regex matching, not a `def.*` field; the file's own comment documents this already misfired once (alignment's `span` binding colliding with rotary_clock's). The declared-intent seam (`opSimContext`/`applyPreviewIntent`) is itself expressed via two independently-authored `Set`/`Map` tables — one keyed on the built-in type string, one on the twin's `_data` type — correlated only by convention, not code; `homing_data`'s legacy view is the one place that bypasses the seam entirely.

### Mill cutting ops (8)

**Mechanism map (applies to all 8):**

| mechanism | declared in | consumed by | notes |
|---|---|---|---|
| `def.previewGeometry` (twin-level) | each dataOps file, `def.previewGeometry = fn` | `userOps.js:971` `setUserPreviewGeometry` → `panelTypes.js:156` `getUserPreviewGeometry` inside `_previewGeometryOf` (`panelTypes.js:152-166`) → `layoutSpecFromOp` → `FeatureCanvas.render` | the only hook drill/bore/contour/pocket/slot/surfacing/tap use; returns `{paths, handles, bbox?}` |
| `previewGeometry` (atom-level, `BLOCKS[type].previewGeometry`) | `wizards/ops/fillText.js:71-82` | same `_previewGeometryOf`, fallback branch (used only when no twin-level hook exists) | `text_data`'s sole mechanism — it never sets `def.previewGeometry` |
| `def.previewVarSeed` | `surfacingData.js:256` only | `userOps.js:972` → `userOpView.js:490-491` | not geometry — seeds live registers #790-792 for Surfacing's Skim start-marker preview trace |
| `SHAPE_2D_TYPES` (`shape_rect/circle/line/marker` blocks) | `vizBlocks.js:39-70` | `panelTypes.js:286-310` | **a third, parallel** 2D-declaration channel — unused by any of these 8 ops today |
| role-derived param groups (`xy-pad/rect/point/...`) | `userOps.js:150-185` | `panelTypes.js:220-426` | **a fourth** channel — also unused by these 8 (none of their bindings use a role-encoded widget) |
| 3D scene | `gcodeViz3d.js` | fed by `createPreviewPanel.js` | **zero references to `opType`/`previewGeometry`** anywhere — 100% generic: parses the EMITTED G-code text into segments (`createPreviewPanel.js:900-923`) and draws those. The 3D toolpath can never diverge from EMIT by construction, for any of the 8. |
| Z-depth ruler | `def.zRuler` | `userOpView.js:56-83` → `zRulerStrip.js` | reads `depthLevels(depth, stepdown)` — the SAME pass-splitting kernel the emit's StepDown atoms use (shared, good) |
| Entry marker | `def.entryPoint` (`entry.js:41`) | `userOpView.js:468-477` (3D), `:534-553` (2D) | both faces resolve via the ONE shared `firstRapidXY(previewGcode)` (`entry.js:22-31`) — no divergence risk |
| Stock-cavity backdrop | `engine/workpiece.js` `getWorkpiece()` | `panelTypes.js:277`, drawn unconditionally before any op-declared shape | a DIFFERENT fact (the global Stock modal's own cavity) from the op's own cut, but rendered with the same visual language — a pocket/bore op against a `shape:'pocket'` stock shows two conceptually-different cavity glyphs that look alike |

**Per-op table:**

| op | who draws | what it reads | expressed twice | broken/missing (logged, not fixed) |
|---|---|---|---|---|
| `bore_data`<br>`boreData.js` | 3D generic trace · 2D via `def.previewGeometry=(p)=>drillPatternGeometry(p,true)` (`:124`) · `zRuler` depth-only (`:126`) · `entryPoint` (`:125`) — all declared, no name-branch | `drillPatternGeometry` reads `p.pattern/originX/originY/holeDia/cols/rows/dx/dy/...`; imports `patternPoints()` shared with the real emit (single source, good) | none beyond the shared-function reuse (positive) | `drillPatternGeometry` never reads `p.skip` (`drillData.js:161-192`) — a hole the emit's macro OMITS (`holecycle.js:160-161,447,511-513`) still draws as a normal ring in the Layout pane. The legacy built-in Drill view does this correctly (`drillView.js:93-94` + `featureCanvas.js`'s `fc-hole-skip` strikethrough) — bore inherits the gap from drill |
| `contour_data`<br>`contourData.js` | 3D generic · 2D via `def.previewGeometry=contourPreviewGeometry` (`:140`) · `zRuler` depth+stepdown (`:142`) · `entryPoint` (`:141`) | reads `originX/originY/shape/w/h/dia/sides/side/toolDia`; calls shared `regionDesc()`/`contourRegion()` for the offset math (correctly shared) | **the shape→region-params mapping table exists 3 times independently**: `contourWizard.js:34-39` (legacy), `contourfill.js:18-24` (the atom the ACTUAL emit calls), `contourData.js:87-93` (the twin's own preview, reimplements the same dispatch a 3rd time) — logic-identical today, nothing ties them | none beyond the triplication |
| `drill_data`<br>`drillData.js` | 3D generic · 2D via `def.previewGeometry=(p)=>drillPatternGeometry(p,false)` (`:203`) · `zRuler` depth-only (`:205`) · `entryPoint` (`:204`) | `drillPatternGeometry` (`:161-192`), the ORIGINAL source `bore_data` imports — good single-source precedent | `patternPoints()` shared with real emit (good) | same `skip`-not-drawn gap as bore (drill is the origin of the shared function) |
| `pocket_data`<br>`pocketData.js` | 3D generic (also drives the heightmap carve from the same trace, `gcodeViz3d.js:1889-1893`) · 2D via `def.previewGeometry=pocketPreviewGeometry` (`:386`) · `zRuler` depth+stepdown (`:388`) · `entryPoint` (`:387`) | for `spiral`, draws real `concentricRings(...)`/`restRegion(p)` — genuinely shared with `pocketfill.js`/`restmachining.js` | **strongest triplication in the survey**: `pocketWizard.js:31-36` `trueRegionParams()` (feeds real structural guards), `pocketfill.js:38-44` `trueRegionFromFlat()` (feeds the real EMIT), `pocketData.js:254-268` (the twin's OWN inline per-shape dispatch, reused by neither of the other two) — the twin's `deriveGuards` correctly reuses the wizard's helper, but its PREVIEW boundary does not reuse either | raster strategy only draws the outer boundary, no zig-zag scan lines (spiral gets full concentric-ring preview) — asymmetric preview detail, not incorrect |
| `slot_data`<br>`slotData.js` | 3D generic · 2D via `def.previewGeometry=slotPreviewGeometry` (`:261`) · `zRuler` depth+stepdown (`:263`) · `entryPoint` (`:262`) | reads `ax/ay/bx/by/toolDia/width` directly | the perpendicular-offset formula (`nx=-dy/len, ny=dx/len`) is independently re-written in `slotData.js:147-148`, byte-identical to `slot.js:58` but not calling it — a 2-line duplicate, low blast radius today | **the only one of the 8 that returns no `bbox`** (`slotData.js:163`) — `panelTypes.js:260-262` documents this as required when the preview frame differs from the emit frame; slot's own doc says it's usually fine (opt-in placement), but it's unverified against the placement-parity contract every sibling explicitly satisfies |
| `surfacing_data`<br>`surfacingData.js` | 3D generic · 2D via `def.previewGeometry=surfacingPreviewGeometry` (`:255`) · `zRuler` depth+stepdown (`:258`) · `entryPoint` (`:257`) · `previewVarSeed=startMarkerVarSeed` (`:256`, unique to this op) | Skim start-marker target resolved through ONE declared table `START_MARKER_TARGET`/`startMarkerTarget()` (`:176-180`), explicitly shared with the legacy view's `buildSurfacingSpec` per its own `t1650` comment | **none found — cleanest of the 8** | none found |
| `tap_data`<br>`tapData.js` | 3D generic · 2D via `def.previewGeometry=tapPreviewGeometry` (`:93`) · `entryPoint` (`:94`) · **no `def.zRuler`** | draws a decorative ring, explicitly commented "not to scale" (`:69`) | none — trivial point geometry | **missing Z ruler**, inconsistent with its own sibling shape: tap has the identical "single depth, no stepdown" shape as drill/bore, both of which DO get `def.zRuler` (depth-only) — tap never sets it despite binding a plain `depth` param the ruler mechanism handles |
| `text_data`<br>`textData.js` | 3D generic · 2D via the ATOM-level fallback (`BLOCKS['filltext'].previewGeometry`, `fillText.js:71-82}` — `textData.js` sets no `def.previewGeometry` at all) · `entryPoint` (`:139`) · **no `def.zRuler`** | atom's hook calls `layoutText(p)` (`textGeometry.js:29`) directly on twin params (no rename risk since it's the atom's own field names) | preview draws bare centrelines (`layoutText(p).strokes`); the real cut/extent instead uses `textContours(p)` which INFLATES those same strokes by `strokeWidth/2` — not an independent duplicate (both call `layoutText` internally) but the drawn shape isn't the true cut boundary for thick strokes (mitigated by a separate `statusHint` warning) | **missing Z ruler**, same gap class as tap — binds `depth`/`stepdown` (same StepDown shape as slot/contour/pocket/surfacing) but never wires `def.zRuler` |

**Pattern summary:** the renderer *wiring* for this family is clean — all 8 reach a single declared channel (`previewGeometry`, twin- or atom-level), dispatched through one function with zero per-op-name branches in `FeatureCanvas`, and the 3D pane never touches `opType` at all (it renders whatever the actual G-code parses into, so 3D can never diverge from EMIT by construction). **The real duplication risk lives one level down, inside the previewGeometry functions themselves**: best case, they call the emit's own kernel (contour's offset math, pocket's rings/rest-region, drill/bore's hole pattern, surfacing's marker table, text's letter layout) and cannot drift; worst case (pocket's and contour's shape-dispatch tables, independently expressed 2-3 times each; slot's 2-line offset formula) a future change in only one copy would silently desync the Layout pane from what actually gets cut. A second, distinct pattern is missing-declaration-completeness rather than wrong data: drill/bore's `skip` param not affecting the preview, and tap/text missing `def.zRuler` despite having the exact param shape their siblings declare it for.

### ATC / utility ops (9)

**The mechanism (applies to all 9):** `userOpFromStack(opType, label, stack, bindings, panel, sim, group)` — `panel` (5th arg, string) and `sim` (6th arg, options object). At registration, `resolvePanelMeta`/`resolveSimMeta` (`userOps.js:294-321`) each let a `{type:'panel'/'sim', params:{...}}` block EMBEDDED IN THE STACK win over the positional argument. `opSimContext(opType)` (`opSimContext.js:70-84`) is the single declared intent reader; `applyPreviewIntent(mgr, containerId, opType)` (`wizards/views/atcViews.js:97-111`) is **the one function both the built-in ATC views and the generic twin view call** to push intent onto a panel (`previewMachine`/`previewToolMachineFrame`/`previewMagazine`/etc., `wizardManager.js:589-632`) down to `viz.setMagazine` (`gcodeViz3d.js:2203-2253`). **Zero opType-name branches anywhere in `gcodeViz3d.js`/`createPreviewPanel.js` for these 9 ops** — confirmed by grep.

Two corrections to the task's own hypotheses, verified rather than assumed: `viz/atcSetupCanvas.js` is **not** a per-op preview renderer — it's the Settings→ATC *teaching* canvas (drag pockets/pickup points), imported only by `settingsPanel.js`. And `previewGeometry`/`simStartsProvider` are confirmed **unused** by all 9 (grep of every relevant dataOps file, zero hits).

**Per-op table:**

| op | panel/sim (positional vs. stack block) | who draws it | mechanism | what it reads |
|---|---|---|---|---|
| `atc_change_data` | `'form3d'`/`{forceMachine,showMagazine,toolMachineFrame}` vs. stack `'form3d'`/`{magazine,toolMachine}` (`:139` vs `:62-63`) | 3D scene incl. magazine | declared (`opSimContext`) | intent from the STACK block (not positional — see duplicate #1); magazine pockets from LIVE `settings.atc` via `magazinePockets()`, not the op's own params |
| `atc_check_data` | `{forceMachine:true}` vs stack `{machine:true,magazine:false}` | 3D scene only, no magazine | declared | live emit trace |
| `atc_length_data` | same shape as atc_check | 3D scene only | declared | live emit trace |
| `atc_table_data` | `{forceMachine,showMagazine,toolMachineFrame}` vs stack `{magazine,toolMachine}` | 3D scene incl. magazine | declared | live emit trace; magazine from live settings, **independent of the op's own `includePockets` toggle** (see broken/missing) |
| `atc_test_data` | same shape as atc_table | 3D scene incl. magazine | declared | live emit trace; magazine independent of the op's own `first`/`count` range (see broken/missing) |
| `atc_warmup_data` | `{forceMachine,showMagazine:true}` vs stack `{machine:true,magazine:true}` | 3D scene incl. magazine (context only — warmup moves no tool) | declared | live emit trace + live magazine |
| `comm_data` | `'commscreen'` (both copies agree) | `.comm-screen-host` DOM mock, **not** the 3D/2D pane at all | declared via panel KIND (`userOpView.js:603-613`) → `CommunicationWizard.generateScreenPreview(params)` | live FORM PARAMS directly (`type/msg/popupMode/statusMode/statusColor/val/cycle`) — not the emitted G-code |
| `io_step` | `'form'`, no sim | **NONE** | N/A — `panelType('form').viz===false`, the dispatcher chain has no branch for `mode===null` | N/A |
| `pause_confirm` | `'form'`, no sim | **NONE** | N/A, same shape as io_step | N/A |

`io_step`/`pause_confirm` confirmed genuinely preview-less by tracing the dispatcher chain itself (`userOpView.js:462-613`'s `if/else if` has no `mode===null` arm) — not an oversight, the correct shape for pure control-flow atoms with no spatial geometry.

**Duplicates found:**
1. **Sim intent declared twice, in two DIFFERENT vocabularies, and the positional copy is dead** — every ATC stack embeds a `sim` block AND the `userOpFromStack` call passes an equivalent-but-differently-KEYED options object (`forceMachine/showMagazine/toolMachineFrame` positionally vs. `machine/magazine/toolMachine` in the block). The stack block ALWAYS wins (`resolveSimMeta`, `userOps.js:299`). Unlike `panel` (whose resolved value IS written back into `def.panel`, self-correcting), **`def.sim` is never reconciled and stays permanently stale** — the object a developer would actually edit is silently disconnected from what renders. Harmless today only because both copies were hand-kept in sync.
2. Panel type also declared twice (positional + stack block) — lower risk, both copies are the same literal string and the winner IS written back.
3. **Comm message-formatting regex duplicated 3×**: `fmtCtrl`/`fmtLine` module-scope in `communicationWizard.js:11-12` (real emit) AND byte-identically re-defined in `commData.js:19-20` (twin recompose) AND re-implemented AGAIN as class methods in the SAME `communicationWizard.js` file (`:260-280`, feeding only the preview).
4. The "persistent status" magic number `-3000` tested independently in 3 places (emit, twin recompose, preview) — all must independently agree it means "persistent."
5. The beep pulse-count formula duplicated in 2 places to keep a COMMENT STRING in sync between emit and twin-recompose; the preview shows a differently-worded equivalent that doesn't even textually match either.
6. **The ATC magazine's pocket list is computed by two genuinely DIFFERENT code paths depending on which host renders it** — the single-op wizard preview shows EVERY configured pocket including empty ones; the whole-program preview (Blocks tab) filters out any pocket with no tool assigned. Same declared intent (`showMagazine`), two different pocket-list computations — a magazine will visibly differ between an op's own wizard and a program view containing it.
7. `atc_change_data.def.simGcode` is an explicitly DECLARED second source of truth (the automatic-method preview animates a synthesized `motionToSimGcode`, not the real bare `T# M6` emit) — an intentional, documented divergence, flagged as exactly the class this survey exists to catalog even though it's not a bug.

**Broken/missing (logged, not fixed):** the 2D toolpath pane never draws the ATC magazine for ANY host (`setShowMagazine` never forwards to the 2D canvas, unlike `setToolMachineFrame` which does) — toggling any magazine-showing ATC op to "2D" silently drops the magazine with no 2D equivalent. `showMagazine` is a per-opType CONSTANT never conditioned on the op's own resolved params — `atc_table_data` with `includePockets=false` (which emits no pocket writes at all) still renders the full magazine. `atc_test_data`'s `first`/`count` sub-range selection isn't reflected in the static magazine render (only the animated trace shows which pockets are actually visited). `comm_data`'s declared `sim={}` is triply inert (empty, shadowed, and never even read for `commscreen` mode). The commscreen mock only exists in the single-op wizard view — a `comm_data` op inside a whole program traces as ordinary G-code with no popup mock anywhere else.

**Pattern summary:** this is the cleanest-architected slice of the whole survey — one declared table (`opSimContext`) and one declared apply function (`applyPreviewIntent`) shared byte-for-byte between built-ins and twins, zero per-opType branches in any renderer. The task's own hypothesis about `atcSetupCanvas.js` was wrong (confirmed, not assumed) — worth noting as a caution against trusting a filename. The most consequential finding is the dead positional `sim` argument (#1): a real double-declaration where one copy always wins silently and the OTHER is never reconciled, unlike the analogous `panel` case which self-heals.

### Lathe ops (7)

**`withLatheScene(def, fallback, tool='turning', probeAxis=null)` (`viz/latheScene.js:101-106`) — what it actually declares:**
Three plain fields: `def.simStock = (p,stock)=>latheSimStock(p,stock,fallback)` (`:102`, builder `:63-91`) — a real declared shape hook, but scoped ONLY to the stock/blank cylinder (the same generic mechanism mill rotary ops also use — `getUserSimStock`/`setUserSimStock`, `viz/opSimStarts.js:176-177` — not lathe-exclusive). `def.latheTool = tool` (`:103`) — a plain string, read only as a **fallback default**, not a source of truth. `def.latheProbeAxis` (`:104`, probes only).

**There is no declared hook for the CUT/FEATURE geometry at all** — neither 3D nor 2D. Lathe ops never reach `previewGeometry`/`_previewGeometryOf`: `layoutSpecFromOp` (`panelTypes.js:168-174`) checks `latheLayoutSpec(...)` FIRST and returns immediately if non-null, before the mill mechanism is ever consulted. The 2D picture is chosen by a **hardcoded 6-armed regex on `def.opType`** inside `latheLayoutSpec` (`latheProfileCanvas.js:128-161`: `/facing/`, `/parting/`, `/centerdrill/`, `/polygon/`, `/faceprobe/`, `/odprobe/`, else the OD-turn default) — a per-op NAME branch, not a declared geometry function. The 3D CUT shape is different again: not declared, but also not hand-duplicated — `gcodeViz3d.js`'s carve (`_latheCarve`, `:1845-1889`) replays the TRACED G-CODE against the bar profile, so it structurally can't diverge from emit (it *is* the emit, simulated). What IS hand-duplicated in 3D is the **tool mesh** (see cross-cutting §A below) — no declared per-op/per-kind shape hook exists for it at all; `_buildLatheTool` (`gcodeViz3d.js:725-749`) hardcodes two fixed meshes regardless of which op or which tool is picked.

**Per-op table:**

| op | who draws | what it reads | expressed twice | broken/missing (logged, not fixed) |
|---|---|---|---|---|
| `lathe_odturn`<br>`odTurnData.js` | 3D via `def.simStock`+fallback `latheTool` · 2D reached by regex NON-match (falls to the default arm, `odProfileSpec`, `latheProfileCanvas.js:190-247`) | 2D reads live params (`barDiameter/targetDiameter/endDiameter/depth`) directly, NOT via `odTurnStack`'s own pass math | **finished-shape formula written twice**: emit's `odPasses`/`odPassExtent` (`wizards/lathe/odTurn.js:120-162`) vs canvas's independent `targetR/endR/zEnd` recompute (`latheProfileCanvas.js:196-216`) — numerically agree today, structurally unlinked | tool-identity bug (cross-cutting §A) applies |
| `lathe_facing`<br>`facingData.js` | 3D same · 2D regex `/facing/` → `latheProfileSpec` (`:50-86`) | reads bound `allowance` only; draws via shared `halfProfile(bar)` (`data/lathe.js:147`, genuinely shared) | **none** — lowest-risk op in the family, single bound field | none beyond §A |
| `lathe_parting`<br>`partingData.js` | 3D same (tool arg **not overridden**, stays `'turning'`) · 2D regex `/parting/` → `partProfileSpec` (`:269-310`) | canvas independently computes `zBlade=zFace-width`, `floorR` | **confirmed 3-way duplicate**: emit declares `partBladeZ`/`partFloorRadius` explicitly "so the emit and tests cannot disagree" (`wizards/lathe/parting.js:76-93`), the macro computes the SAME kerf offset AGAIN in G-code (`parting.js:148`), and the canvas is a THIRD independent re-derivation (`latheProfileCanvas.js:277`) calling neither | **a real gap**: `toolProfiles.js` declares a distinct `parting` blade silhouette (`:38`) and the tool table has a first-class `parting` kind (`data/latheTools.js:47-51`), but `gcodeViz3d.js:555` only recognizes `'turning'`/`'centerdrill'`/`'probe'` — there is NO `'parting'` scene-tool branch, so a parting op's 3D tool is the same generic 93° insert box as OD turning, never the blade shape |
| `lathe_polygon`<br>`polygonData.js` | 3D same · 2D regex `/polygon/` → `polygonProfileSpec` (`:512-565`) | **the one correctly-declared case**: calls `polygonPath({acrossFlats,sides,segmentsPerFace})` imported directly from `wizards/lathe/polygon.js`, explicitly documented "the SAME function the emit unrolls" (`:508-511`) | **none found — the positive exception**, held up by the file's own comments as the model to follow | tool-mesh genericness (§A); axis-mode gating is a separate mechanism, out of this survey's scope |
| `lathe_centerdrill`<br>`centerDrillData.js` | 3D via `latheTool='centerdrill'` override (only non-probe op that overrides) · 2D regex `/centerdrill/` → `drillProfileSpec` (`:316-341`) | canvas draws `holeR=barR*0.06` to `-depth` from the live `depth` param — no formula duplication, just a param pass-through (low risk) | emit declares `drillDepths(p)` (per-peck bottoms, `wizards/lathe/centerDrill.js:63-72`, "derived HERE...") but canvas never calls it — low severity since only the overall extreme is needed and IS read from the same param | **the concretely-verified tool-identity bug lives here**: `withLatheScene` passes American `'centerdrill'`, matching `gcodeViz3d.js:555`'s fallback check — but the tool-library kind id is British `'centredrill'` (`data/latheTools.js:52-56`). `centredrill`/`drill` are the ONLY lathe kinds that populate a `dia` fact, so they're the only kinds for which `userOpView.js`'s table-tool branch fires (`:362-366`) — and when it fires, it reads `_tbl.type` (always `''` for a lathe row — the lathe table only ever writes `data-field="kind"`, never `"type"`, `settingsPanel.js:2717-2739` vs `:2825`), yielding `type:'endmill'`. **Picking a real centre-drill tool from the library silently renders as a flat mill endmill under a full mill spindle assembly** — contradicting the op's own declared `latheTool='centerdrill'`, which only "wins" when NO tool is picked at all |
| `lathe_faceprobe`<br>`faceProbeData.js` | 3D via `latheTool='probe', probeAxis='z'` → `_buildLatheProbe` (`gcodeViz3d.js:698-720`), fed by `latheProbeTool()` (`latheScene.js:127-142`) · 2D regex `/faceprobe/` → `faceProbeSpec` (`:427-456`) | both read `ahead`/`tipRadius` directly — no derived-geometry duplication needed, the op has no shape beyond the one bound number | **probe stylus SIZE computed twice by unrelated formulas**: 3D's `latheProbeTool` derives `ball=max(0.2,tipRadius)*2` scaled off bar radius; 2D's `touchMarker()` (`latheProfileCanvas.js:411-420`) independently sets `max(0.4,tipRadius)` with no relation to the 3D formula — not numerically comparable (one's a mesh, one's schematic) but the same underlying "how big does the stylus draw" fact, expressed twice, unshared | cross-cutting §B (stock predicate) applies |
| `lathe_odprobe`<br>`odProbeData.js` | same mechanism as faceprobe, `probeAxis='x'` · 2D regex `/odprobe/` → `odProbeSpec` (`:463-492`) | reads `caliperDiameter`/`tipRadius` directly | same probe-size duplication as faceprobe | cross-cutting §B applies |

**Cross-cutting findings (span most/all 7 ops):**

- **§A — the tool-identity fact has (at least) 3 independent declarations, one dead, one wrong.** (1) `def.latheTool` — the op's declared fallback identity. (2) The tool table's own `kind` field — the REAL per-tool identity a user picks, but `userOpView.js:361-366` reads `_tbl.type` (the MILL field, always `''` on a lathe-authored row) instead of `_tbl.kind` — so a picked tool either silently no-ops (turning/parting kinds, whose `dia` fact is never populated) or actively mis-renders (centredrill/drill kinds — see the centerdrill row above). (3) `createPreviewPanel.js`'s `simTool()` fallback (`:753-763`) — a THIRD, independent re-declaration via a hardcoded `/centerdrill/` regex on opType, unlinked to `def.latheTool`. (4) **Dead API**: `gcodeViz3d.js`'s `setLatheTool(kind)` (`:752`, doc-commented "DECLARE which tool this op shows") has ZERO call sites anywhere — the live path is the entirely different `setSimTool()`/`simTool()`. (5) The 3D mesh never reads the tool table's own authored silhouette (`viz/toolProfiles.js`, self-documented "DRAWN (3D+2D)") at all — `gcodeViz3d.js` never imports it (confirmed by grep); `_buildLatheTool` hardcodes one fixed insert-box for every `'turning'`-typed op (odturn/facing/parting/polygon are visually IDENTICAL in 3D) and one fixed cone+cylinder for centerdrill.
- **§B — "is this stock a lathe bar" is tested 4 separate times with 4 non-identical predicates**, co-extensive only by accident today: `gcodeViz3d.js:1837-1840` checks `shape/axis/origin`; `latheScene.js:177` matches (same 3 fields); `latheDro.js:44-48` checks `shape/axis/datum` (a DIFFERENT third field); `latheProfileCanvas.js:101` checks `shape` alone (weakest, no axis/origin/datum at all).
- **§C — there is no separate "lathe renderer" to swap in.** One shared `GcodeViz3D` class (`gcodeViz3d.js`) serves both mill and lathe, branching internally on `_isLatheStock()`/`isLatheWorkspace()`; the 2D "layout pane" is the same `FeatureCanvas` class for both machines — only the SPEC fed to it differs.
- **§D — `LATHE_GROUP` has nothing to do with preview rendering** — it only affects command-bar menu placement (`wizardLibrary.js:241`) and the Blockly palette category colour (`opToolbox.js:54`). Zero readers in any renderer file.

**Pattern summary:** the "does this op get a lathe picture at all" question is properly declared (`def.simStock`, `def.layout.kind`). Everything past that is per-op NAME dispatch (`latheLayoutSpec`'s 6-armed regex; the tool mesh's 2-armed type switch). The single most consequential, concretely-verified bug in the ENTIRE 32-twin survey is here: selecting a real centre-drill/drill tool from the library silently swaps the 3D preview to a flat mill endmill under a mill spindle assembly, because a field-name mismatch (`_tbl.type` vs `_tbl.kind`) reads the wrong property off the picked tool row. The second pattern is the SAME formula-duplication class the mill survey found (`odPasses`/`partBladeZ`/`drillDepths` each declared once for the emit, then independently re-derived for the 2D canvas) — polygon is the one clean counter-example, explicitly held up in the file's own comments as the model to follow.

---

## The duplicate-intent list, ranked by drift likelihood

Ranked by: has it ALREADY drifted (top) > how many independent copies exist > whether the copies live in different files/modules (owned separately) > whether a wrong number would reach a machine vs. just look wrong on screen.

### Tier 0 — already diverged, live today (not a risk, a fact)

1. **`middle_data`'s round-stock preview is a confirmed regression.** The legacy view's `syncStockShape` (`middleView.js:67-79`) mutates the 3D scene's stock shape to round for Feature=Boss+Circular; the twin declares no equivalent (`middleData.js` has no `def.simStock`, unlike `rotaryCenterData.js` which does this correctly and non-destructively). Opening "Middle (data)" today shows the WRONG stock shape in preview. *(probe survey)*
2. **`rotary_center_data`'s legacy view silently mutates persisted `settings.stock`**; the twin's `def.simStock` explicitly avoids this (own comment: "WITHOUT mutating the global settings.stock"). Same declared intent, two mechanisms, materially different — and surprising — side effects. *(probe survey)*
3. **The lathe tool-identity bug**, the single most consequential finding in the whole survey: picking a real centre-drill/drill tool from the library silently renders the 3D preview as a flat mill endmill under a mill spindle assembly, because `userOpView.js:361-366` reads `_tbl.type` (always `''` on a lathe-authored row) instead of `_tbl.kind`. *(lathe survey)*
4. **The ATC magazine's pocket list disagrees between hosts right now**: a single-op wizard preview shows every configured pocket (including empty ones); the whole-program preview filters to only tool-assigned pockets. Same declared `showMagazine` intent, two different computations, visibly different pictures. *(ATC survey)*

### Tier 1 — 3+ independent expressions of one fact (not yet diverged, structurally fragile)

5. **`pocket_data`'s shape→region-params dispatch table**, independently written 3 times: `pocketWizard.js:31-36` (feeds real structural guards), `pocketfill.js:38-44` (feeds the real emit), `pocketData.js:254-268` (the twin's own preview, reuses neither). The strongest triplication in the mill survey.
6. **`contour_data`'s shape→region-params table**, the same pattern, 3 independent copies (legacy wizard / the atom the emit calls / the twin's preview).
7. **`edge_data`'s "pos direction ⇒ near/0 face" rule**, hand-typed independently 4 times across `edgeWizard.js`, `opSimStarts.js:228`, `edgeView.js:26`, and `panelTypes.js:522`.
8. **`lathe_parting`'s kerf-offset formula** (`zFace − width`), declared once explicitly "so the emit and tests cannot disagree" (`parting.js:76-93`), computed again in the macro's own G-code (`parting.js:148`), and re-derived a third, independent time by the 2D canvas (`latheProfileCanvas.js:277`), which calls neither declared helper.
9. **`comm_data`'s message-formatting regex** (`fmtCtrl`/`fmtLine`), independently defined at module scope in TWO files and re-implemented a third time as class methods in one of them, for the preview alone.
10. **The ATC `sim` intent is declared twice, in two DIFFERENT key vocabularies** (positional argument vs. embedded stack block), and — unlike the analogous `panel` case, which self-heals — the positional copy's resolved value is never written back into `def.sim`, so it stays permanently, silently stale. The "most consequential, least obvious" finding in the ATC survey precisely because nothing about it looks wrong until someone edits the wrong copy.

### Tier 2 — 2-copy duplicates, real but lower blast radius today

11. `slot_data`'s perpendicular-offset formula, byte-identical but independently written, 2 files (`slot.js:58` vs `slotData.js:147-148`).
12. `homing_data`'s mid-envelope start formula, byte-identical, 2 files (`homingData.js:98-101` vs `homingView.js:88-89`).
13. `corner_data`'s `cornerDatumXY` hardcoded corner map vs. `dirsOf()` — 2 live copies, plus a 3rd, confirmed-orphaned dead copy in `cornerWizard.js:424-450` (a resurrection trap if that code is ever reconnected).
14. `lathe_odturn`'s finished-shape formula (`targetR`/`endR`/`zEnd`), independently re-derived by the 2D canvas instead of calling the emit's own declared `odPasses`/`odPassExtent`.
15. The lathe probe-stylus SIZE, computed by two unrelated formulas (3D mesh vs. 2D schematic marker) for the same "how big is the declared stylus" fact.
16. "Is this stock a lathe bar" tested by 4 independent, NON-identical predicates (different field sets each), co-extensive only by accident today.
17. ATC's "`-3000` means persistent status" magic number, independently tested for equality in 3 places.
18. ATC's beep pulse-count formula, duplicated in 2 places to keep a *comment string* in sync — and a 3rd, differently-worded version in the preview that doesn't even textually match.
19. `text_data`'s preview draws bare centrelines while the real cut/extent inflates the same strokes by `strokeWidth/2` — not an independent duplicate (both call `layoutText` internally) but a genuine visual-vs-cut shape mismatch for thick strokes.

### Tier 3 — capability gaps (a feature exists on one renderer path and not the other — the SAME risk class: a future fix in one path never reaches the other)

20. **6 of 8 probe/utility ops carry a full second renderer** — the pre-port legacy built-in view — still registered and reachable the instant an op carries its raw built-in type (an old save file, a Blocks-authored raw block) instead of the twin's `user_*_data` type. Only `corner`'s legacy view was actually deleted.
21. `drill_data`/`bore_data`'s `previewGeometry` never applies the `skip` param — a hole the emit's own macro omits still draws as a normal hole in the Layout pane, even though the correct rendering already exists and is used by the legacy built-in Drill view.
22. `tap_data`/`text_data` never wire `def.zRuler` despite binding the exact same depth/stepdown param shape their siblings declare it for.
23. `lathe`'s `gcodeViz3d.js`'s `setLatheTool(kind)` — doc-commented "DECLARE which tool this op shows" — has zero call sites anywhere; the live path is an entirely different, differently-named mechanism (`setSimTool`/`simTool`). Dead API, not dead risk — but exactly the shape of thing that gets "fixed" by someone who finds it and doesn't realize it's already bypassed.
24. The 2D toolpath pane never draws the ATC magazine for any host — `setShowMagazine` doesn't forward to it, unlike `setToolMachineFrame` which does, and `toolpath2d.js` has no magazine-drawing code at all.

---

## Candidate declaration shape (data, not machinery)

### The one pattern that separates every "good" case from every "bad" case in this survey

Across all 24 duplicate-intent findings above, the dividing line is never *whether* a declared hook exists —
most ops in this survey already have SOME preview hook (`previewGeometry`/`simStartsProvider`/`simStock`/`sim`
intent). The dividing line is whether that hook's **implementation calls the same function the emit calls**, or
independently re-derives the same fact by hand next to it:

- **Good** (never drifted, cited repeatedly as the model): `drill_data`/`bore_data` both call the literal
  `patternPoints()` the emit uses (bore even imports it FROM drill's own module); `pocket_data`'s spiral strategy
  calls the real `concentricRings`/`restRegion`; `lathe_polygon`'s canvas imports and calls `polygonPath()`
  "the SAME function the emit unrolls" (its own words); `surfacing_data`'s Skim marker target is one declared
  table read by both twin and legacy view; every probe op's *position* math (once ported into `opSimStarts.js`)
  is a single shared function no matter which renderer asks.
- **Bad** (already drifted, or one edit away from it): `pocket_data`/`contour_data`'s shape-dispatch tables,
  independently hand-typed 2-3 times each; `edge_data`'s "pos ⇒ near face" rule, 4 independent copies;
  `lathe_parting`'s kerf formula, 3 copies; `middle_data`'s round-stock preview, which is ALREADY WRONG because
  the twin declares no equivalent to the legacy view's stock-shape sync at all.

**This means ARCHITECTURE.md's own Invariant #7 — "one function, not two copies of a value that currently
agree" — is already the exact rule this survey needed. What's missing is not a new invariant; it's making that
rule CHECKABLE for preview code specifically**, the way it already is for `getTransform()`/`_disp` (guarded at
`featureCanvas.js:83,383`). A snapshot test (the existing preview gate) freezes *output* — it cannot tell a
hand-typed duplicate that currently agrees from a genuine single source, because both produce the same snapshot
today. Only the *reference identity* of the function called can tell them apart.

### The candidate shape

Not a new rendering engine, not a new file format — a **declared pointer from the preview hook to the emit
kernel function it must reuse**, so a hook's *implementation* is either (a) a bare re-export/call of an
already-declared emit function, checkable by reference identity, or (b) explicitly marked as an independent
computation with a stated reason (mirroring how `tokenDeferrable`/`socketHeld` etc. already mark an intentional
exception rather than silently drifting from the default rule elsewhere in this codebase).

```js
// on the def, alongside the EXISTING previewGeometry/simStartsProvider/simStock/sim fields —
// this does not replace any of them; it is a DECLARED CONSTRAINT on how they may be implemented.
def.previewSources = {
  // key: the NAME of the fact this preview hook computes (free text, for humans + a future lint)
  // value: the SAME function reference (import, not re-type) the emit path calls for that fact
  region:  regionDesc,          // pocket/contour: point at wizards/ops/region.js's regionDesc, not a local copy
  pattern: patternPoints,       // drill/bore: already true today — this just makes it a declared, checked fact
  kerf:    partBladeZ,          // lathe_parting: point at wizards/lathe/parting.js's own declared helper
};
```

A **generic**, one-time-built checker (not built this act, per the dispatch's own "do not build the reader") could
then assert, for every twin: does `previewGeometry`'s source (or `previewSources`'s declared value) reference-equal
a function the emit path also imports? If an op's preview hook computes a fact with no `previewSources` entry
naming where it came from, that is exactly the unlabeled-duplicate risk this survey exists to catch — the SAME
"declared key has a reader" shape ARCHITECTURE.md's Invariant #4 already uses (`declared-key-coverage-1678.test.mjs`),
turned around: here the check is "a computed fact has a declared *source*," not "a declared key has a *reader*."

### Three worked examples (probe, mill, lathe — by character, not by ease)

**Probe — `corner_data`.** Today `cornerDatumXY` (`panelTypes.js:116-120`) hardcodes its own
`{FL:{x:0,y:0}, FR:{x:stock.w,y:0}, ...}` map, parallel to `dirsOf()` (`cornerWizard.js:34`) which the EMIT
reads for the same fact — plus a third, orphaned copy in `cornerWizard.js:424-450`. The declaration:
```js
// cornerData.js
const CORNER_MAP = { FL: [0,0], FR: [1,0], BL: [0,1], BR: [1,1] };   // ONE source, {x:frac*stock.w, y:frac*stock.h}
export function cornerDatumXY(corner, stock) {
  const [fx, fy] = CORNER_MAP[corner] || CORNER_MAP.FL;
  return { x: fx * stock.w, y: fy * stock.h };
}
def.previewSources = { datum: cornerDatumXY };
```
`dirsOf()` (the emit's sign source) and `panelTypes.js`'s corner-click targets both import and call
`cornerDatumXY` instead of hand-typing the map a second and third time. The orphaned `cornerWizard.js` copy is
named as dead in the broken/missing log below rather than silently left as a 4th candidate to rediscover.

**Mill — `pocket_data`.** Today the shape→region-params mapping is hand-typed 3 times: `pocketWizard.js:31-36`,
`pocketfill.js:38-44` (the one the EMIT actually calls), and `pocketData.js:254-268` (the twin's own preview,
reusing neither). The declaration:
```js
// pocketData.js — previewGeometry no longer hand-dispatches on p.shape itself
def.previewGeometry = (p) => {
  const region = trueRegionFromFlat(p);        // IMPORTED from pocketfill.js — the emit's own function
  return pocketPathsFromRegion(region, p);      // pocketPathsFromRegion is pure drawing, no shape knowledge
};
def.previewSources = { region: trueRegionFromFlat };
```
`pocketWizard.js`'s `trueRegionParams` (the legacy wizard's own copy) becomes the ONE thing left to reconcile —
named as a fork question below (does the legacy wizard get ported to call the same function, or does its whole
existence become the granularity question in its own right).

**Lathe — `lathe_parting`.** Today the kerf offset (`zFace − width`) is declared once
(`partBladeZ`/`partFloorRadius`, `parting.js:76-93`, "derived HERE so the emit and the tests cannot disagree"),
computed again inside the macro's own G-code, and re-derived a THIRD, independent time by the 2D canvas
(`latheProfileCanvas.js:277`), which calls neither. The declaration:
```js
// partingData.js
def.previewSources = { bladeZ: partBladeZ, floorRadius: partFloorRadius };
```
`partProfileSpec` (`latheProfileCanvas.js`) imports and calls `partBladeZ`/`partFloorRadius` instead of
re-deriving `zFace - width` inline. This example is deliberately the HARDEST of the three: lathe's cut geometry
has no declared hook at ALL today (only the blank/`simStock` is declared) — so this worked example is also the
answer to "what would a lathe `previewGeometry`-equivalent look like," which the survey's own withLatheScene
section found genuinely absent.

**What this shape does NOT attempt to solve** (named honestly, not swept in): the ATC group's dead positional
`sim` argument, the probe group's 6 still-live legacy-view second-renderers, and the lathe tool-mesh's disconnect
from the tool library's own authored silhouette are not "duplicate geometry formulas" — they are dead/stale
DECLARATIONS (not computations), a different repair shape (closer to the project's existing
"declared-but-unread sweep" pattern than to this one), and are left as separate, named findings rather than
force-fit into `previewSources`.

---

## Granularity forks — named, not decided (standing user ruling: granularity is not this act's call)

### Fork 1 — declare per-op, per-atom, or per-fact?

Today's `previewGeometry` is split inconsistently already: 7 mill ops declare it at the TWIN level
(`def.previewGeometry`); `text_data` declares it at the ATOM level (`BLOCKS['filltext'].previewGeometry`)
specifically because atom-level sidesteps a param-rename problem twin-level hooks have to solve by hand
(`contour`'s cross-atom position, `slot`'s `ax`↔`x0` rename — both named explicitly in the source comments this
survey read). The candidate shape above (`previewSources`) adds a THIRD granularity: per-*fact* (region, pattern,
kerf — each pointing at its own function), finer than either.
- **Per-op** costs: one place to look per op (simple), but a rename/adapter layer wherever atom and twin field
  names differ (already true for 2 of 8 mill ops).
- **Per-atom** costs: zero rename risk, but no single place declares a MULTI-atom op's whole preview — today no
  op actually composes multiple geometry-bearing atoms, so this hasn't bitten yet, but it's a real ceiling.
- **Per-fact** (`previewSources`) costs: the MOST authoring (N named entries instead of 1 function) and needs a
  shared, generic "facts → drawable paths" layer that doesn't exist yet — but it's the only granularity fine
  enough to let a checker verify "this ONE fact reuses the emit's function" rather than "the whole preview looks
  right today," which is exactly the gap Tier 1's triplicated dispatch tables fell through.

### Fork 2 — does 3D read declared geometry, or stay trace-only?

The mill survey names this as a FEATURE, not a gap: `gcodeViz3d.js` never reads `opType`/`previewGeometry` at
all — it renders whatever the emitted G-code parses into, so the 3D toolpath can never diverge from EMIT "by
construction." Probe ops break this symmetry already (`simStartsProvider` feeds BOTH 3D and 2D). Two genuinely
different needs are tangled under "preview":
- **Geometry that must match the emit** (a pocket's cut boundary, a bore's holes) — trace-only 3D is *correct
  by construction* here; declaring it into 3D would REINTRODUCE the two-independent-sources risk this design
  currently avoids for free.
- **Geometry that has no corresponding G-code at all** (Surfacing's Skim start marker, a probe's stylus, the
  ATC magazine in 2D per Tier 3 finding #24) — trace-only CANNOT show these; they need an explicit,
  preview-only channel, which is what `simStartsProvider`/`previewVarSeed`/`sim` intent already are, informally.
- Cost of leaving this tangled: a future author "fixing" the 3D pane to be more declarative (reasonable-sounding)
  could quietly remove the exact property that makes cut geometry unable to drift.
- Cost of formally splitting "must-match-emit" vs "preview-only" into two declared kinds: two vocabularies to
  learn instead of one, for a distinction that's currently implicit and (mostly) understood by convention.

### Fork 3 — one universal `def.preview.*` namespace, or keep each family's own idiom?

Mill's shape needs (`paths/handles/bbox`), probe's (`[{x,y,z,pass,manual}]` start markers), lathe's (a blank
cylinder + an as-yet-undeclared cut profile), and ATC's (a flat set of boolean context flags) are genuinely
different SHAPES, not just different names for one shape.
- **Universal namespace**: one mental model, one place a checker/linter looks for every op. Cost: probe/ATC/lathe
  don't need `paths/handles/bbox` the way mill does — force-fitting risks manufacturing dead fields, which this
  project has hit FOUR times already as its own named defect class (`emits`/`modalPre`/`noSnap`/`mouth` per
  ARCHITECTURE.md's Invariant #6 and the queued "declared-but-unread sweep" in NEXT-SESSION.md).
- **Per-family idioms, formally named as such**: no dead-field risk, matches what's already organically true.
  Cost: four things to learn instead of one, and no single place a new author checks "does this op declare any
  preview at all."

### Fork 4 — do the 6 still-live legacy renderer views get retired, or accepted as permanent?

Not strictly a *declaration* granularity question, but directly adjacent: even a perfect declared-preview shape
for the 32 twins does nothing for `middleView.js`/`edgeView.js`/`alignmentView.js`/`rotaryCenterView.js`/
`rotaryClockView.js`/`homingView.js` — still fully registered, reachable the instant an op carries its raw
built-in type (an old save file, a Blocks-authored raw block) instead of the twin's `user_*_data` type. Two of
these six are not just *duplicated*, they are *behaviorally different* right now (Tier 0, findings #1-2).
- **Retire them** (delete the legacy views, force old files through the twin path): closes the gap permanently,
  matches this project's stated "no legacy burden" posture for code with no install base — but whether THESE
  specific files have a real install base of old saves depending on them is a product/user question, not a code
  one, and `corner`'s own precedent (already deleted) shows old `corner`-typed files are ALREADY a dead end today.
- **Keep them, and declare their divergence explicitly** (a named, gate-visible list of "these N legacy views
  are known-divergent from their twin, tracked, not silently trusted"): safer for compatibility, but the
  duplication-drift risk this whole survey exists to map persists indefinitely, growing by one entry every time
  a twin's preview gains a capability its legacy sibling doesn't get.

---

## Broken/missing previews noticed (logged, not fixed)

Consolidated from the per-op tables above — full citations there, this is the punch list:

- **`middle_data`**: Feature=Boss+Circular shows the WRONG stock shape in preview (a live regression vs. the
  legacy view — Tier 0 #1).
- **`rotary_center_data`**: its legacy view silently mutates persisted `settings.stock`; the twin correctly
  doesn't (Tier 0 #2 — not itself broken, but a landmine if the legacy path is ever reached).
- **Lathe**: picking a real centre-drill/drill tool renders as a flat mill endmill in 3D (Tier 0 #3, the single
  most consequential bug in the survey). No `'parting'` scene-tool branch exists at all — a parting op always
  gets the generic OD-turn insert box. `gcodeViz3d.js`'s `setLatheTool` API is dead (zero call sites).
- **ATC**: the 2D toolpath pane never draws the magazine at all, for any host. `showMagazine`/`toolMachineFrame`
  are per-opType constants never conditioned on the op's own resolved params — `atc_table_data` with
  `includePockets=false` (which emits no pocket writes) still shows the full magazine; `atc_test_data`'s
  `first`/`count` sub-range isn't reflected in the static render. `comm_data`'s declared `sim={}` is triply inert.
- **`drill_data`/`bore_data`**: the `skip` param never reaches the preview — a skipped hole still draws as a
  normal one, even though the correct rendering already exists in the legacy Drill view.
- **`tap_data`/`text_data`**: no `def.zRuler` despite binding the identical depth/stepdown shape their siblings
  declare it for.
- **`pocket_data`**: raster strategy shows only the outer boundary (no scan-line preview), asymmetric with
  spiral's full concentric-ring preview — not incorrect, just an inconsistent level of detail.
- **`slot_data`**: the only mill op whose `previewGeometry` returns no `bbox`, leaving it unverified against the
  placement-parity contract (`panelTypes.js:260-262`) every sibling explicitly satisfies.
- **`corner_data`**: editing a legacy `corner`-typed op (an old save/import) opens an empty modal — a dead end
  for old files, not reachable from today's menu.
- **`edge_data`**: never ported into `opSimStarts.js`'s shared registry the way middle/alignment/rotary were — a
  raw legacy `edge` op gets no start hint at all in the Blocks-tab generic preview.
- **`alignment_data`/`rotary_center_data`/`rotary_clock_data`/`homing_data`**: their legacy views declare a
  two-pane layout but render nothing into the 2D pane — permanently blank, not a second implementation, just
  dead space (unreachable from today's menu).
