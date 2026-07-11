/**
 * wizards/ops/transform.js — the DECLARED program-level ROTATION (t736). A childless SIBLING marker carrying
 * {angle, pivotX, pivotY}; it emits NOTHING itself (exactly the mill ENTRY marker's shape) and is applied ONCE over the
 * WHOLE program at the emit choke point (applyProgramTransform in blockEmitter.emitMapped) via data/rotateProgram.js.
 *
 * This REPLACES the old ⟳ Transform text-bake (rotateProgram rewritten into the editor — lossy, the op/Blocks world never
 * learned it) AND the makeRotate WRAPPER (which nested the whole program inside one Rotate C-block). A flat program-level
 * declaration instead: it round-trips through Blocks (generic fields path) + save/load (rides the stack), drives the
 * editor rotation BADGE, and clearing it (angle 0 / removing it) is BYTE-IDENTICAL (the emit's 0° fold passes through).
 * The legacy makeRotate wrapper still emits via the kind:'rotate' fold (old programs unaffected — coexistence, no migration).
 */
export const xformBlock = {
    type: 'xform', label: 'Rotate program', kind: 'xform', category: 'Transforms',
    defaults: { angle: 0, pivotX: 0, pivotY: 0 },
    fields: ['angle', 'pivotX', 'pivotY'],
};

/** The active program rotation declaration in a stack (the xform sibling; the LAST wins if several — normally one). */
export function findProgramXform(stack) {
    let x = null;
    (stack || []).forEach((b) => { if (b && b.type === 'xform') x = b; });
    return x;
}

/** Read {angle,pivotX,pivotY} from a stack's xform declaration (all 0 when none is declared). */
export function programRotation(stack) {
    const p = (findProgramXform(stack) || {}).params || {};
    return { angle: Number(p.angle) || 0, pivotX: Number(p.pivotX) || 0, pivotY: Number(p.pivotY) || 0 };
}
