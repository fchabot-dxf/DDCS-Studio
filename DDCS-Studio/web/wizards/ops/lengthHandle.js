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
 * t2525 (BACKLOG #71) — `field` is now a MUST-MATCH PICKER (bridge.js HANDLE_ANCHOR_FIELDS), not free text: it
 * NAMES an EXISTING param an "Op Param" `formfield` elsewhere in the stack already binds to a real atom socket
 * — an author needs that formfield FIRST, then a handle to make it draggable, not one block instead of two.
 * `handleBindingsFromStack`/`attach()` (userOps.js) look up that param and MERGE this handle's anchor onto the
 * real binding, so dragging reaches emit through the SAME match/key the formfield already declared. A target
 * that resolves to nothing (the formfield deleted/renamed after authoring) renders as an obviously-broken red
 * marker instead of a normal handle (panelTypes.js) and blocks save (`handleTargetReport`, devMode.js) — never
 * silently absent or silently inert. `value` (this block's own literal default) is now VESTIGIAL once resolved
 * — the real binding's own DFLT wins — kept only as the render fallback before a target is ever picked. `ax`/
 * `ay` are still a FIXED literal anchor (not themselves bound/draggable).
 */
export const lengthHandleBlock = {
    type: 'length_handle', label: 'length handle', category: 'Wizard Layout', kind: 'length_handle',
    help: 'A draggable 1D LENGTH handle on the feature canvas: drag along one axis from a fixed anchor to set a param. Nests inside a feature canvas block. `field` must name an EXISTING "Op Param" form field elsewhere in the stack — dragging writes that field for real (it reaches the emitted G-code).',
    defaults: { field: 'len', value: '20', axis: 'Y', ax: '0', ay: '0', min: '0', max: '', label: 'length' },   // axis stored UPPERCASE (this codebase's own axis-field convention, e.g. flip.axis) — handleBindingsFromStack lowercases it for canvasWidgets.js's own d.axis==='x' check
    fields: ['field', 'value', 'axis', 'ax', 'ay', 'min', 'max', 'label'],
    emit: () => [],   // metadata only — the BLOCK produces no G-code itself; the param it names (once resolved) does, via the merged real binding
};
