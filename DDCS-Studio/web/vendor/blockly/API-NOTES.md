# Blockly — vendored version notes

**Version: 13.0.0** (see `VERSION`). Bundle: `blockly.min.js` (UMD → global `Blockly`).
Typings index: `blockly.d.ts` (= upstream `core/blockly.d.ts`, the namespace index — grep it to confirm a
symbol *exists* in our version). Per-symbol **signatures** aren't in that file; fetch the module on demand:
`https://unpkg.com/blockly@13.0.0/core/<module>.d.ts` (e.g. `serialization/workspaces.d.ts`).

## Upgraded 12.5.1 → 13.0.0 (2026-06-25)
v13 is an **accessibility** release (keyboard-nav + screenreader/ARIA on by default); no runtime perf change we
needed. We kept the **explicit `renderer:'geras'`** — v13's new default is `thrasos` (slightly more performant, and
already available on either version by setting `renderer:'thrasos'`; switching would reshoot the block PNGs).
The upgrade was a **drop-in**: swap `blockly.min.js` + `blockly.d.ts` + `VERSION`, **no code changes** — the full
Playwright suite stayed green (the Class-B render guard, the custom `field_cornergrid` guards, single-inject +
scale-safety all pass on v13). v13 watch-items that did NOT bite us but to keep in mind: `box-sizing:border-box`
default, SVG icon assets + media now default to `blockly.com/media`, removed deprecated APIs, new default keyboard
shortcuts. **Inline authoring is feasible on v13** (stage-6 spike): appending standard fields to a block —
`block.appendDummyInput().appendField(new Blockly.FieldCheckbox/FieldTextInput)` — grows the block and renders the
row inline (proven: a block 30px→60px). Wrap the append in `Blockly.Events.disable()/enable()` so the workspace
change listener doesn't reproject the dev-only fields away.

## The v11/v12 rendering trap (what bit us — keep this in mind)

Blockly **v11 removed `BlockSvg.render()`** and moved drawing to an async **render queue**
(`renderManagement`). So the old "build blocks by hand" recipe —
`ws.newBlock(t)` → `block.initSvg()` → `ws.render()` — produces **valid block MODELS that are never drawn
or positioned**. Symptom we hit: `getTopBlocks()`/emit work (G-code appears) but the canvas is blank and
zoom/center find nothing to frame ("the code is there but I can't see the blocks").

**Do this instead** — load through serialization, which drives the render queue correctly:

```js
Blockly.serialization.workspaces.load(state, ws);   // state = { blocks: { languageVersion: 0, blocks: [...] } }
```

That's what `blocks/blockly/stackBridge.js` `stackToWorkspace()` does (stack → Blockly JSON state → load).
`workspaces.load` clears the workspace first. If you ever must build blocks imperatively, flush with
`Blockly.renderManagement.triggerQueuedRenders()`.

## The CSS `zoom` / `transform` ancestor trap (what bit us next)

Blockly **breaks inside a CSS-scaled ancestor** — it lays out via `getBoundingClientRect` and mounts its
popup singletons (`WidgetDiv` / `DropDownDiv` / `Tooltip`) on `document.body`. If an ancestor (or `body`)
has `zoom` or `transform: scale()`, the blocks are mispositioned/invisible and you get a crash on window
resize: `DropDownDiv.repositionForWindowResize → hide → Cannot read properties of undefined (reading 'style')`.

DDCS scales the whole UI with `document.body { zoom }` (the ScaleManager). The fix:
- **Force `<body>` to zoom 1 while the Blocks tab is active** — `ScaleManager.applyBodyZoom()` checks whether
  `#blocks-app` is visible and, if so, sets `body { zoom: 1 }` (the app scale still applies on the other tabs).
  `showApp` re-applies on every tab switch, so entering Blocks flips body→1 *before* Blockly injects. Blocks
  scale via Blockly's own workspace zoom instead.
- ⚠️ **A counter-zoom on `#blocks-app` (`zoom = 1/bodyZoom`) does NOT work** — *nested* CSS zoom still corrupts
  `getBoundingClientRect`, so `zoomToFit` mis-scaled (measured 1.87×) and parked the blocks far off-screen
  (`screenRect.y ≈ 1604`). "Net 1.0" is not the same as "no zoom". Don't go down that path again.
- ⚠️ **Do NOT call `Blockly.setParentContainer(#blocks-app)`** (we used to, "belt-and-suspenders"). It relocates the
  popup singletons but leaves `DropDownDiv`'s module-level `div` uncreated, so the GLOBAL window-resize handler
  crashes in `DropDownDiv.hide()` (`Cannot read properties of undefined (reading 'style')`) on *every* resize —
  which aborts the async render queue and leaves the canvas blank. Leave popups on `<body>` (where Blockly puts
  them) and rely on the body-zoom-1 rule above. As a belt: after `inject`, call `B.DropDownDiv.createDom()` /
  `WidgetDiv.createDom()` / `Tooltip.createDom()` so that `div` always exists.

## The double-inject trap (the ACTUAL "nothing renders" — what finally bit us)

`initBlocks()` is `async` and only sets its `api` singleton at the END. The header tabs are **double-wired**
(inline `onclick` in `index.html` + `addEventListener` in `gatewayStatus.js`), so ONE Blocks-tab click fires
`showApp('blocks')` **twice**. Both calls sailed past `if (api)` while awaiting `loadBlockly()` and **injected two
Blockly workspaces** into `#blk-ws`; the 2nd stacks *below* the 1st (offset ≈ host height). The loaded stack went
into the off-screen 2nd workspace while the visible 1st stayed empty → "grid shows, no blocks". (Tell in the
logs: `init` runs twice; block `getBoundingClientRect().y ≈ host.y + host.height`.)

Fix: **make `initBlocks` idempotent under concurrency with a cached build PROMISE** — concurrent callers await the
SAME single inject (never a 2nd workspace), and only resume once `ddcsLoadBlockStack` is ready (so the first
`buildActiveOpStack()` actually loads and the second no-ops via its `loadedSig` dedup). An early-return latch is
NOT enough: it lets the 2nd caller run `buildActiveOpStack()` before load is ready, consuming the dedup and
dropping the stack. Also: **load-and-leave** — never `zoomToFit`/`scrollCenter` on load (the metric is transiently
wrong right after the tab appears); pin a fixed `setScale(0.9)` + `scroll(30,30)` so placement is metric-independent.

Guards: `tests/blocks-single-inject.spec.js` (fires the double-click race → asserts exactly ONE workspace SVG,
op in view, no page errors) + `tests/blocks-scale-safety.spec.js` (Blocks tab forces body zoom 1, no counter-zoom,
op rect IN the host). Invisible to plain headless render tests, which call `showApp('blocks')` once.

## Blockly APIs DDCS depends on (all confirmed present in 13.0.0)

| API | Where we use it |
| --- | --- |
| `Blockly.inject(div, opts)` | `blocksApp.js` — mount the workspace (`renderer:'geras'`, theme, toolbox) |
| `Blockly.svgResize(ws)` | `blocksApp.js` ResizeObserver — size the SVG when the tab gets dimensions |
| `Blockly.serialization.workspaces.load(state, ws)` | `stackBridge.js` — render a stack (the fix above) |
| `Blockly.defineBlocksWithJsonArray(defs)` | `bridge.js` — define every op as a block |
| `Blockly.Events` (`.SELECTED`, `isUiEvent`) | `blocksApp.js` change listener — selection vs re-emit |
| `Blockly.Theme` | `blocksApp.js` `ddcsTheme()` |
| `ws.getTopBlocks(ordered)` / `block.getNextBlock()` / `getInput()` | `stackBridge.js` `workspaceToStack()` |
| `ws.getAllBlocks()` / `ws.getBlockById(id)` / `block.select()` | tests + `applySelection` |
| `ws.zoomToFit()` / `ws.clear()` / `ws.getCanvas()` | `blocksApp.js` framing, tests |
| `block.getHeightWidth()` | `tests/blocks-render.spec.js` — assert blocks actually rendered |
| `Blockly.fieldRegistry.register` + custom `Field` subclass | `cornerGridField.js` — inline 3×3 corner picker (`field_cornergrid`) |

## Custom fields (first one: `field_cornergrid`)

`blocks/blockly/cornerGridField.js` is the project's first CUSTOM field — an inline 3×3 grid drawn on the block
(PlaceOnStock's attach / path-datum pickers). The recipe (works on 12.5.1 **and 13.0.0** — its guards pass on v13):
- `class X extends Blockly.Field`; `static fromJson(opts)` → `new X(opts.value, undefined, opts)`; set
  `this.SERIALIZABLE = true` and `this.size_ = new Blockly.utils.Size(w,h)` in the ctor.
- `initView()` builds the SVG into `this.fieldGroup_` (do NOT call `super.initView()` — it adds an unwanted text
  element). `render_()` repaints + re-sets `size_`; `doClassValidation_(v)` constrains the value.
- Inline interaction (no popup editor): bind native `pointerdown` on each cell and `e.stopPropagation()` so the
  click PICKS instead of starting a block drag. (No `showEditor_` → not a dropdown field.)
- Register in `installBlockly()` BEFORE `defineBlocksWithJsonArray`; reference from a JSON block def as
  `{ type:'field_cornergrid', name, value, colour }`. The bridge routes a field to it via `fieldKind()==='cornergrid'`
  (see `CORNER_COLOUR`); the value round-trips as a plain string field (`getFieldValue`/`setFieldValue`).
- Guard: `tests/place-on-stock-block.spec.js` (cells render, per-datum colour, click-to-pick, value re-emits).

## How to verify a Blockly API before using it (our "version tooling")

There is **no Blockly-specific MCP/skill**. The workflow that prevents version surprises:
1. `grep <symbol> blockly.d.ts` — does it exist in 12.5.1 at all?
2. For the signature: WebFetch `https://unpkg.com/blockly@13.0.0/core/<module>.d.ts`.
3. For breaking-change context: the Blockly GitHub **release notes** (v11 = rendering + serialization changes).
