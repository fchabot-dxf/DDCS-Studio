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

/**
 * t879 - TWO-SIDED JOBS (backlog item 11, phase 1). A `setup` boundary groups the ops of ONE machine setup (side 1 /
 * side 2 / ...) - a `section` derivative (titled, transparent emit, so wrapping ops in it is byte-transparent) carrying
 * a setup INDEX. A `flip` sibling declared INSIDE a setup-2+ boundary is the FLIP: a flat childless declaration modeled
 * EXACTLY on xform (emits nothing itself) carrying {axis: X|Y}. The emit BAKES the mirror into that setup's coordinates
 * (blockEmitter.applySetupFlips, SCOPED to the section's line range) via data/mirrorProgram - the Z-invert reads the
 * declared stock thickness. No setup with a flip -> byte-identical (goldens untouched). Round-trips through Blocks (the
 * generic fields path) + save/load (rides the stack) exactly as xform does.
 */
export const setupBlock = {
    type: 'setup', label: 'Setup', kind: 'setup', category: 'Transforms',
    defaults: { title: 'Setup', index: 1 },
    fields: ['title', 'index'],
    emit: (params, children) => children || [],   // transparent group; the mirror is applied at the emit choke point, not here
};

export const flipBlock = {
    type: 'flip', label: 'Flip part (2nd setup)', kind: 'flip', category: 'Transforms',
    defaults: { axis: 'X', setup: 2 },
    fields: ['axis', 'setup'],   // axis = flip about X|Y (user's taste, parked); setup = which setup index this flip applies to
};

/** The FLIP declaration for a given setup INDEX: a flat top-level `flip` sibling whose `setup` matches (modeled on xform's
 *  top-level sibling; the LAST wins if several). null when that setup declares no flip -> that setup is not mirrored. */
export function flipForSetup(stack, index) {
    let f = null;
    (stack || []).forEach((b) => { if (b && b.type === 'flip' && Number((b.params || {}).setup) === Number(index)) f = b; });
    return f;
}
