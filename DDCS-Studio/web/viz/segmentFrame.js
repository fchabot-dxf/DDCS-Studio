/**
 * viz/segmentFrame.js — t1838 (Option B, SLICE 1 of 3 — DERIVATION ONLY, WORK-LOG t1836/t1838).
 *
 * For a projected program, which LINE RANGES belong to which op, and what FRAME does that op declare — nothing
 * more. This is the join the t1836 design named as already fully declared, with nothing new to declare: line→op
 * ownership already lives in `programModel.js`'s own `proj.map` (read here directly — see `frameOwnerAtLine`'s
 * own comment below for why NOT via `opAtLine`, never a second copy of the mapping itself); per-type frame
 * intent already lives in `opSimContext.js`'s own declared tables. This module is the SEAM that joins the two —
 * it introduces zero new declared data, only a name for the join.
 *
 * SLICE 1 SCOPE, DELIBERATELY NARROW: this module is not imported by any render/positioning/visibility code this
 * turn. Nothing here changes what is drawn, positioned, or shown/hidden — see the guard test
 * (`tests/segment-frame-derivation-1838.spec.js`), which asserts both screenshot baselines stay zero-diff
 * specifically to prove that. Slices 2 (positioning) and 3 (live visibility) are future acts that will import
 * this module's output — not built here.
 */
import { getStack, getProjection } from '../blocks/programModel.js';
import { opSimContext } from './opSimContext.js';

// t1838 — reads `proj.map[i][0]` directly (the TOP-LEVEL ancestry slot — `programModel.js:44`'s own declared
// meaning: "an op-container id in that ancestry means the line belongs to that op") + a plain top-level lookup
// in `getStack()`, rather than `programModel.js`'s own `opAtLine` (which recursively descends into EVERY block's
// `.children`, including nested atoms far below any top-level op). This turn's own guard test caught `opAtLine`
// returning a WRONG, unrelated match for a real Corner-after-Homing program: Homing's own builder self-wraps
// with an internal `{type:'op', opType:'homing'}` fragment that is never assigned an `id` (only the top-level
// `makeOp()` call assigns one) — and `findOpInStack`'s `anc.includes(b.id)` matches that id-less fragment
// whenever `anc` happens to carry `undefined` padding at the depth it sits at (proven: Corner's own ancestry
// for a plain top-level line is `['op2', undefined, undefined, undefined]`, and `[...].includes(undefined)` is
// `true`, so the recursive descent falls through into Homing's own tree and returns its stray fragment instead
// of `null`). This module only ever needs TOP-LEVEL attribution (which op owns this line), so it does not need
// `opAtLine`'s general nested-atom search at all, and reading `anc[0]` directly sidesteps the bug rather than
// depending on it. The bug itself is real, pre-existing, and NOT fixed here — flagged separately (WORK-LOG t1838)
// as its own item, since `opAtLine` has other, unrelated live consumers (the editor's hover-to-edit) this module
// must not risk perturbing.
export function frameOwnerAtLine(i) {
    const proj = getProjection();
    const anc = proj.map && proj.map[i];
    const topId = anc && anc[0];
    if (!topId) return null;
    const op = getStack().find((b) => b && b.type === 'op' && b.id === topId);
    if (!op || !op.opType) return null;
    return { opId: op.id, opType: op.opType, toolMachineFrame: !!opSimContext(op.opType).toolMachineFrame };
}

/** Compact CONTIGUOUS same-op line ranges (0-based, `toLine` inclusive) across `lineCount` projected lines into
 *  per-op frame segments: [{ opId, opType, toolMachineFrame, fromLine, toLine }, ...], in line order. A run of
 *  lines owned by no op (null) simply breaks the run — it contributes no segment of its own. */
export function frameSegments(lineCount) {
    const out = [];
    let cur = null;
    for (let i = 0; i < (lineCount || 0); i++) {
        const o = frameOwnerAtLine(i);
        if (o && cur && o.opId === cur.opId) { cur.toLine = i; continue; }
        if (cur) out.push(cur);
        cur = o ? { ...o, fromLine: i, toLine: i } : null;
    }
    if (cur) out.push(cur);
    return out;
}
