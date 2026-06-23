/**
 * wizards/ops/variable.js — VARIABLE reporter (kind:'reporter'). A *value* block: reports a variable's
 * current value. Plugs into a value socket (a numeric field) and stays a visual pill — it never collapses
 * to plain text. `reduce(params, scope)` returns its number.
 */
export const variableBlock = {
    type: 'variable', label: 'Variable', kind: 'reporter', category: 'Variables',
    defaults: { name: 'a' },
    fields: ['name'],
    // A runtime macro ref (#100) or a [bracket expr] passes through LITERALLY — that's how a #var coordinate
    // (e.g. `G0 Z#18`) survives in a value socket. A plain name is a compile-time Set variable → its scope value.
    reduce: (p, scope) => {
        const k = p.name;
        if (typeof k === 'string' && /[#[]/.test(k)) return k;   // #ref / [expr] → emit verbatim (val() handles it)
        const n = scope[k];
        return n == null ? 0 : Number(n);
    },
};
