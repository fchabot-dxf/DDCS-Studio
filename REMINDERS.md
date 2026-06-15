# Reminders / known issues to revisit

Running list of things noticed mid-work that we deliberately deferred. Newest on top.

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

**Related cosmetic (same theme):** equivalent ops emit different comments — ProgramStart op `( spindle on )` / `( spin-up dwell )` / `( clearance )` vs leaf `spindle`/`move` ops `( spindle CW )` (per-move `( cut )`/`( travel )` already removed). Align these so a decoded program is comment-identical to its high-level original.
