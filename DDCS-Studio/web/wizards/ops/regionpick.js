/**
 * wizards/ops/regionpick.js — the REGION-PICK reporter block ("make your own datum"), the block twin of the form's
 * region-pick widget. Plug it into a numeric value socket → that value becomes a graphical pick: click a region on
 * the spec's graphic to choose its NUMBER. `reduce` returns the picked number so the op still emits real G-code.
 *
 * `value` renders as the inline `field_regionpick` (see blocks/blockly/bridge.js fieldKind/jsonDef). `spec` is the
 * control definition (viewBox + backdrop + regions) — a JSON STRING (not a block field) carried on the block's
 * `data` via stackBridge, read by the field at render time. extractParamBlocks turns a regionpick pill into a
 * `widget:'region-pick'` binding (widgetConfig = the parsed spec), so the form + block render the same control.
 */
export const regionPickBlock = {
    type: 'regionpick', label: 'region pick', kind: 'reporter', category: 'Wizard UI',
    defaults: { name: 'choice', value: 0, spec: '' },   // spec = JSON string (non-field → rides b.data); value = picked number
    fields: ['name', 'value'],
    reduce: (p) => { const n = Number(p.value); return Number.isFinite(n) ? n : 0; },
};
