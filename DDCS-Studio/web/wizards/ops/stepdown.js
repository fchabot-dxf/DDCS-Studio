/**
 * wizards/ops/stepdown.js — STEP DOWN: the depth-pass wrapper (kind:'depth', category:'Modify').
 *
 * The vertical sibling of StepOver: runs its body once per depth level (sd, 2·sd, … to `to`) and exposes the
 * current cut Z to the body as scope `z` (negative), exactly how Count exposes `i`. Reusable over any op —
 * StepDown{ StepOver } is a pocket; StepDown{ Wall } steps a wall finish. The depth loop lives in the emit
 * fold (it owns the scope); this def just declares the fields. `to` = total depth, `by` = stepdown per pass.
 */
export const stepdownBlock = {
    type: 'stepdown', label: 'Step Down', kind: 'depth', category: 'Modify',
    defaults: { to: 5, by: 1 },
    fields: ['to', 'by'],
};
