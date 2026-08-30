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
// t2423 — category was 'Wizard Form', a name that exists nowhere in CATEGORIES (wizards/ops/index.js:141) —
// a typo, caught by bridge.js's own catch-all (t1570) as an "Uncategorised" palette group. Filed under
// 'Wizard Layout', not 'Wizard Inputs' (the owner's own default lean), on the strength of this file's own
// header above: field_ref explicitly does NOT declare a bound field the way every 'Wizard Inputs' block does
// (formfield/param_field/the pickers) — it RELOCATES an already-declared row's position in the tree, the same
// "where things sit" concern 'Wizard Layout's own members (grid_container/group_box/layout/split_*) exist
// for. Filing it under Inputs would echo the exact hazard this header already warns about (sharing a name/
// category with an authoring block silently misreads a placement reference as a declaration).
export const fieldRefBlock = {
    type: 'field_ref', label: 'field', category: 'Wizard Layout', kind: 'field_ref',
    help: 'Places an already-bound param\'s already-rendered form row at this position in the tree. `param` must name an existing def binding — this block does not declare one.',
    defaults: {
        param: '',   // which bound param's row to place here — a routing key, not a new declaration
    },
    fields: ['param'],
    emit: () => [],   // metadata only — produces no G-code
};
