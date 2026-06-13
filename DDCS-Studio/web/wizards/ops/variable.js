/**
 * wizards/ops/variable.js — VARIABLE reporter (kind:'reporter'). A *value* block: reports a variable's
 * current value. Plugs into a value socket (a numeric field) and stays a visual pill — it never collapses
 * to plain text. `reduce(params, scope)` returns its number.
 */
export const variableBlock = {
    type: 'variable', label: 'Variable', kind: 'reporter', category: 'Variables',
    defaults: { name: 'a' },
    fields: ['name'],
    reduce: (p, scope) => { const n = scope[p.name]; return n == null ? 0 : Number(n); },
};
