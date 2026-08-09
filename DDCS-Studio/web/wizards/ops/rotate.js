/**
 * wizards/ops/rotate.js — ROTATE: a Modify container (a Blockly C-block) that rotates the wrapped op's XY geometry
 * by an angle about a pivot. The atom behind BOTH ⟳ Align (wrap the whole program) and a per-op rotate (wrap one op).
 *
 * DDCS has no G68, so the rotation is baked into the emitted G-code: the emit fold (blockModel kind:'rotate') emits
 * the child(ren), then rewrites every absolute XY move + arc I/J via rotateProgram(angle, pivotX, pivotY). Unlike the
 * old ⟳ Align text rewrite this is NON-LOSSY and round-trips — the angle/pivot stay editable as block intent (re-open
 * the rotate atom and the moves un-rotate). Pivot defaults to the part datum (0,0). See data/rotateProgram.js.
 */
export const rotateBlock = {
    type: 'rotate', label: 'Rotate', kind: 'rotate', mouth: 'DO', category: 'Transforms',
    defaults: { angle: 0, pivotX: 0, pivotY: 0 },
    fields: ['angle', 'pivotX', 'pivotY'],
};
