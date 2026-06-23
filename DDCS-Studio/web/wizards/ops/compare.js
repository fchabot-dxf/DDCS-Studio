/**
 * wizards/ops/compare.js — COMPARE: a BOOLEAN reporter (kind:'reporter', returns:'boolean').
 *
 * The hexagon value block — two numeric value sockets (a, b) and a relational op (< > ≤ ≥ = ≠). It plugs
 * into a boolean socket (the If's condition), never a numeric one. `reduce` resolves its operands through
 * `rc` (so Variable/Math nest inside) and returns 1/0. Codeblocks' "[a] < [b]" comparator.
 */
export const compareBlock = {
    type: 'compare', label: 'Compare', kind: 'reporter', returns: 'boolean', category: 'Control',
    defaults: { a: 0, op: '<', b: 0 },
    fields: ['a', 'op', 'b'],          // a, b are numeric value sockets; op is a relational select
    reduce: (p, scope, rc) => {
        const a = rc(p.a), b = rc(p.b);
        switch (p.op) {
            case '<': return a < b ? 1 : 0;
            case '>': return a > b ? 1 : 0;
            case '<=': return a <= b ? 1 : 0;
            case '>=': return a >= b ? 1 : 0;
            case '==': return a === b ? 1 : 0;
            case '!=': return a !== b ? 1 : 0;
            default: return 0;
        }
    },
};
