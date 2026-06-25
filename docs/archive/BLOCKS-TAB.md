# Blocks Tab — Feature Notes

A Tinkercad-Codeblocks-style tab for DDCS Studio: stack visual op-blocks → live G-code + preview.
Build-first, learn-G-code-by-revealing. This is the **feature/implementation** doc; the *why* and the
broader architecture live in [MULTI-OP-STACKING.md](MULTI-OP-STACKING.md).

Status: **live STUDIO tab, on Blockly** (vendored UMD **13.0.0**, `web/vendor/blockly/`). The bespoke
drag/snap canvas this doc described earlier was **replaced by Blockly** — the build-vs-adopt gate (below)
was crossed. The block stack is the **program data**; the Studio editor is the **primary surface** and a
**live projection** of it; editing the editor reconciles back into blocks (leaf-level). Verified by the
Playwright suite (`tests/blocks-*.spec.js`, `gcode-to-stack.spec.js`, `blocks-dialect-decode.spec.js`).

> ⚠️ **Read "Current architecture" first — it's the source of truth for what exists now.** Sections further
> down ("spatial drag/snap canvas", "Engine verified in Node", the `ops/zigzag.js`/`concentric.js` names, the
> closing "Never parse emitted G-code" rule) **predate the Blockly port + the program-model rework** and are
> kept only for design rationale (altitude ladder, the vocabulary audit, build-vs-adopt).

---

## Current architecture (built — 2026-06)

### Blocks are the DATA; the editor is the PRIMARY surface
One program — a stack of block records — is the **source of truth**, with two *views*: the **Studio editor**
(a `<textarea>`, the primary surface) and the **Blockly workspace** (the Blocks tab). User's framing:
*"primary surface, but blocks are the data"* — you live in the editor; what you edit is **block data**.

Implemented by **`web/blocks/programModel.js`**, owned at **app start** (not inside lazy-loaded Blockly). That
decoupling is load-bearing: editing the editor builds/updates blocks **without ever opening the Blocks tab**.
`setStack(next, origin)` tags each change so a view ignores its own echo (no feedback loop); the Blockly view
(`blocksApp.js`) subscribes via `onChange`, re-renders only on foreign changes, and guards its own rebuild.

### Bidirectional sync — four shipped layers
1. **Parser** `web/blocks/gcodeToStack.js` — G-code → **leaf** block records (inverse of `emit`); unknown line → `raw`.
2. **Editor = live projection** — `programModel` projects the emit into the editor on every change (never while
   focused; canonicalizes on blur).
3. **Edit → blocks reconcile** — `reconcileGcodeToStack` turns editor edits back into the stack.
4. **Per-dialect recognizers** — each dialect decodes *its* specific ops (see below).
emit ↔ parse is **byte-identical** for the leaf set (guarded by `gcode-to-stack` + `blocks-dialect-decode`).

### Reconciling with "never invert G-code" — the declared-vs-inferred line
The old rule (bottom of this doc) said *nothing ever parses G-code back into params*. We **do** parse
**leaf** G-code → blocks; that is **not a violation** — it's this doc's own *declared-vs-inferred* axis:
- **Leaf = DECLARED.** `G1 X10 F100` literally declares a Move's params — nothing to guess. So leaf G-code
  **round-trips both ways** (text ⇄ blocks ⇄ fields). (*"writing a few lines makes atom blocks"*; *"hand
  editing existing code should modify the block, not make raw"*.)
- **High-level = INFERRED → FORWARD-ONLY.** Fill/Array/Step-Down emit many *derived* lines from a few scoped
  params; you can't recover them from an edited line without guessing. **Never parsed back** — editing a
  high-level program's text reverts on blur (edit it via blocks/fields, or the coming per-op form editor).

Reconcile boundary: all-leaf/empty/imported → re-parse; high-level present → revert; unrecognized → `raw`.
(*"writing 100 lines by hand and it NOT becoming neat blocks is fine"* — text path is for tweaks, not bulk.)

### Per-dialect parse recognizers
Each dialect exports **`recognize(line) → {type,params}|null`** — the byte-exact **inverse of its emit,
co-located with it** (contract in `wizards/dialects/SCHEMA.md`). The parser tries the *active* dialect first,
then the shared core (move/arc/spindle/…/`#var=expr`), then `raw`. Probe/status/DRO reads are syntactically
just `#x=#sys` / `IF #status!=2 GOTO`, distinguishable **only by each controller's magic var numbers**
(`dialect.vars`) — so the inverse is inherently per-controller, anchored on the verified **M350 Expert**.
Covered (decode to proper blocks, no `raw`, byte-identical): **Expert** (probe cycle, probe-check/read,
read-machine, set-WCS `#[805+]`, IF/GOTO/label, message/ask-number), **V4.1** (`G31 L#682`, `#1500+`, tight
`IF…GOTO`, `G90 G92`), **V3/DM500** (WORD ops, `#864+`, `G92`, s-dwell), **RS274NGC** (O-word flow inverse,
`G38.2`, `G10 L20`, `(MSG,…)`), + universal `M00`→Pause.

### Render lessons (don't regress — full detail in `web/vendor/blockly/API-NOTES.md`)
- v11/v12 **render queue**: build via `serialization.workspaces.load`, not `newBlock+render`.
- **CSS `zoom` ancestor** breaks Blockly → Blocks tab forces `body{zoom:1}`; do **not** counter-zoom; do
  **not** `setParentContainer` (left DropDownDiv's `div` uncreated → resize crash that killed the render queue).
- **Double-inject** (double-wired tabs → 2 workspaces, loaded stack in the off-screen one — the real "nothing
  renders") → promise-cached `initBlocks`; load placement is fixed `setScale(0.9)+scroll(30,30)`, never `zoomToFit`.

### Known gaps / deferred
- **DM500 multi-line probe** (`M101`/`G91 G01 …`/`M102`) — per-line parser can't fold a 3-line op yet; kept
  verbatim (lossless). Needs parser look-ahead.
- **Centroid** recognizers deferred. **Folded-to-nothing ops** (probe-status on V4.1/DM500/NGC, NGC GOTO) are
  emit-side limits, not parse gaps. **High-level→blocks promotion** possible later via the emit's marker
  comments (`( Step Down z=… )`, `( Array N @ … )`) / indentation → per-op recognizers (not built).

### Roadmap (next)
- **Per-op form editor** — hover a high-level op's lines → frame + edit button → its wizard opens *pre-filled
  from the block* → Apply writes back (the clean editor for the inferred ops; reuses `opSession.RECONCILERS`).
- **Uniform preview** — Blocks 2D/3D+Play as the shared component for Studio's main 3D preview + the wizards.
- **Heavy fills** (Fill Zigzag/Concentric: `direction=climb/conventional`, shared stepover, tool-Ø higher
  context) → rework surfacing/pocket to seed them. **Forward-port** probe/ATC/comms wizards.
- **`showApp` router** still in `ui/gatewayStatus.js` (historical) → its own module when the Gateway UI is
  built. Blocks logic is already out: `gatewayStatus` just calls `blocksApp.showBlocks()`.

### File map (current)
`programModel.js` (data + editor⇄stack, app-start) · `blocksApp.js` (Blockly view) · `gcodeToStack.js`
(parser + reconcile) · `blockModel.js` (emit fold + line→block map) · `blockly/stackBridge.js`,`bridge.js`
(workspace⇄stack) · `wizards/ops/*` (primitives) · `wizards/dialects/*` (emit + `recognize`; anchor
`ddcs-expert-m350.js`) · `vendor/blockly/API-NOTES.md` (render notes).

---

## The idea

- **Codeblocks is the DNA.** A block program is a tree of primitives; STUDIO features are just
  compositions (presets) of the same primitives. Proven: `drill == array(bore)`, byte-identical.
- **Three altitudes, one engine:** motion atoms → composed feature blocks → presets.
- **Learn G-code while doing real projects:** the code is on-demand (per-block reveal), not a constant
  wall; the preview + (future) lint make catastrophic-but-creative code *visible* rather than blocked.

## Design direction — the granular block language

Today's blocks (Line/Bore/Drill…) sit at the **feature** altitude and weld several concerns together
(geometry + motion + machine-state + loop). The agreed direction is to expose the granular **atoms** and
keep feature blocks as **presets that fold them** — `drill == array(bore)` already proves a preset *is* a
composition. **This section is the north star; most of it is designed, not yet built.**

### The altitude ladder (the categories)

| Category | the question | holds | Tinkercad analog |
| --- | --- | --- | --- |
| **Shape** | *where* | Position, Line, Arc, Hole, Rect, Path (geometry, no motion) | Shapes |
| **Move** ⭐ | *how the tool moves* | Travel, Cut, Probe (see below) | — (CNC-only) |
| **Machine** ⭐ | *the context (state)* | Spindle, Feed, Tool, Coolant, WCS, Safe-Z | — (CNC-only) |
| **Op** | *what machining* | Drill, Bore, Pocket, Contour — **folded presets** | Templates |
| **Modify** | replicate/transform | Array, Mirror, Rotate | Modify |
| **Control / Variables / Math** | flow & params | Count, If, Set, expressions | same |

⭐ Move + Machine are the CNC-specific layers with no Tinkercad analog — they make this "Codeblocks for
**G-code**," not for solids. **An Op is a preset = atoms folded** (`Drill = Spindle · Repeat[ Plunge↓,
Retract↑ ]`); ship the preset, let it **explode** to atoms. The op does **not** include the pattern:
`Drill` = **one hole**; a bolt pattern = `Array { Drill }`; bundling array+op only belongs in the
**STUDIO wizard** (the feature altitude). Granular underneath, one-click on top.

### Move = path × mode × target

One primitive on three orthogonal axes:
- **path** — Linear / Arc / Helix (the shape of the motion between two positions)
- **mode** — Rapid (travel) / Cut (feed + spindle) / Probe (G31, seek-stop). *The 2D/3D preview legend
  (grey/cyan/red) already draws this.* Probe's result is **data** (`#1920–#1927`) → store + reuse it.
- **target** — a Position (absolute) / a Distance (relative ↓/↑) / an Anchor (Retract, Safe-Z, Home, var)

A peck is then just `Repeat[ Move(cut, ↓ by step) , Move(rapid, → Retract) ]`. The friendly named moves
(`Plunge`/`Retract`/`Travel`/`Probe`) are **presets of the one Move**. Positions are atomic Shapes;
`position → move → position` interpolates complex geometry from simple blocks.

### Block shapes + sockets (the visual language)

Four block **shapes** ↔ four **socket** types (the Scratch/Blockly model):

| Shape | connects via | examples |
| --- | --- | --- |
| **Statement** (notched top/bottom) | stack connection | Move, Set, Spindle, Op |
| **Wrapper / C** (notch + mouth) | a **body** socket (a sub-stack) | Repeat, Count, If/Else (two bodies), **Envelope** |
| **Reporter** (rounded, no stack notch) | a **value** socket | Math (`a/4−b`), Variable pill, **Position** |
| **Boolean** (hexagon) | a **boolean** socket | `>`, `==`, `and`, `not` → If's condition |

Two kinds of input: **scalar** (number/expression — already supported as text fields; *also* accept a
dropped reporter: type for speed, drag for discovery) and **structural** (Position/Shape/Boolean/Body —
these must be blocks). Implementation: a def's flat `fields` becomes a typed **`sockets`** spec
(`scalar | position | boolean | body`); reporters are a shape with no stack notch. "Position into Move's
target" lives here. **The sidebar palette renders each block in its real shape** (notched / C / rounded /
hexagon) so you see its connector before you drag it.

**No preview art.** Tinkercad's Shape blocks are tall because they carry a 3D thumbnail + color/material
swatches; we have **no solids to show**, so a block sizes purely by its **inputs/sockets** and stays
compact. The palette shows shape/connector cues only — no thumbnails.

### Prior art — the block-language standard (why we follow it)

The puzzle-shape grammar isn't a Tinkercad invention; it's a **de-facto standard** from the Scratch/Blockly
family, so anyone who's used any of these reads our blocks on sight — that's the whole reason to conform.

- **Scratch** (MIT) — the origin of the metaphor: notched statement stacks, C-blocks for control, oval
  **reporters**, **hexagon booleans**, hat blocks. Tinkercad Codeblocks is one skin on this lineage.
- **Blockly** (Google) — the open-source *engine* most block editors are built on. It formalises exactly our
  socket types: previous/next (stack), output/value (reporter), and boolean. If we ever want a hardened
  backend instead of our hand-rolled one, Blockly is the drop-in.
- **MakeCode** (Microsoft — micro:bit, Arduino) — Blockly-based, and notable for the **blocks ⇄ text**
  toggle: the same program shown as blocks or as code. That's the closest analog to our **blocks ⇄ G-code**
  split-view, and a model for round-tripping.
- Same family (all Blockly/Scratch-derived, same shapes): **App Inventor** (MIT), **Snap!** (Berkeley,
  first-class procedures), **Code.org**, **Open Roberta**, **mBlock / PictoBlox**, **EduBlocks**.

**Shape conventions are the standard** across all of them: hexagon = boolean, rounded = value, notch =
sequenced action, C = container. We follow these verbatim (and now *enforce* them — typed sockets reject a
number where a boolean is expected; see Engine).

**What's novel here is the domain, not the grammar.** Block-snapping is overwhelmingly education +
microcontrollers; **CNC/G-code is normally hand-written or CAM** (Fusion). The CNC-adjacent *pro* tools that
do go visual use a different model — **boxes-and-wires dataflow** (Grasshopper/Rhino, Unreal Blueprints,
Node-RED, Max/TouchDesigner) — where you wire ports rather than nest puzzle pieces. We deliberately chose
the Scratch **nesting/stack** model over wires because **G-code is fundamentally a sequence**, and a stack
reads as sequence far better than a wire graph. Borrowed grammar (proven, familiar), new domain (CNC).

**Could we just use the standard's tooling? (build-vs-adopt)** — One of these has a real drop-in API:
- **Blockly** is an embeddable Apache-2.0 **JS library** (`Blockly.inject`, no-build via UMD `<script>` or
  `npm i blockly`). Its **code-generator framework is exactly our `emit()` fold** — we'd define CNC blocks +
  write a **G-code generator** and get the drag/snap/zoom canvas, **undo/redo, JSON save/load, comments,
  collapse, and mutators** (variable-arity blocks like If/Else) for free. It's the engine under MakeCode /
  App Inventor / Code.org.
- **Scratch** is *not* a drop-in: `scratch-blocks` (a Blockly fork) + `scratch-vm` + `scratch-gui` (React) is
  a full app that *runs* projects in a VM, not a code-gen API. UX reference only.
- **MakeCode (pxt)** is a *framework*: you write TS functions annotated `//% block="…"` and it generates the
  blocks from the signatures (+ blocks⇄TS toggle). Heavy to adopt, but the *blocks-from-annotated-API* idea
  maps perfectly onto our wizard kernels and is worth stealing conceptually.

**Tradeoff for us:** the hand-rolled engine is tiny / no-build / owned / CNC-tailored (emit-fold, scope
threading, typed value sockets) — **ahead on *fit***. Blockly is **ahead on *editor depth*** (undo, save/load,
mutators, a11y). Tipping point = how far we push the editor: once we want real undo/redo + save/load + big
programs, adopting Blockly + writing one G-code generator beats reimplementing all that by hand. Revisit then.

**When to decide (the gate).** The repo splits in two: **portable** = block atoms (`ops/*.js` ≈ a Blockly block
def + generator, ~1:1) and the **generation logic** (`blockModel.js` emit fold *becomes* the Blockly G-code
generator) — building more of these does **not** raise the switch cost. **Throwaway-if-we-switch** = everything
in `blocksApp.js` + blocks CSS (the bespoke drag/snap canvas, value-socket pills, silhouettes, palette) — Blockly
renders its own SVG, so that's the sunk cost that grows. **So decide when the next feature is editor
*infrastructure*, not editor *content*.** Content (more blocks) is portable — build freely. The hard triggers,
decide at the **first** you hit: **undo/redo**, **save/load** (Blockly has canonical JSON serialization),
**mutators** (variable-arity If/Else-if), or **real users saving programs** (after that, switching = a data
migration). The current queue (And/Or/Not, ZigZag/Concentric fill, modularization) is all **portable** → not at
the gate yet. **De-risk early:** run a throwaway **Blockly spike** (2 CNC blocks + a tiny G-code generator, themed
to our tokens) *before* the first infrastructure feature, so the call is evidence-based. Avoid pouring more into
bespoke editor mechanics (insert-and-push, drag-out-of-mouth, multi-select, copy/paste) — that's the throwaway half.

### Envelope + parametric functions

- **Envelope** — a *conscious* `Program` wrapper (a C-block) that emits the spindle header before and the
  footer after its body, **parametrized** (units, WCS, Safe-Z, M30/M2). Replaces today's automatic
  header/footer wrap in `emitMapped`. It also defines **program vs. fragment**: only blocks inside the
  envelope (or attached under it) are *the program*; loose blocks float as scratch — which is why new
  blocks **spawn unattached**.
- **Parametric functions** — user-defined named sub-stacks with inputs; a call binds its args into a
  **child scope** (the exact mechanism `Count` uses for its index). Inline-expand first (universal), DDCS
  macro/subroutine later. A user function = a user-authorable Op/preset = a **STUDIO wizard minus the form**.

### Also from Codeblocks (to fold in)

- **Comment / Mark Up blocks** — inline `//` annotation blocks (Tinkercad's "Mark Up" rail category). Map
  straight to G-code comments `( … )`; great for teaching/documenting a program. Cheap, high value.
- **Collapse / expand** (the `<` toggle) — a block with many params collapses to its essentials, advanced
  fields one click away. This is the **progressive-disclosure** answer to "some blocks are bigger."
- **Named objects + instancing** (`Create New Object` / `Add Copy of Object base_shape`) — define a thing
  once, copy/transform it elsewhere. The CNC analog of **reuse / parametric functions**: define a feature
  or path once, instance it with Move/Rotate/Mirror.
- **Transforms as statements** — Move / Scale / Rotate / Mirror stack under an object (our **Modify** layer,
  beyond `Array`).
- **Step + speed playback** — Tinkercad's stepped run; the app's `GcodeViz3D` already has speed + step, so
  the Blocks Play inherits this at integration.

### Canonical primitive vocabulary — full wizard + modal-group audit (2026-06-13)

A single pass over **(a)** the G-code modal groups and **(b)** every wizard's emit code (drill/pocket/slot/
surfacing/circular · text/strokeFont · the 7 probe wizards · the 5 ATC wizards + wcs/comm), through
`words.js` / `dialect.js` / `clearing.js` / `cuttingBlocks.js`. (Fanned out across 5 agents — see git history.)

**Headline:** the **cutting** vocabulary is essentially *complete* — drill/pocket/slot/surfacing/text are pure
**presets** over the atoms we already have. The real gaps are an entire **macro / probe / HMI layer** the
cutting blocks never needed: machine moves, probe capture, work-offset writes, operator dialogs, labels, I/O.

**Have (26 atoms shipped):** Shapes `region` · Move `move`(G0/G1/G31) `arc`(G2/G3) `probe`(G31) · Machine
`spindle` `feed` `dwell` `coolant` `tool` `wcs` `distmode`(G90/91) · Ops `line` `bore` `drill` `wall` · Modify
`array` `helix` `stepover`(parallel/concentric × bothways/oneway/otherway) `stepdown` · Control `count` `if`
`compare` · Math `math` · Variables `set` `variable` · Mark Up `comment`.

**Missing atoms — the macro / probe / HMI layer** (have/missing/atom-vs-preset → these are *atoms*):

| Atom | What it does | Evidence | Why an atom (not a preset) |
| --- | --- | --- | --- |
| **machine-move** (G53) | rapid to absolute *machine* coords | every footer `G53 Z#101`; probe re-centre | distinct frame from WCS `move`; DDCS needs a `#var`, not a constant |
| **end-program** (M30/M2) | terminate + rewind | every footer | own modal group; not spindle/move |
| **set-work-offset** (G10-eq) | write a WCS register `#805+` (stride 5) from a value | corner/edge/middle/rotary wizards | `wcs` only *selects* G54-59; G10 is broken on M350 |
| **tool-length-offset** (G43-eq) | write/read tool length in the table `#1430+T-1` | atcLength (write), atcToolCheck (read) | `tool` is select/change only |
| **probe-read** | capture G31 trigger pos `#1925-7` → var | every probe wizard "save contact" | the *point* of probing; not generic `set` |
| **probe-check** | branch on G31 status `#1920-2 != 2` | `probeBlocks.ifGoto(status,…)` | bound to the probe latch + error label; not plain `if` |
| **probe-guard** | arm protected probe: stop-mode `#1905-7`, limit `#1915-7` | `probeBlocks` safety block | no primitive models guarded-probe setup |
| **read-machine-pos** | capture live DRO `#880-3` → var | middle/alignment/rotary | not a probe trigger — the current position |
| **label / goto** | `N`-targets + `GOTO` jumps | every macro's error/exit skeleton | `if`/`compare` give conditions but no jump target |
| **pause** (M0-eq) | blocking operator dialog `#1505=1` + cancel branch | every ATC + probe wizard | program halt + control flow; not `comment` |
| **prompt / report / input** | HMI: message/status/beep · formatted results `#1510-2` · read a number `#2070`→var | comm + alignment + ATC | interactive screen I/O; `input` *produces* a var |
| **wait-sensor** | block until a digital input asserts | atcChange/Test `M300-302` | `dwell` waits on time only |
| **raw-output / M-code** | toggle an accessory output | drawbar `M154/155`, dust-cover `M162/163` | generic escape hatch for custom M-codes |
| **offset** (region inset) | inward tool-radius inset of a region | pocket insets, surfacing doesn't | makes "finished size vs tool-centre" a block choice (or a `region` param) |
| **text** + **inflate** | string → glyph centrelines; centreline → filled ribbon region | textWizard / strokeFont / `strokeContours` | string→geometry + path→area; feed the existing fill |

**Enrich existing:** `probe` needs **P** (port) / **L** (level) / **Q** (stop-mode) operands to round-trip the real probe routines.

**Presets (compositions, NOT atoms):** drill · pocket · slot · surfacing · text; two-pass-probe ·
corner/edge/middle/alignment/rotaryCenter/rotaryClock; atc-change/length/toolcheck/test · spindle-warmup-ramp;
reposition · confirmStart. Updated decomposition recipes:
- `drill   = Array{ drill | bore }` ✓
- `pocket  = StepDown{ Region→offset → StepOver(fill) + Wall }`  · `surface = StepDown{ StepOver(fill) }` (no offset/wall)
- `slot    = StepDown{ StepOver-band{ Line A→B } }`  · `text = StepDown{ StepOver( fill of text→inflate region ) }`
- `probe*  = probe-guard + TwoPass{ probe + probe-check } + probe-read + math + set-work-offset`, in `label/goto` + `pause`
- `atc     = spindle-off + machine-move(park) + pause + (drawbar + wait-sensor)* + end-program`

**Modal groups the app NEVER emits — low priority** (baked into precomputed coords; only matter for raw/manual
authoring or new controllers): plane G17-19 · units G20-21 · cutter-comp G40-42 · feed-mode G93-95 · tool-length
*mode* G43/49 (the offset *value* is needed via the tool-table write above; the modal code is not).

**Build order (next vocabulary frontier):** cutting is done → build the macro/probe/HMI layer. Highest-leverage
first: **machine-move (G53)** + **end-program** (every footer) → the **probe trio + set-work-offset** (all probe
wizards) → **pause + label/goto** (control flow) → HMI (prompt/report/input) + I/O (wait-sensor/raw-M). That set
turns the Blocks tab from a CAM-toolpath language into a full DDCS-program language, and unblocks modularizing
the probe + ATC wizards (the bulk of the wizard count).

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
`ui/gatewayStatus.js` on first open. Opens empty. **Spatial canvas:** drag a block out of the palette to
spawn it (lands **unattached** where dropped) · drag a card by its header to move it (its snapped sub-stack
follows) · drop near another block's bottom to **snap into a connected stack** (cards touch + merge at the
seam) · **execution order = top-to-bottom on the canvas** · pannable/zoom. Category-coloured cards
(Ops/Modify/Control/Variables); loops "embrace" their sub-stack ·
expression fields (any field can hold `i*spacing`) · live G-code · **2D/3D preview
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
4. **Motion-safety lint** — engine written (`blocks/lint.js`: param-level checks → per-block warnings,
   threaded scope; rapid-into-stock, over-plunge, stepdown>depth, probe-above-feed; warn/teach, never
   block). **Not yet wired into the UI** (badge on the block + marker on the G-code line).
5. ~~**Variables/expressions + Control** blocks~~ ✓ **done** — `Set` (input/derived vars, `ops/set.js`),
   `Count` loop (`ops/count.js`, `from`/`to`/`by`, index in scope), and `evalExpr` (`ops/expr.js`) so any
   field can be an expression (`grandeur/4 - 2`, `i*spacing`). Resolved against a threaded scope at emit.
   `If`/conditional now done too (see item 8). Not yet: a variables panel / draggable variable pills (Codeblocks-style).
6. ~~**Spatial drag/snap canvas**~~ ✓ **done** — blocks are positioned cards; **drag from palette → spawn
   unattached**; drag to move (snapped sub-stack follows); **snap into connected stacks** (touch + merged
   seam); emit order = top-to-bottom; **drag a block into a wrapper's mouth (body socket) to nest it** ✓.
   **Next on this thread:** insert-and-push on snap; drag a child back *out* of a mouth.
7. **Granular re-taxonomy** — ⏳ **mostly shipped**: `Move` (mode rapid/cut/probe), `Arc`, `Probe`; Machine
   atoms `Spindle`/`Feed`/`Dwell`/`Coolant`/`Tool`/`WCS`; `Comment` (Mark Up); category **signature colours**.
   **`ZigZag Fill` + `Concentric Fill`** ✓ — the keystone area-clearing atoms (`ops/zigzag.js`,
   `ops/concentric.js`) wrap `clearing.js` (`scanlineFill`+`fillLevelMoves` / `concentricRect`), depth-stepped
   via `depthLevels`; rectangular region for now (circle/polygon next — clearing.js already has the kernels).
   They unblock the **structural modularization** of Pocket/Slot/Surfacing/Text (each = region + fill + walls).
   **Next:** `Shape`/`Position` blocks; rebuild `Drill` as `Array{Bore}`; circle/polygon fill regions.
8. **Block shapes + sockets** (the big one) — ⏳ **started**: **body socket** ✓ (drag a block into a
   wrapper's mouth); **Reporter engine** ✓ (`ops/variable.js`/`math.js` + `resolveValue` — value-trees
   resolve recursively, scalar-compatible); **value-socket UI** ✓ (Reporter pills in fields, drag-into-socket,
   recursive, never collapse to text); **all four socket types** ✓ — **Boolean + `If`** done: `ops/compare.js`
   (hexagon boolean reporter `a <>= b` → 1/0), `ops/iff.js` (`If` C-block, kind `cond`, boolean socket in the
   head + body that runs iff true), `resolveBool` in the fold. Sockets are now **typed** (`number`/`boolean`):
   a reporter only drops into a socket of its `returns` type (Variable rejected by the If, Compare accepted).
   **Canvas silhouettes** ✓ — blocks now render in their real shapes: **Statement** = notch top + dovetail
   bump bottom (interlocks when stacked); **Wrapper/C** = top bar + cat-coloured left arm + foot bar
   embracing the body mouth; **Boolean** = hexagon socket/pill; **Reporter** = rounded pill. Pure CSS
   (`--cat` per category + notch/bump pseudo-elements + `.blk-foot`), box/snap geometry unchanged.
   **Sidebar in real block shapes** ✓ (item 10). **Next:** logical `And`/`Or`/`Not` boolean reporters
   (boolean-in-boolean sockets, like Math nesting).
9. **Envelope + functions** — a conscious `Program` wrapper (replaces the auto header/footer); user-defined
   **parametric functions** (call binds args into a child scope, like `Count`'s index).
10. ~~**2-level sidebar**~~ ✓ **done** — Level-1 **category rail** (colour-coded chips, click to filter) +
    Level-2 **block list in real silhouettes**: statement (notch+bump), wrapper (label bar + recessed mouth +
    arm), reporter (rounded pill), boolean (hexagon). Shares `--cat` with the canvas cards; built in
    `blocksApp.js` (`renderPalette`), styled in `styles.css` (`.pal-rail`/`.pal-cat`/`.pal-blk.*`).
11. **STUDIO ↔ Blocks transfer** (modularization project) — make each wizard `form → block-stack → emit`
    (not `form → gcode`) so a STUDIO op opens as blocks. Incremental, **per wizard**; bore/drill/line
    kernels already extracted. Crosses `MULTI-OP-STACKING.md`'s "refactor barrier" one wizard at a time.

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

### The one hard rule (sharpened — see "Current architecture")
**Never *infer* high-level intent from emitted G-code.** Params are the source of truth; for **high-level ops**
(Fill/Array/Step-Down) G-code is a one-way projection — guessing `stepover%`/`region`/cycle-intent from derived
motion can emit wrong motion → a crash. Those stay forward-only.
**Leaf atoms are the exception that proves it:** a `G1 X10 F100` line *declares* a Move's params (nothing to
guess), so the parser round-trips leaf G-code ⇄ blocks (this is "declaration", not "inference" — see the
declared-vs-inferred axis in [MULTI-OP-STACKING.md](MULTI-OP-STACKING.md) and "Current architecture" above).
