/**
 * viz/segmentFrame.js — t1838 (Option B, SLICE 1 of 3 — DERIVATION ONLY, WORK-LOG t1836/t1838).
 *
 * For a projected program, which LINE RANGES belong to which op, and what FRAME does that op declare — nothing
 * more. This is the join the t1836 design named as already fully declared, with nothing new to declare: line→op
 * ownership is the ONE declared answer `programModel.js`'s own `opAtLine` already gives (t1974 — see
 * `frameOwnerAtLine`'s own comment below for why this module now calls it directly, after avoiding it for three
 * turns); per-type frame intent already lives in `opSimContext.js`'s own declared tables. This module is the
 * SEAM that joins the two — it introduces zero new declared data, only a name for the join.
 *
 * SLICE 1 SCOPE, DELIBERATELY NARROW: this module is not imported by any render/positioning/visibility code this
 * turn. Nothing here changes what is drawn, positioned, or shown/hidden — see the guard test
 * (`tests/segment-frame-derivation-1838.spec.js`), which asserts both screenshot baselines stay zero-diff
 * specifically to prove that. Slices 2 (positioning) and 3 (live visibility) are future acts that will import
 * this module's output — not built here.
 */
import { opAtLine } from '../blocks/programModel.js';
import { opSimContext } from './opSimContext.js';

// t1838 — this module used to read `proj.map[i][0]` directly (the TOP-LEVEL ancestry slot) + a shallow
// top-level `getStack().find(...)`, instead of `programModel.js`'s own `opAtLine`, because `opAtLine` had a
// real bug at the time: homing's own internal, id-less `{type:'op', opType:'homing'}` self-wrap fragment could
// get matched by accident (`findOpInStack`'s `anc.includes(b.id)` false-matching `undefined` ancestry padding).
// The shallow top-level read was a correct WORKAROUND for that bug, not a preference — and it bought a NEW bug
// of its own the same shape as the one it dodged: for a MULTI-OPERATION program, `anc[0]` is always the
// `multi_step` WRAPPER's own id (every nested op's ancestry starts with it), so the shallow top-level lookup
// always resolved to the wrapper, never the real op — `opSimContext('multi_step')` is not in any of that
// module's declared sets, so `toolMachineFrame` read `false` for EVERY line of EVERY nested op, live since
// t1874 Slice 3 (the sim's hide-workpiece/DRO machine-frame flip simply never fired for one). The bug
// `opAtLine` had is now FIXED (t1842's id-null guard → t1958's deepest-match-wins → t1964's `user_root`
// boundary → t1972's `USER_OP_PREFIX` refinement) — it is the canonical, declared, now-correct answer to
// "which op owns this line," so this module calls it directly instead of carrying its own second copy of the
// same lookup that itself went stale the moment the reason for avoiding `opAtLine` stopped being true.
export function frameOwnerAtLine(i) {
    const op = opAtLine(i);
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
