/**
 * wizards/ops/panel.js — the PANEL GUI block. Declares a custom wizard's panel layout (form / form3d / form2d)
 * right in the stack. Emits NOTHING — it's metadata read at SAVE time (devMode → def.panel). Pairs with the
 * `param` block: together they're the visible "form" section of a custom wizard (the GUI-blocks authoring layer).
 */
export const panelBlock = {
    type: 'panel', label: 'panel', category: 'Wizard Previews', kind: 'panel',   // t161 — an explicit metadata kind (like section/param_group/structctl) so devMode.isAtom excludes it from the knob kit
    defaults: { panel: 'form3d' },
    fields: ['panel'],
    emit: () => [],   // metadata only — produces no G-code
};
