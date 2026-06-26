# DDCS Studio — Roadmap

> The single canonical backlog. **Code-verified 2026-06-25** by a 95-agent pass (extract every item from the old
> planning docs → adversarially check each against the actual code → synthesize). Of 89 backlog items across the
> former docs, **52 were genuinely outstanding and 37 were already shipped** — the staleness that motivated
> collapsing many overlapping docs into just two.
>
> **Companion doc:** [`NEXT-SESSION.md`](NEXT-SESSION.md) — the live handoff (current state + the immediate next task).
> This file supersedes `NEXT-TASKS.md`, `docs/WIZARD-PLATFORM-VISION.md`, `CRAZY-IDEAS.md`, `FUSION-INTEGRATION.md`,
> and the `docs/` planning notes — all now under [`docs/archive/`](docs/archive/) (preserved, not deleted).

## How to read this
- **Tiers:** NEAR (do next) · MID · STRATEGIC (the vision endgame). **Effort:** S / M / L / XL.
- Every item was checked against the code. Items verified **already shipped are NOT listed** (they're in the archive).
- App code lives under the nested `DDCS-Studio/web/` (the git root has a doubled `DDCS-Studio/` dir); file paths below are relative to `DDCS-Studio/`.

---

## North star (the *why*) — total wizard control by the user

Every wizard becomes **data, interpreted** — not hand-coded JS. The moment a user can edit *any* wizard, the built-ins
lose their privilege: shipped ops become the **default library** — open, fork, override, delete, exactly like a user's
own. The app **self-hosts in its own wizard format**; "reset to factory" = reload the shipped definitions.

The value is one floor up from the primitives (no user out-designs the built-in edge-probe): it's in **composition**
(stringing ops into shop-specific jobs), **specialization** (collapsing a general op into a one-click recurring case),
**the long tail** (the machine/material/controller we can't ship for), and **distribution** (one expert authors,
thousands run). **Atoms = the controller's instruction set (fixed). Ops = compositions (user-authorable).** The honest
floor: the validator guarantees the **protocol** (won't break the controller), never the *meaning* of an unseen thing —
that semantics belongs to the author. Real-time loops (plasma THC) stay below the floor, delegated to the controller.
Full essay: [`docs/archive/WIZARD-PLATFORM-VISION.md`](docs/archive/WIZARD-PLATFORM-VISION.md).

### ⚑ Key reframe (code-verified): the "staged engine" is largely **already built**
The vision doc framed expressions/loops as future work. They ship today:
- **Stage 2 — expressions in the blanks:** `wizards/ops/expr.js` `evalExpr()` (recursive-descent, no `eval`), wired through `blockEmitter` `resolveValue/resolveBool`. Any value socket already takes `depth*2`-style expressions. ✅
- **Stage 3 — loops / control flow:** `count.js` (loop + live index, 100k cap), `iff.js`, `compare.js`, `array.js` (stamp, 4 patterns), `flow.js` (label/goto/ifgoto), `helix/stepdown/stepover/fill`. Far beyond "one loop." ✅
- **Raw-emit atom tier:** `macro.js` `rawBlock`/`mcodeBlock` + `assign.js` (`#N=expr`) — the "raw / you own the meaning" escape hatch. ✅ (What's missing is only the *visible label/contract* — see MID.)

**So what remains of "wizards-as-data" is Stages 4–6:** express ONE built-in *as a data definition* + assert
output-equivalence → port the rest one-by-one → self-host (forkable built-ins + reset-to-factory). See STRATEGIC.

---

## Wizard-maker — NEAR (do next)

### 1. ✅ SHIPPED (`ef0ee43`) — Track A icons: re-icon any wizard + line-art picker
Done. A shared `ic:<id>` registry (`web/ui/wizIcons.js`) backs both the bar and the picker; an `iconOverride`
(emoji or `ic:<id>`) wins over a built-in's default line-art; the icon button is ungated (built-ins re-iconable).
*Follow-up = MID "curated line-art SVG icon library" (a larger/new glyph set + folding in the header icons).*
The emoji icon picker shipped; this completes it. Smallest standalone win; substrate already in place.
- `commandDeck.js` `wizItemIcon`: check `iconOverride` **before** the unconditional `WIZ_ITEM_SVG[e.id]` return, so an override can win for the 8 SVG-iconed built-ins.
- Extract `HEADER_ICONS`+`WIZ_ITEM_SVG` into a shared `ic:<id>` registry; add `ic:`/SVG rows to `ICON_CHOICES` + render SVG in `openIconPicker` cells and the bar.
- Drop the `kind==='user'` gate (`wizardManagerPanel.js:291`) so built-in rows get an icon button. Keep `ic:` SVG trusted/curated (injected as raw HTML; labels are `_escHtml`'d).
- Files: `web/ui/commandDeck.js`, `web/ui/wizardManagerPanel.js`, `web/blocks/wizardLibrary.js`.

### 2. ✅ SHIPPED (`105c837`) — In-block ✎ editor for the coordinate-list positioner
Done. The editor core is `formWidgets.buildCoordEditor` (shared by the form widget + a new `openCoordEditor` modal);
dev-mode grows a ✎ pencil on `coordlist` blocks → `devMode.openCoordAuthor` reads/writes the `PTS` field + redraws.
*Still open (coupled): `extractParamBlocks` ignores coordlist pills, so coordlist can't yet become a saved wizard knob (needs NEAR #4's non-numeric param mechanism).*
The handoff's explicit next-up after V10.36; completes coordlist as a dual-surface authoring widget (matches region-pick).
- Mirror region-pick: `devMode.augment()/clearAugment()` branch for `coordlist` → pencil `FieldImage` → `openCoordAuthor(blk)`; read/write the **`pts` field** value (`{points,z}` JSON — *not* `block.data`, the one divergence) → `forceRerender()`.
- The rich editor only exists as an inline closure in `formWidgets.js` (`coordListWidget`) — **extract a standalone `openCoordEditor(initial,onSave)`** (region-pick already has a packaged editor; this doesn't). Add a coord-author spec.
- ⚠️ Coupled gap: `extractParamBlocks` (`userOps.js`) only converts `param`/`regionpick` pills — **coordlist can't become a saved wizard knob yet** (the `list` binding type exists but no authoring path emits it).
- Files: `web/blocks/devMode.js`, `web/wizards/ops/coordlist.js`, `web/ui/formWidgets.js`, `web/blocks/blockly/coordListField.js`.

### 3. ✅ FIXED — App-wide Merge/Replace/Cancel safety net
**The original "resolved-by-analysis" missed one path — now fixed.** The new-op insert path IS append-only
(confirmed), but `blocksApp.js` had an unguarded `replaceOp` call when changing header dropdowns
(CORNER/AXIS/FEATURETYPE) on typed op blocks in the Blocks tab — silently clobbering hand-edited children.
**Fix:** the Blocks-tab field-change listener now checks `isOpBlockEdited` and routes through `mergeOpBlocks`
(3-way merge, preserves injections) instead of the raw `replaceOp` (wholesale rebuild). The wizard edit path
was already guarded (`wizardManager.insert()` → `isOpBlockEdited` → `showBlockEditNotice`). Both `replaceOp`
callers are now safe.
- Files changed: `web/blocks/blocksApp.js` (import `isOpBlockEdited`, guard the field-change `replaceOp` call).

### 4. ✅ SHIPPED — Field-targeting / non-numeric param mechanism — **the load-bearing unlock**
Everything assumes a numeric value socket (valid-by-construction). This gates text/corner-grid knobs, enum/string region values, and (with a part drawing) spatial CAM feature-selection.
- Introduce a param kind that occupies an inline dropdown/text/corner-grid **field** (not a numeric socket); a Blockly field adapter that commits string/enum/code; `extractParamBlocks` emits `enum`/`string` bindings (drop hardcoded `type:'number'`); extend dev-mode `WIDGET_CHOICES`; emitter/marker round-trip for non-numeric commits.
- Form-side widgets (`textWidget`, `cornerGridWidget`, dropdown enum branch) already exist — could be **M** if scoped to enum-via-existing-dropdown first.
- Files: `web/wizards/ops/param.js`, `web/blocks/userOps.js`, `web/blocks/blockly/bridge.js`, `web/ui/formWidgets.js`, `web/blocks/devMode.js`.

---

## Wizard-maker — MID

1. **[M] One diff at 3 surfaces — ✅ shipped (`5d348af`) then ⤴ SUPERSEDED by declare-edit (`2789c37`, 2026-06-26)** — MID #1 re-based the glow on a reconciler reconstruction (`RECONCILERS`→`BUILDERS`→diff), but that re-derivation IS inference and false-glowed on a blocks round-trip's representation drift (empty move sockets→`0` so `G0 X#9`→`G0 X#9 Y0 Z0`; `#var`→`variable` record). **Declare-edit replaced it:** glow/chip/merge-guard now read the user's RECORDED block edits (on the Blockly change event, `opEdits.js`), persisted in `.mjson`, so drift can never read as an edit; ~134 lines of inference removed. A *surfaced* edit now correctly trips the chip (without the reconciler a Replace would lose it). `opGlow.js`, `opEdits.js`, `blocksApp.js`.
2. **[M] Curated line-art SVG icon library + picker** — the other half of Track A (the glyph set + picker SVG-render path); shares the `wizItemIcon` precedence + `ic:<id>` registry with NEAR #1.
3. **[M] Region editor v1.x — poly/freeform point editing — ⏸ PARKED as low-leverage (2026-06-26)** — the region EDITOR is an *authoring* modal (wizard-maker side, used once to draw a clickable diagram), NOT in the operator/machining loop; and genuine straight-edged-polygon machining cases are rare (L/T pockets, hex stock). The common non-rect need is ROUND → a **circle region** (reuse `shapeStage`'s existing ellipse + bake to an N-gon) is the smaller, higher-value add if this is ever advanced. Runtime/bake already render polygons; only authoring is rect-only. `ui/regionEditor.js`, `ui/shapeStage.js`. (See the GUI-over-fields convention below.)
4. **[M] Per-point Z on the coordinate-list** — evolve `{x,y}`→`{x,y,z}` with a per-row Z input; migrate existing `{points,z:scalar}` state on load. `ui/formWidgets.js`, `ui/coordListSvg.js`, `wizards/ops/coordlist.js`.
5. **[L] Raw-emit atom tier — the *visible* contract** — atoms exist; the user-facing "raw / unsimulated / you own the meaning" label + a parameterized raw G/M template (named-param interpolation, round-trips) + surfacing the silent `GcodeSimulator` skip-counter as per-line "went dark in sim" annotations. `wizards/ops/macro.js`, `engine/GcodeSimulator.js`, `viz/createPreviewPanel.js`.
6. **[S] Federated schema registry** — make `specOf(op) = SCHEMA[op] || userRegistry[op]` real (today user specs mutate the shared factory object in place; no pristine/forkable layer). Mechanical refactor; substrate for Stage-6 reset-to-factory + distribution-install validation. `blocks/opSchema.js`, `blocks/userOps.js`.
7. **[L] Sim intent v2** — widen `opSimContext` to `(opType, stock, profile)` returning declared geometry/envelope/magazine **data** so `gcodeViz3d` consumes plain data. Cheap sub-win (S): wire the Blocks preview to show the ATC envelope (`setForceMachine`). `viz/opSimContext.js`, `blocks/blocksApp.js`, `viz/gcodeViz3d.js`.
8. **[M] Homing — first-class `home` block + reconciler** — homing emits generic atoms with no semantic reverse-sync; add a homing block + a `RECONCILERS` entry so the op round-trips into its form. `wizards/homingWizard.js`, `blocks/opSession.js`, `wizards/views/homingView.js`.
9. **[M] Attachment-automation wrappers** — generalise the `placeOnStock` C-block into "run op WITH dust-shoe/coolant/vise": a wrapper block + a wrap emit-fold (output-on → child → output-off, optional `waitInput`) + presets. Document the 5 I/O patterns. `wizards/ops/placeOnStock.js`, `blocks/blockEmitter.js`, `wizards/ops/coolant.js`.
10. **[M] Fixture-backdrop canvas picker** — the likely **3rd concrete pick widget** (forces the deferred generic `pick` extraction). Build concrete on `regionPickSvg`'s backdrop support. Two new prerequisites: an **SVG sanitiser** for imported fixture art (`regionPickSvg.js` mounts raw `innerHTML` today) + a **coordinate map** (fixture↔viewBox). `ui/regionPickSvg.js`, `ui/regionEditor.js`.
11. **[M] Handle-widget family — steppers (concrete)** — slider/xy-pad/rect ship form-side; a stepper is the missing instance. Do **not** extract a generic `handle` renderer yet (rule-of-three). `ui/formWidgets.js`, `viz/featureCanvas.js`.
12. **[L] `macrosApp.js` restructure + `probe.nc` builder + `@DDCS` lint** — split the 1338-line, 4-workflow file by workflow (modularize-first); build the `probe.nc` configurator (currently a title+hint stub); add a lint so Macros output participates in the `@DDCS` declared-intent schema. (`macros-tabs.spec.js` is stale — asserts the old flat-tab layout.) `web/ui/macrosApp.js`, `blocks/opSchema.js`.
13. **[S] Setup checklist — a real "user touched this" flag** — replace the defaults-heuristic so a user legitimately running default values doesn't see a false ⚠. `ui/setupChecklist.js`, `ui/stockEditor.js`, `ui/settingsPanel.js`.
14. **✅ SHIPPED — Learner library — toolbox TREE (⚛ Atoms · 📚 Snippets · 📦 Complete Programs)** (user request, 2026-06-26). Built as a 3-level tree: the ops categories nest under a collapsible **⚛ Atoms** parent; **📚 Snippets** + **📦 Complete Programs** are sibling collapsible groups, each holding themed sub-categories of curated compositions. Each composition is a `{type,params,children}` stack rendered as ONE draggable connected flyout block (`stackBridge.stackToFlyoutBlock` — merges atom defaults so an omitted socket isn't `F0`); `buildToolbox(extraCategories)` is caller-injected (blocksApp passes `learnerToolboxCategories()`) to dodge a bridge↔stackBridge eval cycle. Valid-by-construction (every entry emits clean G-code — `learner-library.spec`). Starter curation: Snippets {Spindle & Coolant, Motion}, Programs {Milling}; the ongoing work is curation. *(Original spec below.)* — two new toolbox groups of pre-composed, **drag-in** stacks for people learning G-code on DDCS: **Snippets** = *bare* stacks (reusable patterns — probe-and-retract, safe-Z lift, WCS preamble) that slot INTO a program; **Complete Programs** = *framed* stacks (small end-to-end examples that run/sim as-is). All **curated + validator-gated** (valid-by-construction, same guarantee as a built-in). Low-infra: a snippet/program IS just a stack — *bare vs framed* is the distinction `appendIntoProgram` already encodes — surfaced as toolbox entries (a new *presentation* of the existing stack concept, not a new kind of thing). Pairs with the shipped **hover-highlight** (drag in → hover blocks → watch the G-code light up) for a self-teaching loop; transparency is already covered by **expand** (op bodies are real stored atoms) + hover. The real work is **curation** (authoring good, minimal, well-commented examples ordered as a gentle curriculum), not code. Keep the category rail scannable (one rail entry per group, sub-group inside the flyout). Later symmetry: same save machinery gives "save selection as snippet" (bare) / "save program as example" (framed). **EXPLICIT NON-GOAL — do NOT build "decompose / explode an op into atoms":** the model says decompose only where structure is *stored* (op header → its child atoms = lossless) and NEVER where output is *computed* — toolpath atoms (`bore/contour/drill/line/slot`) and `array` repetition bake **lossy + irreversibly** (severs the parametric recalc), and probe routines are **safety-critical** (a casual edit on the #var-threaded sequence crashes the probe or writes a wrong WCS). Snippets/programs are *authored* stacks, never auto-exploded from a parametric op. Files: the Blockly toolbox/category registry (`blocks/blockly/*`) + a new curated stack library.

---

## Wizard-maker — STRATEGIC (the vision endgame)

1. **[L] Generic `pick` renderer + unified control spec** — ONE declarative control spec (`{graphic, interaction:{kind:'pick'|'handle', regions/handles}, value, param}`) + ONE generic `field_control` + ONE form-widget interpreter, re-expressing datum + region-pick as built-in specs. **Correctly deferred** — keep concrete until a 3rd pick case (the fixture-backdrop picker) forces it (rule of three). `blocks/blockly/bridge.js`, `ui/formWidgets.js`.
2. **[L] Wizards-as-data Stage 4** — express ONE built-in (recommend **drill**, the originating prototype) as a pure data definition consumed by `registerUserOp`/`instantiate`, with a spec asserting `emitMapped(interpreter) === emitMapped(<name>Stack(params))` across a param sweep. Grow the template vocabulary *from* the port. No equivalence harness exists yet. `blocks/opBuilders.js`, `blocks/userOps.js`.
3. **[XL] Wizards-as-data Stage 5** — port the rest of the built-ins to data, one-by-one, each gated by output-equivalence; never batch. The hard frontier: probe-family IF-GOTO/retry and ATC bbox-snapshot (they stress the format's ceiling). `blocks/opBuilders.js`, `wizards/probeBlocks.js`, `wizards/atcChangeWizard.js`.
4. **[XL] Wizards-as-data Stage 6 — self-host** — built-ins become the forkable default library (Edit/fork on built-in rows; a definition-level `resetToFactory` re-registering shipped defs). Gated on Stage 5 + the federated registry. `blocks/wizardLibrary.js`, `blocks/devMode.js`, `wizardManager.js`.
5. **[L] Community `.wizard` library** — browse/install panel; the `.wizard` codec + validate-on-install already hold for local import, so what's missing is the index/catalog format, a network fetch layer, the browse UI, and bundling the op def alongside the `.nc`. `blocks/wizardLibrary.js`, `ui/wizardManagerPanel.js`.
6. **[XL] Plasma/laser modality suite** — process-atom vocabulary (pierce, lead-in/out, power ramp, beam/arc on-off, kerf-comp) as profile-aware leaf ops + a Plasma/Laser wizard group + per-head config + making `head.type` actually branch codegen & sim. Keep hard-real-time THC delegated to the controller. Largely community-authorable once the vocabulary exists. `wizards/ops/cnc.js`, `ui/settingsPanel.js`, `blocks/programFraming.js`.
7. **[L] Dedicated Squaring wizard (gated on Y2)** — generalise the per-axis G31 seek to per-**motor** independent seeks; decouple→seek→re-couple dual-Y (`#988–#992`); a Y2 Machine-tab config as the unlock. Optional probe-verify/correct. `wizards/homingWizard.js`, `blocks/opBuilders.js`.
8. **[L] Parametric-canvas view-migration** — extract a pure `(params↔picture)` atom from `FeatureCanvas` and lift ONE production view (recommend **drillView**) onto it, behavior-preserving, gated on output-equivalence **and** the real rendered 2D symptom. The deferred big refactor — do ONE view against a released baseline. `viz/featureCanvas.js`, `wizards/views/drillView.js`.
9. **[XL] Region primitive → spatial CAM feature-selection** — *(GATED, do NOT build now)* generalise backdrop→part/stock and region→feature so clicking part geometry commits a feature/op. The enabling decision (region = an extracted shared-drawing primitive, not an iconEditor layer) is already satisfied (`shapeStage`). Blocked on the field-targeting param mechanism (NEAR #4).
10. **[L] Audit other native subs (O502 probe, ATC) for G31 decomposition** — extend the homing Native-vs-decomposed method picker to other decomposable native subs (O502 is confirmed G31-decomposable). Carries the same UNVERIFIED-on-hardware burden. `wizards/ops/probe.js`, `wizards/edgeWizard.js`.

---

## Non-wizard backlog

- **[XL] Fusion 360 integration** — launch/focus Studio from inside Fusion (CAM workspace). Three entry points scoped: a Python add-in button, a post-process hook (JSON sidecar + open Studio), and a CAM custom command "Send to DDCS Studio" (preferred). Open: desktop exe vs web app; pass stock/WCS or raw `.nc`; own repo vs `ddcs-vscode-extension/` sibling. Detail: [`docs/archive/FUSION-INTEGRATION.md`](docs/archive/FUSION-INTEGRATION.md).
- **[L] L1/L2 cross-controller translator** — per-controller address columns in the dict; best-effort read of foreign post markers (Fusion op headers) as declarations. Same shape as the `watch.js` variable-map gap.
- **[M] Gateway gaps** (architecture is fine) — `merge.js` is a stub (multi-tool merge: combine single-tool programs + T/M6 + safe retract between each); `watch.js` variable map half-done (#100–499 confirmed, #500+ per-controller pending). Cloud path deferred.
- **Separate sim tracks** (each its own project, not Head-tab fields) — **VFD/spindle sim** (RPM ramp, spin-up/down timing → gives Max-RPM/Spin-down meaning), **plasma/laser head sim** (pierce/THC/arc-OK), **ballscrews + steps** (steps/mm, backlash → positional fidelity).
- **[S] SVG copy of the app icon** — vector recreation of `ddcs.ico` for scalable in-app use (blocked on viewing the ICO).
- **Repo-root scratch cleanup** — untracked icon experiments (`ddcs-opt1..4.ico`, `*-preview.png`) to remove once the icon is finalized.

---

## Gaps — surfaced by verification, tracked in no prior doc

1. **coordlist can't become a wizard knob** — `extractParamBlocks` ignores `coordlist` pills (only `param`/`regionpick`); the `list` binding type exists but no authoring path emits it. (Folded into NEAR #2.)
2. **coordlist drives no G-code** — the block emits nothing; the intended consumer op (stamp children at the listed XY points) doesn't exist yet.
3. **xy-pad/rect pickers are form-only by decision** — inside a block they degrade to plain number fields; the mini-canvas-block-field seam is open/unused, tracked nowhere.
4. **Selection-model theming is seam-deep** — `paintRegions`/`paintCornerGrid` hardcode colours; the `rp-region`/corner-grid CSS hooks have **no rules consuming them** and no shared `--pick-sel` token, so a theme can't restyle both pickers from one token (the stated goal).
5. **Save-states history is volatile** — lost on reload until the deferred IndexedDB autosave ring + recovery-on-load lands; `projectStore.js` is a named-project VFS, not an autosave ring.
6. **3D start-marker ruby is a fixed `SphereGeometry(3)`** — doesn't track `probeDims.ballDia` like the now-wired probe body. Minor visual-consistency gap.
7. **`macros-tabs.spec.js` is stale** — asserts a flat 3-tab bar; the UI is a sidebar + 7-panel tree. (Left red deliberately, pending the macrosApp restructure.)
8. **No test for the prereq-prompt UI** despite a `window.__ddcsForceWizPrereq` hook existing for exactly that.
9. **Test-coverage gaps** — no `profileStore` round-trip test; `wizard-library.spec.js` codec case omits `panel`/`sim`.

---

## Parked / speculative (from `CRAZY-IDEAS.md` — no commitment to build)

Several have already been **promoted** above (plasma/laser suite → STRATEGIC #6; community library → STRATEGIC #5;
region→spatial-CAM → STRATEGIC #9). The rest, parked:
- **Live control panel — software knobs via gateway** — gateway writes user registers (#100–#110) mid-program; the macro reads them between moves; Studio shows sliders mapping 1:1 to registers. Enables welding correction, plasma height, feed scaling. (**Studio-as-welding-HMI** is one instance.)
- **Surface digitizing → terrain** — a 20×20 probe grid (400 G31, results in #56–#455) → point cloud → mesh. Feeds **adaptive toolpath Z-correction** and **rotary wrap compensation** (per-angle radius map). *(CNC gaps: probe base must be block-ported; a grid probe needs an indexed probe-array. Concept-only — do not build the behavior unless asked.)*
- **Machine as a CMM / metrology** — flatness/squareness/parallelism reports from the probe-array pipeline.
- **`@DDCS:cam` beacon navigator + depth-map viz** — section jump-list + stacked depth/tool timeline read straight from `@DDCS:cam` markers (no G-code parsing).
- **Post-processor as a Studio plugin** — run the `.cps` post logic in JS to preview exact output before sending.
- **Persistent job memory** — a structured per-job record (file/WCS/tools/probe results/corrections) linked to the profile.
- **Alignment correction via rotation** — rotate emitted XY by the measured fence angle (#1512) in Studio (controller-agnostic, no G68).

Full text: [`docs/archive/CRAZY-IDEAS.md`](docs/archive/CRAZY-IDEAS.md).

---

## Conventions / traps (don't relearn the hard way)

- **Blockly v13 Class-B render trap** — a valid block model isn't drawn until the async render queue runs. Load via `serialization.workspaces.load` (`ddcsLoadBlockStack`) and always add a render-guard (`block.getHeightWidth().height > 0`), not just an emit assertion. See the `blockly` skill + `web/vendor/blockly/API-NOTES.md`.
- **Valid by construction** — a user op is compliant only if `BUILDERS(op.params) == op.children`. GUI param pills must resolve to numbers in `instantiate` so committed ops stay clean (pills live only in the def template).
- **GUI over fields — split by param TYPE (spatial-GUI placement, decided 2026-06-26)** — default to a visual picker over a text field, but the editing surface depends on what the param IS: a **discrete pick that fits a tile** (datum/corner, region zone) → a small SVG control that DUAL-RENDERS as a form widget + a Blockly `field_*` (`cornerGridSvg`/`regionPickSvg`) — stays in the form, shows inline on the block; a **continuous position** → drag the **interactive PREVIEW canvas** (`FeatureCanvas`), value as plain numbers on the block + a form mirror — **never** a mini-canvas inside a form row (redundant with the preview). The block stores the *value*, so canvas-first never hurts block round-trip (numbers round-trip regardless). The unused `xy-pad`/`coord-list`/`rect` form mini-canvases are spare parts, not the pattern to grow. **GREENLIT next step:** make ONE preview canvas WRITE BACK (drag a feature → params + form mirror) — **drill wizard** as the template (the interactive companion to STRATEGIC #8).
- **Verify the real symptom at runtime** — a green tsc/emit ≠ a working app; reproduce the user's exact symptom (right viewport, real rendered output).
- **Repo layout** — git root has a doubled `DDCS-Studio/` dir; the npm project + app code is under `DDCS-Studio/DDCS-Studio/`. `node_modules` is gitignored (run `npm ci` + `npx playwright install chromium` in a fresh checkout). Running the suite churns tracked `tests/_*.png` screenshots — `git restore` them before a release commit.
- **Release flow** — `npm run bump-version` bumps the `.ver` chip in `web/index.html` (the source of truth); pushing that change to `main` triggers `desktop-release.yml`, which builds the exe and **creates the `v<chip>` tag + GitHub release itself** (idempotent). Don't tag locally; push the bump commit as the tip.

---

## Archived (under `docs/archive/`)
Collapsed here on 2026-06-25 to end the planning-doc sprawl: `NEXT-TASKS.md`, `WIZARD-PLATFORM-VISION.md`,
`CRAZY-IDEAS.md`, `FUSION-INTEGRATION.md`, `SESSION-2026-06-10.md`, and the `docs/` planning/research notes
(`RICH-WIDGETS-AND-ICONS`, `ATC_INTEGRATION_PLAN`, `ROTARY-PLAN`, `SETTINGS-*`, `SIMULATION-NOTES`,
`PROBE-CONFIG-SOURCE`, `CONTROLLER_TASKS`, `MULTI-OP-STACKING`, `BLOCKS-TAB`, `CAM-MENU-RESEARCH`,
`ARCHITECTURE-MULTIUSER`, `MONOREPO_PLAN`, `COMBINED-APP-PLAN`, `BENCH-CHECKLIST`, `VERIFY-AT-MACHINE`,
`TOWER-LIGHT-EVAL`, `REMINDERS`, `SETTINGS-TABS-NOTES`, `addstudiotransfer`, `addstudioverify`,
`probe-preview-frame-issues`). Their actionable content lives above; the files remain for reference.
