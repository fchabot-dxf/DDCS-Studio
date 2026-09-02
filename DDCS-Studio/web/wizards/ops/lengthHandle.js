/**
 * wizards/ops/lengthHandle.js — the LENGTH-HANDLE GUI block (t2517, BACKLOG #71 pilot — the authoring goal's
 * actual blocker: no block anywhere could declare an interactive drag handle, even though the gesture math
 * (canvasWidgets.js's CANVAS_GESTURES, 11 of them) has existed since t2489). `length` is the pilot gesture —
 * already proved end to end, hand-rolled, on lathe facing (t2485): one field, one anchor, one axis, a min clamp.
 *
 * NESTS INSIDE `feature_canvas`'s own mouth (owner ruling, t2517): a handle belongs to a SPECIFIC canvas — it
 * writes one param and renders in one place — so containment, not a flat type-filter, is what says which canvas
 * owns it. `handleBindingsFromStack` (userOps.js) reads this block ONLY from inside a feature_canvas node's own
 * children, never a bare stack-wide scan.
 *
 * SELF-CONTAINED, like `layoutwidget` (the point-pick precedent this mirrors): the block carries its OWN bound
 * param name (`field`) + default (`value`) — an author drops ONE block and gets both a live number binding (a
 * real form row) AND the draggable handle, no separate formfield needed. `ax`/`ay` are a FIXED literal anchor
 * (not themselves bound/draggable) — the minimal shape this pilot needs; a bound/relative anchor is later work.
 * Emits NOTHING: sim/form-only, exactly like layoutwidget's fx/fy (no `match` socket → never reaches the emit).
 */
export const lengthHandleBlock = {
    type: 'length_handle', label: 'length handle', category: 'Wizard Layout', kind: 'length_handle',
    help: 'A draggable 1D LENGTH handle on the feature canvas: drag along one axis from a fixed anchor to set a param. Nests inside a feature canvas block. Emits nothing (sim/form-only): dragging writes the field, typing it moves the handle.',
    defaults: { field: 'len', value: '20', axis: 'Y', ax: '0', ay: '0', min: '0', max: '', label: 'length' },   // axis stored UPPERCASE (this codebase's own axis-field convention, e.g. flip.axis) — handleBindingsFromStack lowercases it for canvasWidgets.js's own d.axis==='x' check
    fields: ['field', 'value', 'axis', 'ax', 'ay', 'min', 'max', 'label'],
    emit: () => [],   // metadata only — produces no G-code (read at register/save → a socket-less length binding)
};
