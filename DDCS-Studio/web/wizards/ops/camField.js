/**
 * wizards/ops/camField.js — the BLOCK-NATIVE CAM PENDANT FIELD family (block-native-params S1).
 *
 * The pendant (controller) face of a custom-op's value bindings, declared as blocks instead of living only in the CAM-build
 * modal. Direct siblings of `formfield` (the FORM face): metadata blocks that live in the `user_root` PRESENTATION mouth and
 * EMIT NOTHING — read at CAM-build time by `camFieldsFromStack` (blocks/userOps.js), the mirror of `bindingsFromStack`.
 *
 *   `cam_table`  — a titled C-mouth CONTAINER holding the pendant-field rows (joins the param_group/section/opunit family,
 *                  BUT emits `[]` rather than transparent-passing its children: its children are DECLARATIONS, not atoms, so
 *                  it must NOT be added to blockEmitter's transparent set — falling through to emit()=[] keeps emit
 *                  byte-identical, exactly like formfield).
 *   `cam_field`  — ONE pendant row: it references a def value-binding by `param` (the ROUTING KEY, rendered READ-ONLY like
 *                  the opunit routing key), a pendant `label`, an expose/bake `mode` (one block + a toggle, not two block
 *                  types), a `baked` literal (when mode=bake), pendant `units`/`dflt`, and an editable `nmin`/`nmax` range.
 *                  Order in the cam_table mouth = pendant row order (the #11xx/#2600 allocator is order-driven).
 *
 * S1 scope: SCHEMAS + reader + round-trip only. The emit path (stackToSlot consuming these) is S2; the modal-as-view is S4.
 * A DECLARATION read as data, never inferred — the classifier/allocator stay pure functions of declared facts.
 */

export const camTableBlock = {
    type: 'cam_table', label: 'CAM Pendant Fields', category: 'CAM Pendant', kind: 'cam_table', mouth: 'DO',
    help: 'A group of controller (pendant) fields for a CAM slot. Each child row is one field; order in the group = pendant row order. Metadata only — emits no G-code.',
    defaults: {},
    fields: [],
    emit: () => [],   // metadata only — NOT transparent-passthrough (its children are cam_field declarations, not atoms) → byte-identical, like formfield
};

export const camFieldBlock = {
    type: 'cam_field', label: 'pendant field', category: 'CAM Pendant', kind: 'cam_field',
    help: 'One controller (pendant) field for a CAM slot. Expose = the operator fills it on the pendant (#11xx→#2600); Bake = frozen into the macro (uses the "baked" literal). `param` is the def value-binding it declares (read-only routing key). Empty label/units/default inherit the binding; empty min/max = no pendant range.',
    // NB no `dynamic:'mode'` — ddcs_dynfields toggles VALUE-socket inputs (getInput/setVisible), but these are all inline
    // text fields, so a dynamic toggle is a no-op here. All fields stay visible; the `mode` dropdown drives expose-vs-bake and
    // `baked` is simply read only when mode==='bake' (camFieldsFromStack). A compact per-mode layout is a later polish slice.
    defaults: {
        param: '',        // which def value-binding this row is (matches binding.param) — the ROUTING KEY, read-only chip
        label: '',        // pendant -s1 label (empty = inherit binding.label)
        mode: 'expose',   // 'expose' | 'bake'
        baked: '',        // the frozen literal when mode==='bake' (else ignored)
        units: '',        // pendant -s2 units (empty = inherit binding.units)
        dflt: '',         // pendant default seed (empty = inherit binding.default)
        nmin: '', nmax: '',   // pendant editable range (-min/-max; empty = no range)
    },
    fields: ['param', 'label', 'mode', 'baked', 'units', 'dflt', 'nmin', 'nmax'],
    emit: () => [],   // metadata only — read at CAM-build by camFieldsFromStack; produces no G-code
};
