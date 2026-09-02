/**
 * wizards/ops/projLengthHandle.js — the PROJ-LENGTH-HANDLE GUI block (t2533, BACKLOG #71's seventh gesture — a
 * PERPENDICULAR-PROJECTION symmetric-extent handle about a fixed centre, canvasWidgets.js's own `projLength`
 * gesture, e.g. slot's own width handle: a drag projects onto an axis, and the ABSOLUTE distance × a scale
 * factor sets a symmetric field — a half-extent measured off its OWN centreline, not a one-sided reach).
 *
 * Same shape as `length_handle` (its own header has the full account, including the t2525 fix): `field` is a
 * MUST-MATCH PICKER naming an EXISTING param an "Op Param" `formfield` elsewhere in the stack already binds —
 * `handleBindingsFromStack`/`attach()` merges this handle's anchor onto the real binding, so dragging reaches
 * emit for real. Nests inside `feature_canvas`'s own mouth, fixed literal anchor (cx/cy) — SIMPLER than
 * `scale_handle`/`shear_handle`'s own new wrinkle: canvasWidgets.js's own `off` (the CURRENT half-extent) is
 * SELF-DERIVED from this same field's own current value (`off = value / scale`, the real slotView.js/
 * panelTypes.js usage's own shape: `off: hw` where `hw = width/2` and `scale: 2`) — no second, read-only
 * companion param needed, unlike `scaleX`'s `baseField`/`shear`'s `hField`.
 *
 * `axis` picks a CARDINAL projection direction (X/Y, same convention as `length_handle`'s own axis field,
 * narrowed the same way in bridge.js) rather than an arbitrary unit vector — canvasWidgets.js's own `nx`/`ny`
 * generalize to any direction, but every real caller (slotView/slotData/panelTypes' own byRole.width branch)
 * only ever projects onto a cardinal axis, and a free (nx,ny) pair risks an unnormalized vector an author could
 * declare wrong (the drag math assumes |n|=1) — the cardinal picker makes that mistake unrepresentable.
 */
export const projLengthHandleBlock = {
    type: 'proj_length_handle', label: 'proj length handle', category: 'Wizard Layout', kind: 'proj_length_handle',
    help: 'A draggable SYMMETRIC-EXTENT handle on the feature canvas: drag projects onto a cardinal axis about a fixed centre (cx, cy) to set a symmetric field (e.g. a width measured off its own centreline). Nests inside a feature canvas block. `field` must name an EXISTING "Op Param" form field elsewhere in the stack — dragging writes it for real (it reaches the emitted G-code).',
    defaults: { field: 'width', axis: 'X', cx: '0', cy: '0', scale: '2', min: '0', max: '', label: 'width' },
    fields: ['field', 'axis', 'cx', 'cy', 'scale', 'min', 'max', 'label'],
    emit: () => [],   // metadata only — the BLOCK produces no G-code itself; the param it names (once resolved) does, via the merged real binding
};
