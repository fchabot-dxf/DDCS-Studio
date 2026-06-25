/**
 * wizards/ops/coordlist.js — the COORDINATE-LIST block ("positions"): the block-side twin of the form's coord-list
 * positioner. Holds a group of XY points (+ a shared Z) and renders them inline as the field_coordlist PREVIEW (see
 * blocks/blockly/bridge.js fieldKind/jsonDef). Markup: emits NOTHING — a future positioner op consumes the list. The
 * list is the `pts` field's VALUE, a JSON string of { points:[{x,y}], z } (serializable → round-trips like any field).
 * The first list-valued instance of the parametric-canvas atom on the block side.
 */
export const coordListBlock = {
    type: 'coordlist', label: 'positions', category: 'Variables',
    defaults: { pts: '{"points":[],"z":0}' },   // JSON of { points:[{x,y}], z } — rendered as the inline preview
    fields: ['pts'],
    emit: () => [],   // metadata only — produces no G-code
};
