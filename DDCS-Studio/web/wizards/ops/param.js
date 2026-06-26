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
 *
 * Typed widgets: a param block always lives in a NUMERIC socket, so every widget commits a NUMBER (valid by
 * construction, no emitter changes) — number/slider = a plain number; `dropdown` = a numeric preset chosen from
 * the `options` list ("Rough=500, Finish=1500"); `toggle` = 0/1. Non-numeric widgets (text / corner-grid) target
 * inline fields, not sockets, so they aren't reachable from a param block (form-only — see ui/formWidgets.js).
 */
export const paramBlock = {
    type: 'param', label: 'param', kind: 'reporter', category: 'Wizard UI',
    defaults: { name: 'value', widget: 'number', value: 0, options: '' },
    fields: ['name', 'widget', 'value', 'options'],   // `options` (presets) only matters for the dropdown widget
    reduce: (p, scope, rc) => {
        const v = p.value;
        if (v && typeof v === 'object' && rc) return rc(v);   // a reporter plugged into the default socket
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    },
};
