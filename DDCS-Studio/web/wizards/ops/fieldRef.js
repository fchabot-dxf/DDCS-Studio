/**
 * wizards/ops/fieldRef.js — the PLACEMENT twin of `field_ref` (t2299, wizards-as-data). formWidgets.js's own
 * `traverse()` reads `field_ref` as "place THIS already-bound param's already-rendered row here" — a pure
 * LAYOUT reference, not a declaration. That is a different concept from `formfield` (formField.js) and
 * `param_field` (paramField.js), which each DECLARE a brand-new bound field from their own block's own
 * label/widget/type/default fields. Both of those already live in a `param_group` inside `uiChildren` — the
 * SAME location a presentation tree places its own rows — and both strings are ALSO scanned there by
 * userOps.js's bindingsFromStack/paramFieldsFromStack (the authoring-derivation path). Reusing either name
 * for a plain placement reference silently misreads it as an authored spec and corrupts registerUserOp's
 * derivation (confirmed the hard way, t2299 drill build) — `field_ref` exists so a presentation tree never
 * has to share a name with an authoring block again.
 *
 * Emits NOTHING — metadata only, read by formWidgets.js's `traverse()` at render time to relocate an
 * already-rendered `[data-param]` row; the row's own binding (label/widget/type/default) is unchanged.
 */
export const fieldRefBlock = {
    type: 'field_ref', label: 'field', category: 'Wizard Form', kind: 'field_ref',
    help: 'Places an already-bound param\'s already-rendered form row at this position in the tree. `param` must name an existing def binding — this block does not declare one.',
    defaults: {
        param: '',   // which bound param's row to place here — a routing key, not a new declaration
    },
    fields: ['param'],
    emit: () => [],   // metadata only — produces no G-code
};
