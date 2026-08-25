/**
 * wizards/ops/pathAnchor.js — the PATH ANCHOR PICKER GUI block (t2271, wizards-as-data E2 measurement).
 *
 * Declares the dual stock-attach/path-datum corner-grid picker (ui/pathAnchorField.js) right in the stack —
 * used by all 6 "placement" mill ops (drill/pocket/contour/slot/surfacing/text; none of the 6 ATC ops need
 * it, no stock-attach geometry). `prefix` matches the widget's own `<prefix>stockAttach`/`<prefix>pathDatum`
 * id convention — see formWidgets.js's own 'path_anchor' traverse() branch for how the render side
 * reproduces that convention without touching the widget's own code.
 *
 * Emits NOTHING — metadata only; the two params it drives (stockAttach/pathDatum) are separately declared,
 * real bindings, read at emit time exactly as they always were.
 */
export const pathAnchorBlock = {
    type: 'path_anchor', label: 'path anchor picker', category: 'Wizard Inputs',
    defaults: { prefix: 'd_' },
    fields: ['prefix'],
    emit: () => [],   // metadata only — produces no G-code
};
