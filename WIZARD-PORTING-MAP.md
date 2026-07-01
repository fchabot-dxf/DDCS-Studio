# Wizard Porting Map — Wizard-as-Data Conversion

> **Goal:** every built-in wizard becomes a DATA definition (`{template, bindings}`), rendered by the single generic `userOpView` consumer — no per-wizard view JS, no per-wizard layout SVGs.

## Architecture — the shared consumer pipeline

```
template (blocks) ──→ registerUserOp() ──→ def.panel  (form3d/form2d/form)
                            │                  def.layout (none/corner/drill/slot/...)
                            │                  def.sim    (rotary/machine/magazine flags)
                            │                  setUserSimIntent() / setUserSimStarts()
                            │
                     userOpView.update()
                            │
                    ┌───────┴──────────┐
                    │                  │
             renderDeclaredLayout()   opSimContext(opType)
                    │                  │
              LAYOUT KINDS        SIM INTENT
              (FeatureCanvas)     (previewMachine / previewRotaryFixture / previewMagazine)
```

## Legend

| Column | Meaning |
|---|---|
| **Status** | ✅ done / 🔄 in progress / ⬜ not started / 🚫 n/a |
| **Wizard** | The JS wizard module (G-code generator) |
| **View** | The JS view module (DOM glue + canvas schematic) |
| **HTML panel** | The `#wiz_<name>` `<div>` in `index.html` |
| **Data port** | The data-def file in `blocks/dataOps/` |
| **Layout kind** | The `LAYOUT_TYPES` registry key in `panelTypes.js` |
| **Bindings** | The parameter→block-socket mapping table |
| **Renderer** | Whether a `renderDeclaredLayout` dispatch exists for this kind |


## Status

| # | Built-in | Status | Wizard | View | HTML panel | Data port | Layout kind | Bindings | Renderer | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| # | Built-in | Status | Wizard | View | HTML panel | Data port | Layout kind | Bindings | Renderer | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | **Corner (probe)** | ✅ ported | `cornerWizard.js` | — | — | `cornerPort.js` | `none` | ✅ | 🚫 | Sim intent: `forceMachine: true` (probe op with machine movement). Panel: `form3d`. No layout canvas — uses 3D machine preview. |
| 1 | **Drill** | ✅ ported | `drillWizard.js` | `drillView.js` | `#wiz_drill` | `drillData.js` | `drill` | ✅ | ⬜ | Pattern grid/circle/rect/line. Panel: `form3d`. Layout kind registered in `LAYOUT_TYPES`; `renderDrillLayout` not yet implemented. |
| 2 | **Surfacing** | ✅ ported | `surfacingWizard.js` | `surfacingView.js` | `#wiz_surfacing` | `surfacingData.js` | `surfacing` | ✅ | ⬜ | Rect region + stepover. Panel: `form3d`. Layout kind registered; `renderSurfacingLayout` not yet implemented. |
| 3 | **Slot** | ✅ ported | `slotWizard.js` | `slotView.js` | `#wiz_slot` | `slotData.js` | `slot` | ✅ | ⬜ | A→B centreline + width. Panel: `form2d`. Layout kind registered; `renderSlotLayout` not yet implemented. |
| 4 | **Text** | ✅ ported | `textWizard.js` | `textView.js` | `#wiz_text` | `textData.js` | `text` | ✅ | ⬜ | Text outline + height. Panel: `form2d`. Layout kind registered; `renderTextLayout` not yet implemented. |
| 5 | **ATC warmup** | ✅ ported | `atcWarmupWizard.js` | `atcViews.js` | `#wiz_atc_warmup` | `atcWarmupData.js` | `none` | ✅ | 🚫 | Sim intent: `forceMachine`. Panel: `form3d`. No layout canvas needed. |
| 6 | **Pocket** | ⬜ not ported | `pocketWizard.js` | `pocketView.js` | `#wiz_pocket` | — | `pocket` | WIP | ⬜ | 4 shapes (rect/circle/polygon/ellipse). Panel: `form3d`. Needs `pocketData.js`, bindings, layout renderer. |
| 7 | **Contour** | ⬜ not ported | `contourWizard.js` | `contourView.js` | `#wiz_contour` | — | `contour` | WIP | ⬜ | 4 shapes + side (inside/outside). Panel: `form3d`. Needs `contourData.js`, bindings, layout renderer. |
| 8 | **Edge (probe)** | ⬜ not ported | `edgeWizard.js` | `edgeView.js` | `#wiz_edge` | — | `edge` | WIP | ⬜ | Single-axis edge find. Panel: `form3d`. Has start-marker canvas. |
| 9 | **Middle (probe)** | ⬜ not ported | `middleWizard.js` | `middleView.js` | `#wiz_middle` | — | `middle` | WIP | ⬜ | 2-axis/boss centre find. Panel: `form3d`. Has per-pass start canvas + TRAVEL-START integration. |
| 10 | **Corner (probe)** | ✅ ported | — | — | — | `cornerPort.js` | `none` | ✅ | 🚫 | (Same as #0 — now uses 3D machine preview with `forceMachine: true`.) |
| 11 | **Alignment (probe)** | ⬜ not ported | `alignmentWizard.js` | `alignmentView.js` | `#wiz_alignment` | — | `alignment` | WIP | ⬜ | A→B alignment. Panel: `form3d`. Has A/B start-marker canvas. |
| 12 | **Rotary Clock (probe)** | ⬜ not ported | `rotaryClockWizard.js` | `rotaryClockView.js` | `#wiz_rotary_clock` | — | `rotary_clock` | WIP | ⬜ | Rotary A-axis. Sim: `showRotaryRig: true`. Panel: `form3d`. |
| 13 | **Rotary Center (probe)** | ⬜ not ported | `rotaryCenterWizard.js` | `rotaryCenterView.js` | `#wiz_rotary_center` | — | `rotary_center` | WIP | ⬜ | Rotary centre find. Sim: `showRotaryRig: true`. Panel: `form3d`. |
| 14 | **ATC Length** | ⬜ not ported | `atcLengthWizard.js` | `atcViews.js` | `#wiz_atc_length` | — | `none` | WIP | 🚫 | Sim intent: `forceMachine`. Panel: `form3d`. |
| 15 | **ATC Check** | ⬜ not ported | `atcToolCheckWizard.js` | `atcViews.js` | `#wiz_atc_check` | — | `none` | WIP | 🚫 | Sim intent: `forceMachine`. Panel: `form3d`. |
| 16 | **ATC Change** | ⬜ not ported | `atcChangeWizard.js` | `atcViews.js` | `#wiz_atc_change` | — | `none` | WIP | 🚫 | Sim intent: `forceMachine` + `showMagazine: true`. Panel: `form3d`. |
| 17 | **ATC Test** | ⬜ not ported | `atcTestWizard.js` | `atcViews.js` | `#wiz_atc_test` | — | `none` | WIP | 🚫 | Sim intent: `forceMachine`. Panel: `form3d`. |
| 18 | **ATC Table** | ⬜ not ported | `atcTableWizard.js` | `atcViews.js` | `#wiz_atc_table` | — | `none` | WIP | 🚫 | Sim intent: `forceMachine` + `showMagazine: true`. Panel: `form3d`. |
| 19 | **Homing** | ⬜ not ported | `homingWizard.js` | `homingView.js` | `#wiz_homing` | — | `none` | WIP | 🚫 | Sim intent: `forceMachine`. Panel: `form3d`. Proxy G-code for sim. |
| 20 | **WCS** | ⬜ not ported | `wcsWizard.js` | `wcsView.js` | `#wiz_wcs` | — | `none` | WIP | 🚫 | Sim intent: none. Panel: `form3d`. |
| 21 | **Communication** | ⬜ not ported | `communicationWizard.js` | `commView.js` | `#wiz_comm` | — | `none` | WIP | 🚫 | No G-code (serial comm). Panel: `form`. No preview. |


## What needs to happen per port

### Phase A — every ported data-op (drill, surfacing, slot, text, atcWarmup)
**Already done**: data-def file, bindings table, registered in `seedDefaultPortedUserOps()`.
**What changes in the shared consumer**: ✅ now reads `def.panel`/`def.layout`/`def.sim` directly (no template re-scan).
**What changes in `userOpView.update()`**: ✅ mutual exclusion + auto sim context.

### Phase B — layout kind registry (for every op that has a 2D schematic)
**✅ Done — all 13 layout kinds declared in `LAYOUT_TYPES` (`panelTypes.js`):**
```
none  |  corner  |  drill  |  slot  |  surfacing  |  text
pocket | contour | edge | middle | alignment | rotary_clock | rotary_center
```

Each built-in's `build<Op>Spec()` function (currently in the view JS) still needs to become a registered layout renderer function that `renderDeclaredLayout` can dispatch to. Currently only `renderCornerLayout` exists. For the other 12 layout kinds, `renderDeclaredLayout` falls through to the `form2d`/`form3d` panel mode — meaning 2D schematic views still come from the legacy `*View.js` modules, not the shared consumer.

```js
// renderDeclaredLayout dispatches by kind (stub pattern for each new kind):
export function renderDeclaredLayout(container, def, params) {
    const kind = def.layout && typeof def.layout.kind === 'string' ? def.layout.kind : '';
    if (kind === 'corner') return renderCornerLayout(container, params || {});
    // if (kind === 'drill') return renderDrillLayout(container, def, params);
    // if (kind === 'slot') return renderSlotLayout(container, def, params);
    // ... etc
    if (panelType(def.panel).mode === '2d') {
        renderLayout2D(container, def, params);
        return true;
    }
    return false;
}
```

Each renderer function reimplements the `build<Op>Spec()` logic — but reads bindings from `def.bindings` (the declared list), not form field IDs. The benefit: the data-op port already declares all the same bindings, so the layout renderer is fully parameter-driven.

### Phase C — data-op ports for the remaining built-ins
For each remaining built-in (pocket, contour, edge, middle, alignment, rotary, ATC, homing, WCS):
1. Create `blocks/dataOps/<op>Data.js` — the data-def file (template + bindings + `userOpFromStack`)
2. Register it in `app.js seedDefaultPortedUserOps()`
3. Add its layout kind renderer in `panelTypes.js` (if it has a 2D schematic)
4. Verify byte-identical emission (per `*-as-data.spec.js` test pattern)
5. Wire its `sim` declaration (e.g. rotary ops → `showRotaryRig: true`, ATC → `forceMachine: true`)

### Phase D — retire the built-in view JS (deferred)
Once ALL built-ins are ported AND their data-defs verified byte-identical, each built-in wizard view can be replaced by routing the built-in type to `userOpView` — the same generic panel. The `#wiz_<name>` HTML panels would become dead DOM (hidden, then removed).

This is a LATER phase: the old wizard views still work alongside the new data-ports. Both emit the same G-code. The data port just ALSO renders through the shared consumer, giving the user the same experience as a user-authored op.

## Key files reference

| File | Role |
|---|---|
| `web/wizards/ops/panelTypes.js` | Layout registry (`LAYOUT_TYPES` — 13 kinds registered) + `renderDeclaredLayout` dispatcher (only `corner` renderer implemented) |
| `web/wizards/views/userOpView.js` | Generic consumer — reads `def.panel`/`def.layout`/`def.sim` |
| `web/blocks/userOps.js` | Resolvers: `resolvePanelMeta`, `resolveLayoutMeta`, `resolveSimMeta` |
| `web/viz/opSimContext.js` | Sim intent per opType (declared for custom, static sets for built-ins) |
| `web/wizards/ops/panel.js` | The `panel` block definition |
| `web/wizards/ops/layout.js` | The `layout` block definition |
| `web/wizards/ops/sim.js` | The `sim` block definition |
| `web/wizards/ops/userRoot.js` | The `user_root` block — wraps UI metadata + execution children |
| `web/app.js` | `seedDefaultPortedUserOps()` — seeds all data-op ports on startup |
| `web/viz/canvasWidgets.js` | Reusable gesture registry (`point`, `rect`, `radial`, `projLength`, `scaleX`, `shear`, `length`) |
| `web/viz/featureCanvas.js` | Shared 2D FeatureCanvas renderer |
