# Reminders / known issues to revisit

Running list of things noticed mid-work that we deliberately deferred. Newest on top.

---

## Op-containers — keep the op record, gate the emit per post (IN PROGRESS)
*Started 2026-06-15. Status: emit core DONE; wiring is the focused next build.*

Goal (user): switching post should "replace the code with its caps" — a loaded op re-emits in full on a
capable post, or as a single marker comment on a post that can't run it (e.g. a probe/ATC macro on grbl —
no #vars), with the op ALWAYS kept in the stack. Plus: the op-container carries `opType`+`params`, so it
becomes the home for OP-FORM EDITING (select an op → seed its wizard form from `params` → re-run builder →
swap children) and REPLACES the geometry-reverse RECONCILERS.

Op-container shape: `{ id, type:'op', opType, label, requires:['vars'|'flow'…], params, children }`.

DONE: `blocks/blockModel.js` emit handles `type:'op'` — caps-gated via `getCaps(dialect.id)`: unmet requires →
one marker comment `( <label> - not emitted on <post>: needs … )`; else transparent (emit children, so
capable-post output is UNCHANGED — zero regression). Verified: corner op → full on DDCS, marker on grbl;
drill op (requires []) → transparent everywhere.

TODO (the careful, regression-sensitive part):
1. Accumulation: `opStacks.commitActiveOp` wraps each op's bare blocks in an op-container (derive `requires`
   by scanning for #var/flow atoms: assign/probe/proberead/readmachine/setworkoffset/tooloffset/machinemove
   = 'vars'; ifgoto/goto/label = 'flow'; cutting ops → []). Store `op.params` for editing.
2. **Blockly round-trip** (the hard part): `blockly/bridge.js` + `stackBridge.js` only know `BLOCKS[type]` —
   need a real Blockly `op` GROUP block (children + opType/label fields) that round-trips, else opening/editing
   the Blocks tab drops op-containers (children lost, params lost, gating lost). Until then op-containers are
   unsafe to put in the live program stack.
3. Reconcile/find: `opStacks` `find()` + `reconcileActiveOp` must look INSIDE op-containers (and ideally read
   `params` directly instead of un-deriving from geometry).
4. Op-form editing: select an op (its container) → open its wizard seeded from `params` → rebuild → replace
   the container's children. Then the geometry-reverse RECONCILERS can retire.
5. **Glow accent border on the wizard modal when RE-RUNNING/editing an op from the editor** (vs creating a new
   op) — a `.wiz-box.editing` class with an accent glow, set when the wizard opens in edit-existing-op mode.

Interim safety net already shipped: the post-selector capability LINT (⚠ #hdrPostWarn, ui/headerPost.js) warns
when a loaded program uses caps the active post lacks, so you don't silently get non-runnable G-code today.

## Queued UI/product tasks (2026-06-14, batched while porting probes)
*Status: TODO, not started.*

- **2D preview shows nothing** — the `.pp-2d` canvas in `createPreviewPanel` may not be rendering the route (toolpath2d). Investigate (likely a regression from the shared-panel work).
- **Add 4 standard tools to the tool library** — `settings.atc.tools[]` is empty by default (`SETTINGS_DEFAULTS.atc.tools`); seed 4 common tools (e.g. 6 mm + 3.175 mm flat endmills, 6 mm ball, 60° V-bit) so the library/Mill wizards aren't empty. Note existing localStorage keeps its (empty) tools — decide whether to seed when empty.
- **Remove the profile chip from generators** — `wizProfile` `<select>` in the shared wizard header (`index.html` line ~161, wired in `wizardManager.js` syncProfileChip / drag-exempt). Move the controller-profile choice OUT of every generator.
- **Add a profile selector to the app header** — surface the active controller profile globally in the header (pairs with the removal above). The post-processor + profile selectors live in Settings → Profile today.
- **Remove the theme selector from the header** — the `🎨 styleBtn` (`index.html` line ~106, `window.toggleStyle`). Theme also lives in Settings → Appearance.
- **Settings → Appearance: drop "Keyboard drawer height"** — `set_kbd_height` range is useless; remove the control (and its wiring).

---

## Wizard atom stacks hardcode Expert system vars (not native for V4.1 / DM500)
*Noted 2026-06-14. Status: TODO (user-requested: "all wizards native across the 3 DDCS dialects via atom blocks").*

The ported probe wizards (edge/middle/corner) emit NATIVE only for the *line forms* the dialect swaps — probe move (`dialect.probeMove`), IF operator words, dwell units, GOTO/label. But the STACK STRUCTURE hardcodes Expert magic vars: status `#1920/#1921/#1922`, trigger `#1925-1927`, active-WCS `#578`, base `#70=[805+[#72*5]]` (Expert stride-5), DRO `#882/#883`. Under V4.1/DM500 these are WRONG (DM500 has no status var and reads DRO `#864-866`, WCS stride differs, etc.). So a DM500-posted macro is a hybrid: DM500 probe form + Expert status/trigger/WCS vars.

There ARE dialect-aware atoms for exactly this — `probecheck`/`proberead`/`readmachine` (ops/measure.js → dialect.probeStatus/probeRead/readMachine), `setworkoffset` (ops/setworkoffset.js → dialect.setWorkOffset), `readActiveWcs`. **The fix is to rewrite each wizard's `<name>Stack` to use those native atoms instead of hardcoded `assign`/`ifgoto` with Expert numbers**, so emit is native for all 3 posts. Caveat the user noted: some ops (comm/HMI) have no V3/V4 equivalent — those dialects return `[]` for hmiPrompt/hmiToast, so handle the empty-form case gracefully (skip, don't emit a broken line). Verify each wizard × {expert, v41, dm500} traces clean.

## DM500 probe simulation — DONE (2026-06-14)
*Status: FIXED + verified (Expert + V4.1 + DM500 all trace clean). Unverified on real DM500 hardware (none owned).*

Two fixes landed:
1. **First-probe-zero / "only see the retract":** incremental probe macros traced from the origin (which sits on the stock's min faces) clamped their FIRST probe to zero length. Fix: the engine takes a `stockOffset` (operator start in stock coords, threaded from the wizard's `inferStart` via `traceToolpath({start})` + the live engine in `createPreviewPanel.play`) used ONLY for the probe-vs-stock ray test (route stays origin-relative, so the viz marker offset isn't double-counted); and a probe starting on the entry face (tmin≈0) now uses the far surface (tmax) so the move is visible.
2. **DM500 move-until-input:** the engine recognizes the `M101 … G01 … M102` cycle (`probe.nc`/`defprobe.nc`) — `M101` arms `_probeArmed`, the next `G01` is treated as a probe (clamps to the stock like G31), `M102` disarms. The condition evaluator already normalizes the WORD operators (EQ/NE/LT/GT). Verified: edge/middle/corner under all 3 posts give identical probe moves; a raw `M101/G01 Z-100/M102` touches the stock top.

---

## Start inferences need a unified owner (currently tracked ad hoc)
*Noted 2026-06-14. Status: IDEA / deferred.*

The inferred op/spindle START (where an op begins — used to offset the preview path + as the program's spindle start) is passed through too many disconnected channels:
- `inferStart()` per wizard (computes the hint),
- `host.__start` (wizard preview) → the shared panel's `getStart` opt → `GcodeViz3D.starts[]` (draggable marker),
- `window.__pendingSpindleStart` + `window.ddcsSetSpindleStart`/`ddcsGetSpindleStart` (carry the dragged start from the wizard preview into the Studio main preview on insert).

It works but it's brittle and easy to desync. A start should have ONE owner, set or dragged in the preview, and read consistently by every surface — rather than copied between globals and per-host fields.

**Crucially it must PERSIST across a round-trip (blocks ↔ editor ↔ Studio) and across manual code edits.** Today the start is an *ephemeral preview hint* — the moment the program is re-projected (round-trip) or hand-edited, the inferred/dragged start is gone, because it lives nowhere in the program data. It needs to be part of the program/op (e.g., a start marker the emit writes and the parser/engine preserves), so editing the code or going blocks→editor→blocks keeps the same start. Revisit when the preview-panel mounts settle (the panel centralizes the marker via `getStart`; extend that to a persisted, single source).

---

## Material-removal sim: solid stock the toolpath carves into
*Noted 2026-06-14. Status: IDEA / deferred.*

Make the preview stock a **solid** (mesh/voxel), and have the toolpath actually **remove material** as it runs — so you see the cut result, not just lines over a translucent box. Big 3D feature: a voxel grid (or CSG subtraction along the swept tool volume) carved as the engine steps. Pairs with stock-lives-in-the-preview (the stock is now a sim property in `createPreviewPanel`, `PREVIEW_STOCK`) and with the engine-driven trail (the same `setToolPosition` steps could drive the carve). Start simple (voxel occupancy under the tool radius along each feed move); upgrade to a proper swept-volume boolean later.

---

## Fills (and all wrapper ops): delimit the region in the projected G-code
*Noted 2026-06-14. Status: IDEA / deferred.*

A fill currently emits a START marker (`( concentric fill z=… )`) then N expanded passes with nothing closing them. Add a matching CLOSE marker (`( fill zigzag close )` or similar) and/or **indent** the expanded lines, so the high-level op's extent is visible — and foldable — in the editor. Same idea as using indentation as a UX bridge across the lossy high-level↔leaf boundary. Should apply to every wrapper kind (fill / array / stepdown / loop / cond), not just fills. Forward-only cosmetics: must stay round-trip-safe (the parser already strips trailing comments; any indentation must be ignored on decode).

---

## Decode is a STANDBY — never flatten a high-level op through its own emitted text
*Noted 2026-06-14. Status: TO VERIFY / FIX.*

**The model (correct, already true):** there is ONE projection, `emitMapped(stack)` (blocks/blockModel.js), shared by every surface — wizards (`generate()` → `emitMapped(stack).text`), the editor (`programModel.js`), and the Blocks tab. Same stack ⇒ identical G-code, by construction.

**Decode is the reverse and only a fallback.** `parseGcodeToStack` / `reconcileGcodeToStack` (blocks/gcodeToStack.js) turn *text into a stack*. They exist only for text that has **no stack behind it**: hand-written, pasted, or foreign G-code. They flatten everything to LEAF atoms — a Fill/Array/StepDown becomes its raw expanded moves (lossy: the parametric op's params can't be recovered from its 150 expanded lines).

**The bug we saw:** a wizard-generated program (high-level: ProgramStart + Array/StepDown/Fill) showed different comments/structure after a "round trip" to the Blocks tab — structure markers and cosmetic header comments changed. That happens **only if the pipeline re-derives the stack from the emitted text** instead of using the stack it already has. The wizard already preserves the real stack: `generate()` calls `recordOp('drill', params)` etc., so the Blocks tab can rebuild the *same* high-level stack from params. So decode should NOT be running in the wizard→editor→Blocks flow.

**Principle:** the in-memory high-level stack is the shared core. Decode only when there is genuinely no stack (foreign/hand-edited text). `reconcileGcodeToStack` already returns `null` for non-all-leaf stacks (good — manual edits don't flatten a high-level program). 

**To do:** confirm the wizard *insert/apply* path sets the high-level stack into `programModel` (setStack) rather than only inserting text and letting the editor-input reconcile re-derive it. If a fill/array still flattens on tab switch, that's where to fix it — propagate the recorded stack, don't decode the text.

**Confirmed repro (2026-06-14):** insert two wizard ops back-to-back, open Blocks → only the SECOND shows. `wizardManager.insert()` appends *text* to the editor and `recordOp()` keeps only the LAST op; `showBlocks` then does `setStack(buildActiveOpStack(), 'load')`, replacing the whole program with that one op. The editor has both; Blocks shows one.

**The M30 trap (same root cause):** each wizard emits a *complete framed program* (Program Start … M30). Two inserts concatenate to `…M30… <2nd program>` — an M30 mid-file. The engine trace AND a real DDCS controller STOP at the first M30, so the 2nd op never previews or runs (the Blocks parser still makes blocks for it, but they're dead). So even "show both" isn't right while inserts are whole programs.

**Real fix:** a program is ONE frame (single Program Start … M30) with multiple OPS between. Wizard insert should append the op's high-level blocks into the one program's stack (between Start and End), not concatenate a second framed program. Then: model accumulates ops, editor projects them, Blocks shows all, and there's one M30 at the end.

**RESOLVED (2026-06-14, commit b7e3967):** `opStacks.commitActiveOp()` does exactly this — first op brings the frame, later ops slot their BARE blocks before `progend`; `wizardManager.insert()` calls it; `showBlocks` renders the accumulated program (was replacing it with just the last op). Validated: drill+pocket → `[progstart, array, stepdown, progend]`. **Caveat:** only ops WITH a block builder (surfacing/pocket/slot/drill/wcs/edge/comm/middle) accumulate as blocks; ops without one (corner/alignment/ATC — not block-ported) still text-insert and do NOT accumulate, and can be lost if a builder-op is inserted after them (the text isn't in the stack). Fix = port those ops to builders (see the per-op gaps below).

**Related cosmetic (same theme):** equivalent ops emit different comments — ProgramStart op `( spindle on )` / `( spin-up dwell )` / `( clearance )` vs leaf `spindle`/`move` ops `( spindle CW )` (per-move `( cut )`/`( travel )` already removed). Align these so a decoded program is comment-identical to its high-level original.
