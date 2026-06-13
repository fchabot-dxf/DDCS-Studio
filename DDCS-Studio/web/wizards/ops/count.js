/**
 * wizards/ops/count.js — COUNT: a loop container (kind:'loop', category:'Control').
 *
 * Tinkercad-Codeblocks "Count with [var] from [from] to [to] by [by]". It wraps a sub-stack and
 * runs it once per step, exposing the index to the children's expressions (`x = i*slot`). Like
 * Array, it's a modifier — but the "pattern" is an integer sequence, not XY points. The loop
 * itself lives in the emit fold (it owns the variable scope); this def just declares the fields.
 */
export const countBlock = {
    type: 'count', label: 'Count', kind: 'loop', category: 'Control',
    defaults: { var: 'i', from: 1, to: 4, by: 1 },
    fields: ['var', 'from', 'to', 'by'],
};
