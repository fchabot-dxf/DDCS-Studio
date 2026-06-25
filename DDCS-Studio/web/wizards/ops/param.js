/**
 * wizards/ops/param.js — the PARAM reporter (kind:'reporter'), the keystone GUI block of the wizard-maker.
 *
 * Plug it into any value socket (a numeric field) → "this value is a KNOB named <name>, rendered as <widget>."
 * reduce() returns its default so the op still emits a real number; the name/widget are metadata read at SAVE
 * time (userOps.extractParamBlocks) → a form binding. This makes the form VISIBLE as a block instead of a hidden
 * inline checkbox. v(A): the saved template stores the reduced number (param blocks are an authoring input, they
 * don't round-trip). v(B) [target, see memory]: keep the param record in the template so it round-trips.
 *
 * `value` is a numeric socket (the default), so it can itself hold a #var/expression like any value.
 */
export const paramBlock = {
    type: 'param', label: 'param', kind: 'reporter', category: 'Variables',
    defaults: { name: 'value', widget: 'number', value: 0 },
    fields: ['name', 'widget', 'value'],
    reduce: (p, scope, rc) => {
        const v = p.value;
        if (v && typeof v === 'object' && rc) return rc(v);   // a reporter plugged into the default socket
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    },
};
