/**
 * wizards/ops/stepdown.js — STEP DOWN: the depth-pass wrapper (kind:'depth', category:'Modify').
 *
 * The vertical sibling of StepOver: runs its body once per depth level (sd, 2·sd, … to `to`) and exposes the
 * current cut Z to the body as scope `z` (negative), exactly how Count exposes `i`. Reusable over any op —
 * StepDown{ StepOver } is a pocket; StepDown{ Wall } steps a wall finish. The depth loop lives in the emit
 * fold (it owns the scope); this def just declares the fields. `to` = total depth, `by` = stepdown per pass.
 */
// t1031 — `confirmEvery` (default 0 = OFF): pause & confirm every N depth passes (the emit fold injects a pauseConfirm
// after every Nth pass EXCEPT the last). 0 → NO injection → byte-identical.
export const stepdownBlock = {
    type: 'stepdown', label: 'Step Down', kind: 'depth', mouth: 'DO', category: 'Transforms',
    defaults: { to: 5, by: 1, confirmEvery: 0 },
    fields: ['to', 'by', 'confirmEvery'],
};
