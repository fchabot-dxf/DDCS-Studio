# Reminders / known issues to revisit

Running list of things noticed mid-work that we deliberately deferred. Newest on top.

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

**Related cosmetic (same theme):** equivalent ops emit different comments — ProgramStart op `( spindle on )` / `( spin-up dwell )` / `( clearance )` vs leaf `spindle`/`move` ops `( spindle CW )` (per-move `( cut )`/`( travel )` already removed). Align these so a decoded program is comment-identical to its high-level original.
