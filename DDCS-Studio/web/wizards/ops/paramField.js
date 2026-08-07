/**
 * wizards/ops/paramField.js — the FORM-face pendant of a value binding (block-native params S5.1). The form analog of
 * `cam_field`, and a sibling of `formfield` — BUT a DEDICATED block, not a reuse of formfield (Fork B, confirmed t1105):
 * formfield's socket link is var-identity `match: { type:'assign', var }` (formField.js:7), which addresses an ASSIGN-var
 * data-op field; a def VALUE binding is `{ param, blockIndex, key }` (cleanBinding, userOps.js:111) — a (blockIndex,key)
 * socket. formfield cannot address a (blockIndex,key) socket, so the FORM face of a value binding needs its own block keyed
 * by `param`, symmetric with `cam_field`. One shared reader shape then serves both faces.
 *
 * Lives in a `param_group` in the user_root PRESENTATION mouth and EMITS NOTHING — metadata read at register time by
 * paramFieldsFromStack (the mirror of camFieldsFromStack / bindingsFromStack). Renders `param` as a READ-ONLY chip (the
 * routing key — a hand-edit dangles the binding), reusing the ddcs_camfield lock. S5.1 = schema + reader + materializer only;
 * the FORM RENDERER consuming these (ui/formWidgets.js — the widget registry) is a later slice.
 */
export const paramFieldBlock = {
    type: 'param_field', label: 'form field', category: 'Wizard Form', kind: 'param_field',
    help: 'One wizard FORM field for a value binding: the form label, widget, type, default, and (for a number widget) the min/max/step/units. `param` is the def value-binding it declares (read-only routing key). Metadata only — emits no G-code.',
    defaults: {
        param: '',        // which def value-binding this row is (matches binding.param) — the ROUTING KEY, read-only chip
        label: '',        // the form label (empty = inherit binding.label / the param name)
        widget: '',       // the form widget registry key (number/slider/dropdown/…); EMPTY = inherit, i.e. derive from `type` (t1562)
        type: 'number',   // the value type (number/int/enum/bool/string)
        dflt: '',         // the form default (empty = inherit binding.default)
        section: '', help: '',
        options: '',      // dropdown/segmented option list
        nmin: '', nmax: '', nstep: '', units: '',   // number-widget config
    },
    fields: ['param', 'label', 'widget', 'type', 'dflt', 'section', 'help', 'options', 'nmin', 'nmax', 'nstep', 'units'],
    emit: () => [],   // metadata only — read at register by paramFieldsFromStack; produces no G-code
};
