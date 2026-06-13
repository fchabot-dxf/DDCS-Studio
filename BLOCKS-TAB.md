# Blocks Tab — Feature Notes

A Tinkercad-Codeblocks-style tab for DDCS Studio: stack visual op-blocks → live G-code + preview.
Build-first, learn-G-code-by-revealing. This is the **feature/implementation** doc; the *why* and the
broader architecture live in [MULTI-OP-STACKING.md](MULTI-OP-STACKING.md).

Status: **live STUDIO tab** — mounted natively via `window.showApp('blocks')`, follows the app theme
(reuses `.op-btn`/theme tokens; black code/preview "screen" like the editor). Engine verified in Node.
Variables + Control (Codeblocks-style) shipped. The standalone prototype page was removed — the app tab
is the single UI; the engine is headless-testable in Node.

---

## The idea

- **Codeblocks is the DNA.** A block program is a tree of primitives; STUDIO features are just
  compositions (presets) of the same primitives. Proven: `drill == array(bore)`, byte-identical.
- **Three altitudes, one engine:** motion atoms → composed feature blocks → presets.
- **Learn G-code while doing real projects:** the code is on-demand (per-block reveal), not a constant
  wall; the preview + (future) lint make catastrophic-but-creative code *visible* rather than blocked.

## Engine

`wizards/ops/` — the primitive registry (the DNA). Each module = one primitive (kernel + a
self-describing block def: `kind`, `defaults`, `fields`, `emit`).

| file | block | kind | notes |
| ---- | ----- | ---- | ----- |
| `ops/line.js` | Line | `leaf` | straight groove A→B, zig-zag step-down (**new** kernel) |
| `ops/bore.js` | Bore | `leaf` | ring-step hole Ø≥tool (extracted from drillWizard) |
| `ops/drill.js` | Drill | `leaf` | peck plunge (extracted from drillWizard) |
| `ops/probe.js` | Probe | `move` | one `G31` move; `step(pt)` lets path modifiers sweep it |
| `ops/array.js` | Array | `container` | STAMP: pattern points × child (extracted: `patternPoints`) |
| `ops/helix.js` | Helix | `path` | SWEEP: a move child along a 3D helix (**new**) |
| `ops/count.js` | Count | `loop` | Codeblocks loop: run sub-stack per step, index in scope (`from`/`to`/`by`) |
| `ops/set.js` | Set | `var` | bind a variable (input or derived); later fields reference it |
| `ops/expr.js` | — | — | `evalExpr(str, scope)` — arithmetic + variables (the Math backbone) |
| `ops/util.js` | — | — | `num`, `r3` |
| `ops/index.js` | — | — | `PALETTE` / `BLOCKS` / `CATEGORIES` registry; kernel + `evalExpr` re-exports |

`blocks/blockModel.js` — the program model + recursive `emit()` fold:
- `leaf`/`move` → `def.emit(params, dx, dy)`
- `container` → stamp child(ren) translated to each point
- `path` → sweep a `move` child (`child.step(pt)`) to each generated point
- `var` (`Set`) → bind a variable in the threaded `scope`; `loop` (`Count`) → run children per step with
  the index in a child scope. Any field can be an expression — `resolveParams()` evaluates it against the
  scope **before** the kernel runs, so kernels still receive plain numbers and never change.
- `emitMapped(blocks)` → `{ text, lines, map }`; `map[i]` = ancestry of block ids that produced line `i`
  (null = program header/footer/seam) — powers per-block code reveal + linked selection.
- `emitProgram(blocks)` = back-compat string wrapper; both wrap with the shared spindle header/footer
  (`cuttingBlocks.js`).

**Compositions (verified in Node):**
- `drill` = `array(bore)` → 147 moves, byte-identical to the STUDIO drill wizard.
- helical probe = `helix(probe)` → 120 `G31`, monotonic descent −0.08 → −10 mm.

## UI — `blocks/blocksApp.js` (the STUDIO Blocks tab)

`initBlocks()` builds the tab inside `#blocks-app` (markup in `index.html`), lazy-loaded by
`ui/gatewayStatus.js` on first open. Palette grouped by `CATEGORIES` (`.op-btn` per app theme) ·
pannable/zoom block canvas · category-coloured cards (Ops/Modify/Control/Variables); loops "embrace"
their sub-stack · expression fields (any field can hold `i*spacing`) · live G-code · **2D/3D preview
toggle** (2D canvas + lightweight three.js; reuses `parseGcode`) · **Play** (2D progressive reveal) ·
**per-block code reveal** (click a block ⇄ its emitted G-code lines light up / dim the rest; Esc clears).
Styling is scoped under `#blocks-app` in `styles.css` (chrome = theme tokens; code/preview = black screen).

**Run it:** boot the app and click the **Blocks** tab:
```
cd DDCS-Studio/web && python -m http.server
# open  http://localhost:8000/index.html  → click BLOCKS
```

## Reuse vs. new

- **Reused:** `words.js`/`dialect.js` (G-code DSL), `cuttingBlocks` header/footer, DDCS probe vars,
  `parseGcode`; at integration `GcodeViz3D` (incl. feed-true `setAnimate`), `GcodeSimulator`,
  `FeatureCanvas`.
- **New:** the composition layer (block tree + fold-emit), the self-describing registry, two kernels
  (`lineCut`, helix), and the blocks-tab UX.

## Next

1. ~~**Categories**~~ ✓ **done** — each block def carries a `category` (`Ops`/`Modify`); the palette
   groups by the canonical `CATEGORIES` order (Ops / Modify / Control / Math / Variables). Empty
   categories don't render yet; buttons are coloured per category.
2. **STUDIO integration** — ✓ **tab mounted** (`blocks/blocksApp.js`, lazy-loaded by `ui/gatewayStatus.js`;
   reuses `.op-btn`/theme tokens, black code/preview "screen" like the editor). **Remaining:** re-express
   wizards as stacks (form drives a stack's params); swap the mini-3D for the full `GcodeViz3D`.
3. ~~**Per-block code reveal + line→source map**~~ ✓ **done** — `emitMapped` returns a line→source map;
   clicking a block highlights its emitted lines (dims the rest) and vice-versa. Next on this thread:
   reuse the same per-op color across the 2D/3D preview + stack, and code folding.
4. **Motion-safety lint** — rapid-into-stock, probe-above-probe-feed, over-plunge (warn/teach, don't
   block — catastrophic code stays *possible*, just *visible*).
5. ~~**Variables/expressions + Control** blocks~~ ✓ **done** — `Set` (input/derived vars, `ops/set.js`),
   `Count` loop (`ops/count.js`, `from`/`to`/`by`, index in scope), and `evalExpr` (`ops/expr.js`) so any
   field can be an expression (`grandeur/4 - 2`, `i*spacing`). Resolved against a threaded scope at emit.
   Not yet: an `If`/conditional block, and a variables panel / draggable variable pills (Codeblocks-style).

---

## Handoff — for a new agent

App root is `DDCS-Studio/web/`. It's a **no-build ES-modules browser app** (plain `import`/`export`,
no bundler/transpile). Paths below are relative to that root.

### Run & verify
- **App (browser):** ES modules need http, not `file://`:
  `cd DDCS-Studio/web && python -m http.server` → open `http://localhost:8000/index.html` → click **BLOCKS**.
  (Headless check: Playwright is installed under `DDCS-Studio/node_modules` — drive `index.html`, click
  `.tab[data-app="blocks"]`, screenshot.)
- **Engine (Node):** the kernels are pure JS (no DOM) — `ops/*`, `blocks/blockModel.js`,
  `wizards/cuttingBlocks.js`, `wizards/words.js`, `wizards/dialect.js`, `wizards/probeBlocks.js` all
  run in Node. **Gotcha:** `node --experimental-default-type=module` is **rejected** by the installed
  build. Run an ESM test like this instead:
  ```bash
  WEB=DDCS-Studio/web
  printf '{"type":"module"}' > "$WEB/package.json"   # temporary, makes the .js files ESM
  node "$WEB/yourtest.mjs"
  rm -f "$WEB/package.json"
  ```
  This is exactly how `drill == array(bore)` and `helix(probe)` were proven.

### Conventions you must respect to integrate into STUDIO
- **Top-level tabs** are apps switched by `window.showApp('studio'|'gateway'|...)` — buttons carry
  `data-app=`, wired by `ui/gatewayStatus.js`. A "Blocks" tab is a new app here.
- **Wizards are modal panels** with a **view contract**: a view object (`type`, `panelId`,
  `codeElId`, `inputIds`, `onOpen(ctx)`, `update(ctx)`) registered in `wizards/views/index.js`;
  `ctx.update()` / `ctx.preview3D(gcode, containerId)` are provided by `wizardManager.js`. Panels are
  markup in `index.html` (`<div id="wiz_drill" …>`). Mirror this shape for a blocks view.
- **three.js is a global** (`window.THREE`, `<script defer src="assets/vendor/three.min.js">`).
  `viz/gcodeViz3d.js` (`GcodeViz3D`) is the real 3D viewer **but** depends on app context
  (jog pendant, settings, nav cube) — it works inside the app, not on a bare page (that's why the
  prototype uses a mini three.js renderer). `parseGcode` (`gcodeParser.js`) is reusable standalone.
- **Emit DSL:** build G-code through `wizards/words.js` (`G/X/Y/Z/F/P/set/line/block` + the `fmt`
  back-door) and `wizards/dialect.js` (`ifGoto/goto/g53/wcsBase` + the `rules` back-door). Program
  wrap = `headerBlock`/`footerBlock` in `wizards/cuttingBlocks.js`.

### DDCS G-code gotchas (read before adding emitting primitives)
There's a **`ddcs-expert` skill** — use it. Key quirks the DSL already encodes: `G53` needs a
**variable**, not a constant (`dialect.g53`/`rules.g53Rapid`); `IF/GOTO` has a controller-specific
form (`rules.ifBracket`/`gotoSpace`); probe status/result live in `#1920–#1927`
(`probeBlocks.js` `AXIS_VARS`). `G10` is broken, `G28` not configured (see the skill).

### The one hard rule
**Never parse emitted G-code back into params.** Params are the source of truth; G-code is a one-way
projection. Inferring intent/values from finished code can emit wrong motion → a crash. Full rationale
in [MULTI-OP-STACKING.md](MULTI-OP-STACKING.md).
