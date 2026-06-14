# Blockly — vendored version notes

**Version: 12.5.1** (see `VERSION`). Bundle: `blockly.min.js` (UMD → global `Blockly`).
Typings index: `blockly.d.ts` (= upstream `core/blockly.d.ts`, the namespace index — grep it to confirm a
symbol *exists* in our version). Per-symbol **signatures** aren't in that file; fetch the module on demand:
`https://unpkg.com/blockly@12.5.1/core/<module>.d.ts` (e.g. `serialization/workspaces.d.ts`).

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

## Blockly APIs DDCS depends on (all confirmed present in 12.5.1)

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

## How to verify a Blockly API before using it (our "version tooling")

There is **no Blockly-specific MCP/skill**. The workflow that prevents version surprises:
1. `grep <symbol> blockly.d.ts` — does it exist in 12.5.1 at all?
2. For the signature: WebFetch `https://unpkg.com/blockly@12.5.1/core/<module>.d.ts`.
3. For breaking-change context: the Blockly GitHub **release notes** (v11 = rendering + serialization changes).
