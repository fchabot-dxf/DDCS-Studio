/**
 * wizards/ops/rectHandle.js — the RECT-HANDLE GUI block (t2521, BACKLOG #71's third gesture — a 2D SIZE
 * corner: W×H from a fixed anchor, the mill family's own drill-pattern/pocket/text-box sizing handle).
 *
 * Same shape as `length_handle`/`point_handle` (their own headers have the full account, including the t2525
 * fix): `field`/`fieldH` are MUST-MATCH PICKERS naming EXISTING params two "Op Param" `formfield` blocks
 * elsewhere in the stack already bind — `handleBindingsFromStack`/`attach()` merges this handle's anchor onto
 * each real binding, so dragging reaches emit for real. Nests inside `feature_canvas`'s own mouth, fixed
 * literal anchor (ax/ay).
 *
 * WHERE IT GENUINELY DIFFERS — this is the one the dispatch named as the real risk, and it was real: `rect`
 * is the first gesture here that drives TWO params from ONE handle (`field` for W, `fieldH` for H), which
 * means it needed `layoutSpecFromOp`'s own t2495 `valueField` routing: when BOTH axes are declared active on
 * one handle, nothing about the declaration alone says which one the handle's own displayed NUMBER reflects
 * (the existing convention only resolves this "by construction" when just ONE of field/fieldH is set at all —
 * see canvasWidgets.js's own t2495 comment). So this block carries an explicit `valueField` dropdown
 * ('field'/'fieldH') alongside `sx`/`sy` (the per-axis divisor — 1 = literal, matching this pilot) and
 * `minw`/`maxw`/`minh`/`maxh` (t2489's own symmetric clamp pair, per axis). A NEW `anchor.kind === 'rect'`
 * branch in `layoutSpecFromOp` was required (unlike point, which reused an existing one) — `rect` had no prior
 * declared-anchor authoring path at all; every existing rect handle in the app is built the OLDER way, from
 * role-tagged bindings (byRole.x/y/w/h) or hand-rolled JS, neither of which this block's own anchor shape fits.
 */
export const rectHandleBlock = {
    type: 'rect_handle', label: 'rect handle', category: 'Wizard Layout', kind: 'rect_handle',
    help: 'A draggable 2D SIZE (W×H) handle on the feature canvas, from a fixed anchor (ax, ay). `field`/`fieldH` must each name an EXISTING "Op Param" form field elsewhere in the stack — dragging writes them for real (it reaches the emitted G-code). valueField picks which one the handle’s own displayed number reflects.',
    defaults: { field: 'w', fieldH: 'h', value: '40', valueH: '30', ax: '0', ay: '0', sx: '1', sy: '1', minw: '', maxw: '', minh: '', maxh: '', valueField: 'field', label: 'W×H' },
    fields: ['field', 'fieldH', 'value', 'valueH', 'ax', 'ay', 'sx', 'sy', 'minw', 'maxw', 'minh', 'maxh', 'valueField', 'label'],
    emit: () => [],   // metadata only — the BLOCK produces no G-code itself; the params it names (once resolved) do, via the merged real bindings
};
