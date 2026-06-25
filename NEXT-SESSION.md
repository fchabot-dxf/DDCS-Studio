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

1. **xy/rect param-block grouping** — ✅ DONE. `param.widget` now offers `xy-pad`/`rect`; `extractParamBlocks` pools
   those pills and groups them BY ORDER (xy-pad pairs → roles x,y; rect fours → x,y,w,h), exactly like the dev-mode
   inline-expose path — so two/four param blocks collapse into ONE canvas picker in the form. No new field (order is
   the convention; an odd leftover degrades to a plain number knob). Test: `tests/gui-param-grouping.spec.js`
   (unit + form + Class-B render guard). (As noted, this was a blocks-native convenience — canvas pickers were
   already authorable via inline-expose.)
2. **Typed widgets from param blocks** — ✅ DONE for the *sound* subset (dropdown presets + numeric toggle). A param
   block always lives in a NUMERIC socket, so every widget commits a NUMBER (valid by construction, no emitter
   changes): `dropdown` = a numeric preset chosen from a new `options` field ("Rough=500, Finish=1500"); `toggle` =
   1/0. `param.widget` dropdown now offers number/slider/dropdown/toggle; `userOps.parseParamOptions` +
   `extractParamBlocks` derive the binding (+ widgetConfig.options); `formWidgets` dropdown/toggle commit a number
   for numeric bindings (still bool/enum for those binding types). Test: `tests/gui-param-typed-widgets.spec.js`
   (Class-B render guard included). **DEFERRED**: `text` / `corner-grid` knobs — they commit a string/code, which
   can't live in a numeric socket; they'd need a *field-targeting* param (a param that occupies an inline dropdown/
   text field, not a value socket) — a separate, larger mechanism. (Both widgets already work form-side, just not
   authorable as a param block.) Not yet wired into the dev-mode *inline-expose* path (only param blocks carry the
   `options` presets); a toggle there would be trivial, a dropdown needs an options input.
3. **SVG / icons → rich-widget control standard** — scoped in `docs/RICH-WIDGETS-AND-ICONS.md` (the unified model:
   one declarative control = spec + one generic renderer; standard widgets = built-in specs, custom graphics = user
   specs; two spec kinds — `pick` and `handle`; dual adapters = block field + form widget; datum is the existing
   proof). **DIRECTION (build order):**

   - **Finalize the scoping doc** as the north star; link it from here. The vision is good — keep it written.
   - **DEFER C1 (the generic `pick` renderer).** Do NOT build the generic renderer as a framework up front. The
     unification ALREADY exists in one case — `cornerGridSvg` is one shared core across four surfaces today. The
     "standard" is something we **extract from 2–3 concrete widgets**, not something we design before a second case
     forces it. Mark C1 in the doc as *"deferred until ≥2 concrete pick widgets exist; generalize from working code,
     don't frame the abstraction first."*
   - **Track A — the wizbar icon picker → ✅ SHIPPED (v1, emoji).** A curated emoji set + an icon button per
     custom-wizard row in Settings → Wizards (`wizardManagerPanel.js`: `ICON_CHOICES`/`openIconPicker`) → writes
     `iconOverride`; the custom op renders it via the existing emoji path (no commandDeck change). "⌀ Default" clears
     it. Test: `tests/wizbar-icon-picker.spec.js`. (Follow-up: curated line-art SVG icons + re-iconing built-ins —
     needs `wizItemIcon` to let `iconOverride` win over `WIZ_ITEM_SVG` + an `ic:<id>` registry.)
   - **Region-pick runtime → ✅ SHIPPED (`ca469cd`, `web/ui/regionPickSvg.js`).** A custom op's param renders as
     clickable rect/poly/freeform regions over an optional backdrop; a click commits the picked region's NUMBER —
     sharing its core with the (future) block field, exactly like the datum. This is the SECOND concrete pick
     surface after `cornerGridSvg` — the "2 concrete widgets" bar is now met in the FORM, but only the form.

   - **Block-field parity → ✅ DONE.** `field_regionpick` (`blocks/blockly/regionPickField.js`) + the `regionpick`
     reporter block (`wizards/ops/regionpick.js`) — the `value` renders as the inline picker (`bridge.fieldKind`/
     `jsonDef`), the SPEC rides the block's `data` as a JSON-string param (the spec→block plumbing, via stackBridge's
     non-field-scalar channel), the picked NUMBER reduces into real G-code, and `extractParamBlocks` turns a pill into
     a `widget:'region-pick'` binding. Test: `tests/region-pick-block.spec.js` (Class-B + round-trip). Region-pick is
     now a genuine dual-adapter (form + block) pick surface — the real 2nd case beside the datum.
   - **DIRECTION — next: the AUTHORING editor** ("make your own datum": compose the backdrop in `iconEditor` + mark
     rect/poly/freeform regions + assign numbers/labels + bind to a param). The headline — the agent flagged it as a
     big "blind" build, so scope the UX first (esp. the region-drawing surface + iconEditor reuse). AND: with datum +
     region-pick now two concrete dual-adapter pick widgets, the deferred generic `pick` renderer can be extracted
     (rule of three met) — but only if a 3rd case or real friction justifies it; otherwise keep them concrete.

   - **Rule of thumb:** when a second concrete pick widget appears (e.g. the fixture-backdrop canvas), put the two
     side by side and extract the shared spec then. Two real examples disagreeing is what tells you what's genuinely
     generic vs. what only looked generic on paper. Until then, build concrete widgets one at a time and reuse
     `cornerGridSvg`'s existing pattern directly.

   (Pre-existing raw scope, still valid: curated icon library + picker — `iconOverride` passthrough already in
   `getLibrary`; custom SVG **import** (sanitised) + an **in-modal GUI editor** (compose from components, NOT a vector
   editor); SVG **backdrop** for a canvas picker — fixture as canvas; needs sanitisation + a coord map. The picker
   registry is built to absorb these.)
4. **Editor chrome** — ✅ DONE. **Clear** → a red trash button in the header beside undo/redo (`#btn-clear`,
   desktop only — hidden ≤600px, where the chevron menu keeps it as the phone access point). **Copy** → a floating
   button top-right of the editor (`#editor-copy-btn`, all widths, with a green flash on click), removed from the
   chevron menu (the floating button is universal). Wiring in `headerPost.js`; styles in `styles.css`. Test:
   `tests/editor-chrome.spec.js` (desktop wiring + menu delta; phone hide). NOTE the test must wait for the chevron
   menu to populate (initHeaderPost wires the Copy listener AFTER window.copyCode exists).
5. **Custom-op preview intent** — ✅ DONE (declaration plumbing). A `user_*` op's preview intent is **FULLY DECLARED,
   NEVER inferred from motion** — `userOps.registerUserOp` registers `def.sim || null` via
   `opSimContext.setUserSimIntent`; `userOpFromStack(…, panel, sim)` carries `def.sim`; the Blocks program preview's
   `programSimContext` union picks it up; `setRotaryFixture` → `gcodeViz3d._showRotaryJog` reveals the A± jog row
   ("showing the rotary = the 4th axis is plugged in + joggable"; the controller/profile 4th-axis setting stays
   independent). **NO inference, no exceptions** — an earlier A-move→rotary carve-out was REMOVED: the axis letter
   doesn't carry intent for an open-world op on an unknown machine (atom-reading is only safe for built-ins WE
   authored — that's why the static `ROTARY_RIG`/`FORCE_MACHINE`/`WITH_MAGAZINE` sets gate built-in types only). See
   [[custom-op-sim-intent-infer-vs-declare]]. Test: `tests/custom-op-sim-intent.spec.js`.
   **AUTHORING (✅ DONE):** the Blocks dev-mode save panel has a "Preview rig" group — rotary / machine / magazine
   checkboxes (`devMode.readSimIntent`/`setSimChecks`) → `def.sim`, parallel to the Panel dropdown. Round-trips on
   re-author (`editWizardDef` restores the checkboxes from `def.sim`); resets after save. Test:
   `tests/dev-mode-sim-intent.spec.js`. **`.wizard` portability (✅ DONE):** `wizardToFile` now carries `panel`+`sim`
   (optional, omitted when absent) and `wizardFromFile` returns them, so a shared custom wizard keeps its panel + rig
   on import (test in `wizard-library.spec.js`). **Blocks-native declaration (✅ DONE):** the `sim` ("preview rig")
   block (`web/wizards/ops/sim.js`, Mark Up) declares the intent IN the stack via 3 checkboxes (rotary/machine/
   magazine); emits nothing; `userOps.simIntentFromStack` reads it and it WINS over the dev-panel checkboxes (same
   precedence as the panel block). Test: `tests/gui-sim-block.spec.js`. So the wizard-maker GUI-authoring layer is
   complete: `param` (knobs) + `panel` (layout) + `sim` (preview rig), each declarable as a block AND in dev mode.

6. **Binding type + role declaration audit (declare, never infer)** — ✅ RESOLVED (2026-06-25).

   **A — binding `type` hardcoded to `'number'`** → **REJECTED (false alarm), documented.** Not a downgrade:
   `resolveFormWidget` prefers `binding.widget` (always set for slider/toggle/dropdown), proven by
   `form-widgets.spec.js` (`widget:'slider'` wins over `type:'number'`) + the typed-widget round-trip. `type:'number'`
   is CORRECT — a param pill lives in a numeric socket, so its committed value is always a number (toggle = 1/0,
   dropdown = a numeric preset). The proposed fix (`toggle`→`type:'bool'`) would REINTRODUCE the numeric-socket bug
   (a bool resolves to 0 → a toggled-ON knob emits OFF). A clarifying comment now lives at both binding-creation
   sites so it isn't re-flagged. (Harmless hardening kept: `validateUserOp` now REQUIRES `binding.type`.)

   **B — canvas role inferred from pool order** → **FIXED.** The role is now DECLARED: canvas widgets fold the role
   into the widget value (`xy-x`/`xy-y`/`rect-x/-y/-w/-h`, shared `userOps.CANVAS_ROLE_WIDGETS`); `decodeCanvasWidget`
   + `groupCanvasBindings` form canvases (same-widget consecutive; a repeated role starts a new canvas; an incomplete
   canvas degrades to plain number knobs). Roles no longer depend on pool position — both the param-block path
   (`extractParamBlocks`) and the inline-expose path (`devMode.buildBindings` + the `WIDGET_CHOICES` dropdown) use the
   shared helpers. Regression test `gui-param-grouping.spec.js` includes an ORDER-INDEPENDENCE case (declare Y before
   X → roles don't flip). See [[custom-op-sim-intent-infer-vs-declare]] (same declare-never-infer principle).

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
