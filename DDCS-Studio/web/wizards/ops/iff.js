/**
 * wizards/ops/iff.js — IF: a conditional wrapper (kind:'cond', category:'Control'). [block type = 'if']
 *
 * A C-block whose head holds a boolean socket instead of a loop count: `cond` takes a boolean reporter
 * (Compare), and the body runs once iff it resolves true. The conditional itself lives in the emit fold
 * (it reads the scope to evaluate the condition); this def just declares the boolean socket. Empty
 * condition = false (skip the body). Codeblocks' "if [ ] then".
 */
export const ifBlock = {
    type: 'if', label: 'If', kind: 'cond', mouth: 'DO', category: 'Control',
    defaults: { cond: '' },
    fields: ['cond'], sockets: { cond: 'boolean' },   // cond renders as a hexagon boolean socket, not a number input
};
