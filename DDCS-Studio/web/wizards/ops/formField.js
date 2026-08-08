/**
 * wizards/ops/formField.js — the FORM value-field GUI block (composable-authoring PILOT 1).
 *
 * The blocks-native twin of a BINDING_SPEC row (blocks/dataOps/deriveBindings.js): each block declares ONE wizard
 * FORM field bound to a macro var — the composable form. It lives in the `user_root` PRESENTATION mouth alongside
 * `panel`/`sim`/`simstart`/`param_group`, and EMITS NOTHING: it's metadata read at register/save time by
 * userOps.bindingsFromStack → def.bindingSpecs (the socket link is by macro-var IDENTITY, match:{type:'assign',var},
 * NOT a param-name join — deriveBindings re-finds the flat index over the pruned stack). The reverse
 * (bindingsToBlocks) renders a hand-written spec set AS these blocks so a ported wizard is authorable/re-authorable.
 *
 * The fields ARE the deriveBindings spec vocabulary: param · widget · label · default (dflt; empty = socket-held, the
 * template's baked expression holds) · the socket link (matchvar #N + key) · the value type · section/help · optional ·
 * readonly(+hint) · an optional when-gate · widget config (dropdown options, or number min/max/step/units). `dynamic:
 * 'widget'` (ddcs_dynfields) shows only the chosen widget's config so the block stays readable. A DECLARATION, never
 * inferred — the composable substrate that lifts isMaintainedAsData (a spec authored as blocks round-trips losslessly).
 */
export const formFieldBlock = {
    type: 'formfield', label: 'form field', category: 'Wizard Inputs', kind: 'formfield',
    help: 'A wizard FORM field bound to a macro var (the composable BINDING_SPEC). Lives in the Presentation mouth, emits nothing; the form + emit read it. Default empty = the template socket holds (an expression default).',
    dynamic: 'widget',
    defaults: {
        param: 'value', widget: 'number', label: '', dflt: '',
        matchvar: '#1', key: 'value', type: 'number',
        section: '', help: '', optional: false, readonly: false, readonlyhint: '',
        whenparam: '', whenis: '',
        options: '', nmin: '', nmax: '', nstep: '', units: '',
        // t1613 — the DERIVED/WRITES sockets (the same two slots the shipped `passes` field declares): `derived` is
        // an expr over the form's params; `writes` is one-or-more "param = expr" lines fired on a user gesture.
        derived: '', writes: '',
    },
    allFields: ['param', 'widget', 'label', 'dflt', 'matchvar', 'key', 'type', 'section', 'help', 'optional', 'readonly', 'readonlyhint', 'whenparam', 'whenis', 'options', 'nmin', 'nmax', 'nstep', 'units', 'derived', 'writes'],
    fieldsFor(p) {
        const w = (p && p.widget) || 'number';
        const f = ['param', 'widget', 'label', 'dflt', 'matchvar', 'key', 'type', 'section', 'help', 'optional', 'readonly', 'readonlyhint', 'whenparam', 'whenis', 'derived', 'writes'];
        if (w === 'dropdown' || w === 'segmented') f.push('options');
        else if (w === 'number' || w === 'slider') f.push('nmin', 'nmax', 'nstep', 'units');
        return f;
    },
    emit: () => [],   // metadata only — produces no G-code (read at register/save → def.bindingSpecs → the form + emit)
};
