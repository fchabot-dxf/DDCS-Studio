# Rich widgets + icons — scoping (handoff #3, redirected)

Redirected from the handoff's "SVG/icons" per the 2026-06-25 direction. **NO SVG import.** A functional GUI
**composer IS in scope** — what's out is only an *arbitrary-logic button* (a button running custom JS). The composer
assembles the shared widgets into a wizard's GUI and can also export a graphic ("functional + graphic").

Core principle (unchanged): **one stack, many expressions.** A component never carries its own logic — it declares a
binding into the op stack (params). The stack is the logic; the form, the blocks, and the 2D canvas are renderings of
it. **That's exactly why no logic-buttons are needed:** each widget's behaviour IS its param binding → the atom that
reads it. "Blocks share the form's GUI" = render the SAME rich widget in the block that the form already uses — and
this is a PROVEN, currently-shipping pattern, not aspirational: the datum (corner-grid) picker draws from ONE shared
module `ui/cornerGridSvg.js` consumed by the block field (`cornerGridField.js`), the form widget
(`formWidgets.js`), the wizard field (`pathAnchorField.js`) AND the stock editor (`stockEditor.js`).

The composer (Track D) is built ON the shared-widget foundation (Track C); the wizbar icon picker (Track A) is a
separate, simpler thing; the CAM asset editor (Track B) already exists and supplies the graphic-export engine.

---

## ⚑ BUILD ORDER (per the 2026-06-25 direction — YAGNI / rule of three)

This unified model is the **north star**, NOT the build sequence. Do **not** build the generic renderer as a
framework up front.

1. **START with Track A — the wizbar icon picker.** Smallest standalone win, independently useful, reuses the
   existing `iconEditor`, and commits us to none of the generic-control machinery.
2. **DEFER C1 (the generic `pick` renderer).** The unification already exists in ONE case — `cornerGridSvg` is one
   core across four surfaces today. Build concrete `pick` widgets **one at a time, reusing `cornerGridSvg`'s pattern
   directly**; extract the generic spec/renderer **only once ≥2 concrete pick widgets exist** and can be put side by
   side. Two real examples disagreeing is what reveals what's genuinely generic vs. what only looked generic on paper.
3. **Rule of thumb:** concrete widget → concrete widget → *then* extract the standard. Never standard-first.

---

## Track A — Wizbar icon PICKER (✅ SHIPPED v1 — emoji)

Goal: assign a custom wizard's **bar-button icon** from a curated set. A **picker, not an editor** (drawing a custom
icon is Track B). Distinct from everything else.

**✅ v1 shipped:** a curated emoji set + an icon button per custom-wizard row in Settings → Wizards
(`ui/wizardManagerPanel.js`: `ICON_CHOICES` + `openIconPicker`) → writes `iconOverride` via
`setEntryOverride(id, {icon})`; a custom op renders it through the existing emoji path (no commandDeck change).
"⌀ Default" clears it (back to ✦). Test: `tests/wizbar-icon-picker.spec.js`. **Follow-ups (optional):** curated
line-art SVG icons (needs `wizItemIcon` to let `iconOverride` win over `WIZ_ITEM_SVG` + an `ic:<id>` registry);
re-iconing built-ins (same change).

- **Seams:** `getLibrary`'s `iconOverride` + `setEntryOverride(opType, { icon })` (`blocks/wizardLibrary.js`); the bar
  renders icons from `ui/commandDeck.js` (`HEADER_ICONS` / `WIZ_ITEM_SVG` / `WIZ_GROUP_ICON`, curated line-art SVGs).
  Custom wizards currently get a fixed `✦`. There is **no GUI to pick an icon today** — that's the gap.
- **Build:** A1 — extract the `commandDeck` SVG set into a shared icon registry (a curated library). A2 — an icon-grid
  popover in Settings → Wizards (`ui/wizardManagerPanel.js`), one per custom-wizard row → writes the override →
  `ddcsRefreshWizardBar`. A3 — bar/dropdown render the override (already supported via `iconOverride`).
- **Out of scope:** authoring a brand-new icon graphic (that's Track B's editor).

---

## Track B — CAM asset EDITOR (already exists; essential for the CAM builder)

`ui/iconEditor.js` is a Figma-style **layer composer** (place tiles from `assets/svg/tileset.svg` + text/rect/line/
circle/arrow; move/scale/rotate/reorder; export a 360×180 24-bit BMP via `data/bmp.js`). It's wired into the **CAM
Pack Builder** (`ui/macrosApp.js` → `openIconEditor`) to author `camN.bmp` slot icons. This is the "editor," kept
**distinct** from Track A's picker; its home/customer is the CAM builder.

- **Scope:** keep CAM-focused; any improvements serve the CAM builder. No new greenfield build — extend in place.
- (Deferred/optional: reuse the editor to author a wizard graphic. For now the wizbar uses the simple picker.)

---

## Track C — One UNIFIED control standard (custom graphics + standard GUI on the same rails)

The big idea (per the 2026-06-25 direction): **custom graphics are the priority**, standard GUI is still needed —
so wire BOTH through the **same** declarative standard. A control is a **spec** + ONE generic renderer; the standard
widgets are *built-in* specs, custom graphics are *user-authored* specs. Same spec, same renderer, same dual adapters
(block field + form widget), same param binding → form/block parity is automatic, and "custom == standard."

This is a generalization of what already ships: the **datum** is the first `pick` spec. `ui/cornerGridSvg.js`
(`buildCornerCells` / `paintCornerGrid` / `CG`) is consumed by FOUR surfaces today (block field `cornerGridField.js`,
form `formWidgets.js`, wizard `pathAnchorField.js`, `stockEditor.js`) — proof the one-core/many-adapters pattern works.

**Every interactive control = one of two spec kinds:**
- **pick** — hit-regions → a VALUE. (datum, dropdown, toggle = 2 regions, cycle = advance-on-click, any custom picker)
- **handle** — a draggable handle → a NUMBER (over an axis/range, optionally a custom backdrop). (slider, xy-pad, steppers, any custom drag control)

```
control spec (data — persists on the wizard def, rides in .wizard):
{ graphic:     <composed layers from the iconEditor engine, or a built-in graphic>,
  interaction: { kind:'pick',   regions:[{shape, value, label}, …] }      // → enum/value
             | { kind:'handle', handles:[{id, axis|xy, min, max}] },      // → number(s)
  value:       'enum' | 'number' | group(x,y,w,h),
  param:       <binding → the atom socket> }
```

**Standard widgets become built-in specs** (not separate code): dropdown/toggle/cycle/datum → `pick`;
slider/xy-pad/rect/steppers → `handle`. **Native escape hatch:** a *free number* or *text string* has no natural
graphic — keep those as a thin native input tier (better keyboard/accessibility); everything interactive/graphic
runs on the unified standard.

**Keystone — how a field declares its control + renders in the block.** Today `bridge.js` `fieldKind` hardcodes
`cornergrid` for named datum fields (`CORNER_COLOUR`) and otherwise maps by value type; the block is built from the op
def's fields (`SCHEMA`), which is widget-agnostic. The unified renderer replaces that: a field carries a control spec,
and ONE generic Blockly field (`field_control`) + ONE generic form widget interpret it. Custom ops already carry
`widget` on the binding → extend it to a full spec; built-ins opt in per field.

**Phasing (concrete-first; the generic renderer is DEFERRED — see BUILD ORDER above):**
- **Cn — concrete `pick` widgets, one at a time.** Build each by reusing `cornerGridSvg`'s existing pattern directly
  (shared core module + Blockly field adapter + form widget), NOT a framework. The datum is #1 (already shipped).
  **#2 = the region-pick control ("make your own datum") — IN PROGRESS:**
  - ✅ **runtime form widget (v1, numeric)** — `ui/regionPickSvg.js` (shared core: `buildRegions`/`paintRegions`/
    `regionValueFromEvent`) + `regionPickWidget` in `formWidgets.js` (`widget:'region-pick'`). A spec `{viewBox,
    backdrop?, regions:[{shape:'rect'|'poly',…,value:<number>,label}]}` renders clickable rect/poly/freeform regions
    over an optional backdrop; a click commits the region's NUMBER (numeric socket → valid by construction). Test:
    `tests/region-pick-widget.spec.js`.
  - ✅ **block field adapter (`field_regionpick`)** — `blocks/blockly/regionPickField.js` (same shared core →
    form/block parity, like `cornerGridField`) + the `regionpick` reporter block (`wizards/ops/regionpick.js`); the
    `value` renders as the inline picker (`bridge.fieldKind`/`jsonDef`), and the SPEC rides the block's `data` as a
    JSON-string param (stackBridge round-trips non-field scalars). The picked NUMBER reduces into real G-code;
    `extractParamBlocks` turns a regionpick pill into a `widget:'region-pick'` binding (widgetConfig = parsed spec).
    Test: `tests/region-pick-block.spec.js` (Class-B render guard + round-trip). **Region-pick is now a genuine
    dual-adapter pick surface (form + block) — the real 2nd case beside the datum.**
  - ▶ **next:** the **authoring** flow ("make your own datum": compose the backdrop in `iconEditor` + mark regions +
    assign numbers + bind). Then enum/string region-pick once field-targeting lands; and (with datum + region-pick as
    two concrete dual-adapter pick widgets) the deferred generic `pick` renderer can finally be extracted.
- **C★ — extract the generic `pick` renderer + spec** ONLY once ≥2 concrete pick widgets exist and can be diffed.
  Re-express datum + the new one(s) as built-in `pick` specs to prove form/block parity. *Deferred until forced.*
- **handle widgets** (slider / xy-pad / rect / steppers) — same concrete-first discipline; slider/xy/rect already
  exist form-side. Generic `handle` renderer extracted later, same rule.
- **native tier** for plain number / text (thin native input — keyboard/accessibility).

Each piece: shared core + Blockly field adapter + form widget + **a Class-B render-guard test**
(`block.getHeightWidth().height > 0`, per the Blockly v13 trap) + a form round-trip test. Controls commit the same
param values (pick → enum/number, handle → number) so numeric sockets stay numeric → valid by construction.

## Track D — The authoring editor ("make your own datum") — UX SCOPE (review before code)

The "custom-GUI maker": a user creates a region-pick control = `{ backdrop, regions:[{shape, geometry, value, label}] }`
and binds it to a param → a `regionpick` block (spec in `b.data`) → renders in form **and** block (both shipped).
Below is the UX, written for review BEFORE implementation (per the handoff — "scope first, the region-drawing
surface + iconEditor reuse is the hard part").

**Flow:**
1. **Entry** — in Blocks **dev mode**, a "＋ Region pick" action (the authoring home, beside "expose value"). On save
   it inserts a `regionpick` reporter into the chosen value socket + records the binding.
2. **Backdrop** — composed via the **existing `iconEditor`** (its LAYERS), rendered to **SVG** via `stageSvg` →
   `spec.backdrop` (vector, crisp, re-editable by reopening iconEditor with the layers). Coordinate space = the
   iconEditor canvas (360×180) → `spec.viewBox = '0 0 360 180'`. Backdrop is optional (skip → blank).
3. **Regions** — draw **rect / polygon / freeform** on the backdrop; each gets a **NUMBER** (v1 numeric) + a **label**;
   select / move / delete / reorder. Freeform = a freehand drag simplified to a polygon.
4. **Bind** — name the param + choose which numeric value (socket) it drives (same gesture as dev-mode "expose value").
5. **Output** — a `regionpick` block (spec on `b.data`) → `extractParamBlocks` → the `widget:'region-pick'` binding.
   Re-edit: reopen the editor from the spec (spec → layers + regions).

**THE REGION-DRAWING SURFACE — RESOLVED: extract a shared DRAWING CORE (the A-vs-B fork was a false choice).**
"Reuse" = sharing CODE, not the same asset. (A) extending `iconEditor` overloads it (icon composition + region
semantics → one master's change breaks the other); (B) a separate editor duplicates the draw code. Neither is right.
Instead:
- Pull the **drawing primitives** (rect / polygon / freeform tools + stage / drag / select) into a small **CORE
  module** that BOTH `iconEditor` and the region editor consume.
- **Backdrop** reuses `iconEditor` (same operation, same core). **Region semantics** (value + label + hit-test —
  which icons don't have) live in their own **thin layer**. Draw code is **shared, not duplicated, not overloaded.**
- The region stays its **own PRIMITIVE**, NOT an `iconEditor` layer type.

**Why this is the load-bearing decision (not just tidiness) — the region is a cross-domain primitive.** A region =
a spatial zone on a backdrop mapping to a value, picked by clicking. Generalize backdrop → the part/stock drawing and
region → a feature (hole/pocket/edge) and you get a different CAM builder: **click features on the part instead of
typing coordinates** ([[prefer-gui-over-fields]] / [[2d-layout-canvas]]; see `CRAZY-IDEAS.md` → "Region primitive →
spatial CAM"). Gated on the same non-numeric/field-targeting boundary as #2 (a CAM region commits a FEATURE/op, not a
number — do NOT build the CAM angle now). The point for THIS build: if regions might later drive spatial CAM, they
must not be trapped inside `iconEditor`. So → extract the core.

**Smaller decisions:** backdrop as vector SVG (recommended) vs raster data-uri; freeform → simplified polygon vs
polygon-only (click points) for v1; values numeric in v1 (enum once field-targeting lands); the CAM Pack Builder is a
second consumer (slot authoring wants custom controls + icons on the same core).

**Build order (once greenlit):**
- ✅ **(1) extract the shared drawing core** — `ui/shapeStage.js` (`stageSvg` + `rotateVec`/`boxPoint` +
  `startGesture`/`applyGesture` + `HANDLE_XY`), lifted verbatim from `iconEditor` (W/H parameterized). `iconEditor`
  now consumes it; behaviour unchanged. Test: `tests/shape-stage.spec.js` (core unit + an iconEditor smoke test it
  never had). The `poly` shape is already in the core, ready for region freeform.
- ✅ **(2) the region editor** — `ui/regionEditor.js` (`openRegionEditor(initial, onSave)`): draw regions on the
  shared `shapeStage` (move/resize/rotate handles reused), each with a **value + label**, over an optional backdrop
  composed by **reusing `iconEditor`**; saves a region-pick spec. v1 = rect regions; a rotated rect **bakes to a
  polygon** on save (via `boxPoint`) so authoring matches the runtime. Load round-trips rect + poly. Test:
  `tests/region-editor.spec.js`. (Poly/freeform point-editing is the v1.x follow-up; the runtime + bake already
  handle polygons.)
- ✅ **(3) wire** the editor into authoring — a dev-mode **✎ regions** affordance on the `regionpick` block
  (`devMode.augmentRegionPick` → `openRegionAuthor`) opens `openRegionEditor` and writes the spec back to the SAME
  `block.data` channel the runtime + round-trip use (one spec, no divergence). Gated to dev mode. Test:
  `tests/region-author-block.spec.js`.

**Selection model (shipped with the picker):** topmost-wins hit-test (SVG paint order → `e.target`), single-select
(one number committed), the form widget **echoes the picked region's label** (`regionLabel`), and the selection
visual uses the SAME accent + a `rp-region`/`rp-on` CSS class hook as the datum picker (theming restyles both).

**"Make your own datum" is COMPLETE end-to-end:** shared core (`shapeStage`) → region editor (`regionEditor`) → ✎
authoring on the `regionpick` block → runtime in form (`regionPickWidget`) + block (`field_regionpick`) → reduces to
real G-code → round-trips + rides `.wizard`. Follow-ups: poly/freeform point-editing in the editor; enum/string
region values (needs field-targeting from #2).
Each step tested; the refactor (1) landed first and independently.

---

## Parametric-canvas atom — investigation + first list-valued instance

`viz/featureCanvas.js` is the **parametric-canvas core** (draggable handles + click-to-type dimension HUD, driving op
*parameters*, never freeform geometry — used form-side by drill(array)/pocket/contour/slot/text/surfacing views). Its
**pure form** is `(params → picture) + (interaction → Δparams)` — a surface-agnostic 2-way binding between a value-set
and a manipulable drawing. Every control we've built is a special case of it (datum/region-pick = 1 value; xy-pad/rect
= a few; FeatureCanvas = a whole param set). Extracting that pure form → the deferred generic standard (`C★`); the
forcing function is wanting the canvas *in the blocks*, where the form-only `setFields` tangle blocks reuse.

**✅ First LIST-valued instance — the coordinate-list positioner** (`coordListWidget`, `widget:'coord-list'`): a GROUP
of XY points (draggable markers on FeatureCanvas) + a shared Z, with add/delete. State = `{ points:[{x,y}], z }`;
commits the whole list (new binding `type:'list'`). Proves the atom can author an *arbitrary coordinate positioner*
(not a fixed grid/line/circle pattern) — each marker drives a list-entry param, so it stays parametric (the list IS
the model, no CAM-trap). Additive (no production-view refactor). Test: `tests/coord-list-widget.spec.js`.
**Follow-ups:** per-point Z; the block adapter (`field` mounting FeatureCanvas → the positioner in the Blocks view);
then migrate the existing views onto the extracted pure `(params↔picture)` atom.

## Cross-cutting

- **Class-B render trap** (Blockly v13): every new field needs a render-guard test, not just an emit/model assertion.
- **Valid by construction:** rich widgets commit the same param values (cycle/stepper → numbers, toggle → 1/0), so
  numeric sockets stay numeric and committed ops stay clean.
- **CAM builder** is a key consumer of both the icon work (B) and rich controls (C) for slot authoring.

## Open decisions (resolve at build time)
1. **C1 mechanism** — `def.widgets` hint (recommended) vs deriving solely from bindings (custom ops only).
2. **Dropdown** — keep Blockly native (recommended) or build a rich field.
3. **Track A icon source** — curated `commandDeck` set only, or also surface `tileset.svg`-derived glyphs.
