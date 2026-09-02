/**
 * wizards/ops/shearHandle.js — the SHEAR-HANDLE GUI block (t2533, BACKLOG #71's sixth gesture — a skew/slant
 * ANGLE handle over a fixed height, canvasWidgets.js's own `shear` gesture, e.g. text's own slant handle).
 *
 * Same shape as `length_handle`/`point_handle`/`rect_handle`/`radial_handle`/`scale_handle` (their own headers
 * have the full account, including the t2525 fix): `field` is a MUST-MATCH PICKER naming an EXISTING param an
 * "Op Param" `formfield` elsewhere in the stack already binds — `handleBindingsFromStack`/`attach()` merges
 * this handle's anchor onto the real binding, so dragging reaches emit for real. Nests inside `feature_canvas`'s
 * own mouth, fixed literal anchor (ax/ay) — the baseline the slant pivots about.
 *
 * SAME SHAPE AS scale_handle's OWN NEW WRINKLE — `hField` is a SECOND must-match picker naming a SEPARATE
 * existing param read for its CURRENT VALUE only (the height the slant offset is measured over,
 * canvasWidgets.js's own `d.h`), never itself made draggable by this block: `handleBindingsFromStack` marks
 * the whole handle `anchorUnresolved` if EITHER picker's target is missing, but only `field`'s own binding gets
 * the merged anchor. No min/max: the `shear` gesture itself declares no clamp (an angle in degrees, unbounded).
 */
export const shearHandleBlock = {
    type: 'shear_handle', label: 'shear handle', category: 'Wizard Layout', kind: 'shear_handle',
    help: 'A draggable SKEW/SLANT ANGLE handle on the feature canvas, from a fixed baseline anchor (ax, ay). `field` must name an EXISTING "Op Param" form field elsewhere in the stack — dragging writes it for real (it reaches the emitted G-code). `hField` must name a SECOND existing param whose current value is the height the slant is measured over — read-only, it positions the handle but is never itself written by this block.',
    defaults: { field: 'slant', hField: 'height', value: '0', ax: '0', ay: '0', label: 'slant°' },
    fields: ['field', 'hField', 'value', 'ax', 'ay', 'label'],
    emit: () => [],   // metadata only — the BLOCK produces no G-code itself; the param it names (once resolved) does, via the merged real binding
};
