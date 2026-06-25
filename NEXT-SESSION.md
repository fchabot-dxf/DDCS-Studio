# NEXT SESSION — handoff

State: **the USER wizard-maker is built end-to-end** — authoring (dev mode + GUI blocks) → a real widget form →
reuse of the built-in wizard panel → edit-from-Studio → save/re-author. All on `main`, full suite green except the
two pre-existing stale tests (see Known-failing). The old "Binding Rebuild / module restructure / DICT→SCHEMA"
themes are DONE (in git history + the memories below); this handoff is forward-looking from there.

Core mental model: **one stack, many expressions** — an op is a block stack; its *wizard* (form + bar button), its
*G-code*, and its *blocks* are all renderings of that one stack. "Save as custom wizard" = register the stack as a
bar button (+ its form); GUI param/panel blocks are the visible authoring layer that produces the form.

Memories to read first: [[widget-library-custom-op-wizards]], [[gui-blocks-roundtrip-target]],
[[wizard-to-blocks-bidirectional]], [[prefer-gui-over-fields]], [[verify-core-flow-before-features]].

---

## ✅ DONE this session — wizard-maker GUI authoring (all pushed to `main`)

**Widget library + canvas pickers** — custom-op forms render real widgets from bindings (not number-only).
- `web/ui/formWidgets.js` — `FORM_WIDGETS` registry (number/slider/dropdown/toggle/text/**corner-grid**/**xy-pad**/**rect**)
  + `renderOpForm(host, bindings)` (shared by the modal + the panel). A binding declares `widget` + `widgetConfig`.
- **Multi-param**: canvas pickers bind a GROUP of params sharing `group` + a `role` (x/y/w/h). corner-grid reuses the
  shared core `ui/cornerGridSvg.js` (same as the Blockly field); xy-pad/rect are built on `viz/featureCanvas.js`
  (draggable handles → dispatch a bubbling `input` so the panel preview live-updates).
- `web/blocks/userOps.js` — `validateUserOp` widened beyond number-only (`BINDING_TYPES`).
- Tests: `tests/form-widgets.spec.js` (each widget renders + round-trips; a real handle drag drives xy params).

**Roundtrip into Studio — custom ops reuse the built-in wizard panel** (NOT a modal).
- `web/wizards/views/userOpView.js` — ONE generic view for every `user_*` op; `web/index.html` `#wiz_user` — ONE
  panel reused for all of them. Builds the form from the bindings (`renderOpForm`), code/preview from the builder
  (`emitMapped`), records the op so the shared `insert()` commits/replaces it.
- `web/wizardManager.js` — routes `user_*` → userOpView + #wiz_user (open / activeView / `canEdit` / `_seedForm`);
  `setUserOpDef` before show. So Studio hover-code → ✎ Edit (`ddcsEditOp` → `openForEdit`) edits a custom op like any
  wizard, edit-in-place via the existing `replaceOp`.
- Test: `tests/custom-op-panel.spec.js`.

**Dev-mode widget-assign + "Save as custom wizard"** (`web/blocks/devMode.js`, `web/ui/headerPost.js`).
- Each exposed value gets a WIDGET dropdown; xy/rect group by order. `collectAuthoring` + `buildBindings` are the
  shared save path. **Save as custom wizard** is in the ⌄ quick menu (`window.ddcsSaveAsWizard`) and works WITHOUT
  dev mode (no knobs → a parameterless bar button; add knobs later). Distinct from "Save project" (persists ops).
- Tests: `tests/dev-mode.spec.js`, `tests/save-wizard-no-devmode.spec.js`.

**Panel-types** (`web/wizards/ops/panelTypes.js`) — `def.panel` = `form` / `form3d` / `form2d`; userOpView shows/hides
the preview pane + picks 3D vs a FeatureCanvas 2D layout. Test: `tests/panel-types.spec.js`.

**GUI blocks (the visible authoring layer):**
- **(A) `param` block** (`web/wizards/ops/param.js`) — a reporter; plug it into any value socket → that value is a
  named knob with a widget. `reduce` → its default so the op still emits real G-code. `bridge.js`: `widget` field →
  a dropdown (number/slider for now). `userOps.extractParamBlocks(template, seen, keepPills)` turns each param pill
  into a binding.
- **(B) round-trip** — `extractParamBlocks` KEEPS the pill in the template by default, so a saved wizard carries its
  param blocks; `instantiate` still resolves each pill to a number (committed op stays clean, valid-by-construction
  holds — pills never reach a committed op).
- **(B) re-author** — `devMode.editWizardDef(opType)` (window `ddcsEditWizardDef`, set early in `app.js`) loads a
  saved wizard's template (pills round-trip via `recToJson`) back into Blocks + dev mode; `_editingWizard` makes
  save UPDATE in place (`userOps.updateUserOp`). Trigger: **✎ Edit** on each custom-wizard row in Settings →
  Wizards (`web/ui/wizardManagerPanel.js`).
- **`panel` block** (`web/wizards/ops/panel.js`) — declares the panel type in the stack; emits nothing; wins over
  the dev-panel dropdown; round-trips.
- Tests: `tests/gui-param-block.spec.js`, `tests/gui-blocks-roundtrip.spec.js`, `tests/gui-blocks-reauthor.spec.js`,
  `tests/gui-panel-block.spec.js`. Each has a **Class-B render guard** (the pill/block actually draws).

Earlier-but-related (prior session, on `main`): the data-driven wizard bar (`commandDeck._renderWizardBar`,
3-section model), the Settings **tree-GUI** bar designer (`wizardManagerPanel.js`), Blockly upgraded to **v13**.

---

## ▶ Queued — wizard-maker follow-ups (the natural next steps)

1. **xy/rect param-block grouping** — group param blocks into a canvas picker (a `group` field on `param` + roles by
   order; `extractParamBlocks` emits group/role bindings). NOTE: the canvas pickers are ALREADY authorable via the
   inline-expose path (it groups xy/rect by order) — this is a blocks-native convenience, not a missing capability.
2. **Typed widgets from param blocks** (dropdown/toggle/corner-grid) — needs the `param` value to be non-numeric
   (enum/bool/string), i.e. a small value-type extension to the param block (today its value is a numeric socket).
3. **SVG / icons** (raised, deferred): a curated icon library + picker for wizards & dropdowns (the `iconOverride`
   passthrough already exists in `getLibrary`); custom SVG **import** (sanitised) + an **in-modal GUI editor** (compose
   from components — fields/handles/buttons, NOT a vector editor); SVG **backdrop** for a canvas picker (your fixture
   as the canvas; needs sanitisation + a coord map). The picker registry is built to absorb these.
4. **Editor chrome** (small): Clear → app header (near undo/redo), Copy → a floating button in the editor.
5. **Custom-op preview intent** — extend `viz/opSimContext.js` to `user_*` ops (rotary/probe/magazine), derived from
   atoms (A-move→rotary, G31→machine, tool-change→magazine) or declared.

CONCEPT-ONLY (do NOT build the behavior): the **terrain-probe** is a proof-of-concept illustration (see
`CRAZY-IDEAS.md` — surface digitizing / probe-array → terrain). Its real CNC gaps (probe base must be block-ported;
a grid probe needs an indexed probe-array for per-point Z) are out of scope unless explicitly requested.

---

## Non-wizard backlog (pre-existing, not this session's)

- **L1/L2** — per-controller address columns in the dict (the cross-controller translator); best-effort read of
  foreign post markers (Fusion op headers) as declarations. Same shape as the `watch.js` variable-map gap.
- **`macrosApp.js` restructure** — 1338 lines, 4 unrelated workflows (Homing/Sysstart · M-codes O100nn · K-buttons
  key-N.nc · CAM Pack Builder). Modularize first, then validate, then test (same medicine the `opStacks` split used).
  None of the Macros tab output participates in the `@DDCS` schema yet — a lint over declared intent would help.
- **Gateway gaps** (architecture is fine): `merge.js` is a stub (multi-tool merge — combine single-tool programs,
  insert T+M6 + safe retract between each); `watch.js` variable map half-done (#100–499 confirmed, #500+ pending
  per-controller). Cloud path deferred per [[gateway-cloud-architecture]].
- **Sim intent v2** (`viz/opSimContext.js`) — widen to `(opType, stock, profile)` returning declared
  geometry/envelope/magazine data so `gcodeViz3d` consumes plain data; Blocks preview could gain the ATC envelope.

---

## Key files (wizard-maker)
- `web/blocks/userOps.js` — runtime registry: a user op = template + bindings (+ `panel`). `registerUserOp` installs
  `BUILDERS[type]`/`SCHEMA[type]`/label; `instantiate` (clone + substitute by blockIndex/key), `extractParamBlocks`,
  `createUserOp` / `updateUserOp` / `deleteUserOp` / `loadUserOps` / `userOpFromStack`. **Valid by construction.**
- `web/blocks/wizardLibrary.js` — the `.wizard` codec + catalog (`getLibrary`) + per-entry/group overrides
  (`ddcs_wizard_layout`) + sections + `createGroup`/`deleteGroup`. `createWizard` = register a user op + bar entry.
- `web/blocks/devMode.js` — Dev mode: expose values + widget choice, `collectAuthoring`/`buildBindings`,
  `saveAsCustomOp`, `editWizardDef` (re-author). `window.ddcsSaveAsWizard` / `ddcsEditWizardDef`.
- `web/ui/formWidgets.js` — the widget registry + `renderOpForm`. `web/ui/userOpForm.js` — the (legacy) modal form.
- `web/wizards/views/userOpView.js` + `#wiz_user` (index.html) — the generic panel view.
- `web/wizards/ops/{param,panel,panelTypes}.js` — the GUI blocks + panel-type registry.
- `web/wizardManager.js` — routes `user_*` → userOpView; `openForEdit` / `canEdit` / `_seedForm`.
- `web/ui/wizardManagerPanel.js` — Settings → Wizards tree GUI (sections → dropdowns → wizards) + ✎ Edit / Export /
  Delete per custom wizard.
- `web/blocks/blockly/bridge.js` — `optionsFor`/`fieldKind` (how a def's fields become Blockly fields); `param`/`panel`
  dropdowns added here. `web/blocks/blockEmitter.js` — `emitMapped`; `resolveValue` reduces a reporter pill in a socket.

## Known-failing tests — IGNORE (pre-existing, not yours)
- `macros-tabs.spec.js` — stale (asserts an old flat-tab macros layout; the UI is a tree now).
- `middle-animator.spec.js` — flaky animation timing; passes in isolation.

## Traps / rules (don't relearn the hard way)
- **Blockly v13 — the Class-B render trap**: a valid block model isn't drawn until the async render queue runs. Load
  via `serialization.workspaces.load` (the project's `ddcsLoadBlockStack`), and ALWAYS add a render-guard test
  (`block.getHeightWidth().height > 0`), not just an emit assertion. See the `blockly` skill + `vendor/blockly/API-NOTES.md`.
- **Valid by construction**: a user op is compliant only if `BUILDERS(op.params) == op.children`. GUI param pills must
  resolve to numbers in `instantiate` so committed ops stay clean (pills live only in the def template).
- **GUI over fields** ([[prefer-gui-over-fields]]): default to a visual/canvas picker, not a text field.
- **Verify the real symptom at runtime** ([[verify-core-flow-before-features]] / [[verify-real-symptom-not-just-test]]):
  a green tsc/emit ≠ a working app; reproduce the user's exact symptom (right viewport, real rendered output).
