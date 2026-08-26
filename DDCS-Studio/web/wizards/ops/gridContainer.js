/**
 * wizards/ops/gridContainer.js — grid_container UI block.
 * Declares a multi-column CSS Grid container for form controls. Emits children in order.
 */
export const gridContainerBlock = {
    type: 'grid_container', label: 'grid container', category: 'Wizard Layout',
    defaults: { columns: '2', gap: '16px' },
    fields: ['columns', 'gap'],
    selects: {
        columns: [['2 Columns', '2'], ['3 Columns', '3'], ['4 Columns', '4']],
        gap: [['8px', '8px'], ['16px', '16px'], ['24px', '24px']],
    },
    // t2299 — was `mouths: [{ name: 'DO', ... }]` (plural), which bridge.js's `mouthOf` (`def.mouth`, singular)
    // never reads — both the Blockly SHAPE builder (addMouth) and stackBridge.js's round-trip serializer use
    // that same single property, so a plural-only declaration renders with no child-holding socket at all and
    // throws the moment a real child gets given to it. Undetected until now because nothing had ever given
    // grid_container real children before drill's own uiChildren tree (t2299) — the same "declared once,
    // proven never" gap field_ref's own Blockly twin closed a step earlier this turn.
    mouth: 'DO',
    emit: (params, children) => children || [],
};
