/**
 * wizards/ops/rectHandle.js — the RECT-HANDLE GUI block (t2521, BACKLOG #71's third gesture — a 2D SIZE
 * corner: W×H from a fixed anchor, the mill family's own drill-pattern/pocket/text-box sizing handle).
 *
 * Same self-contained shape as `length_handle`/`point_handle` (their own headers have the full account):
 * carries its own bound param names + defaults, nests inside `feature_canvas`'s own mouth, fixed literal
 * anchor (ax/ay), emits nothing.
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
    help: 'A draggable 2D SIZE (W×H) handle on the feature canvas, bound to two params (field, fieldH) from a fixed anchor (ax, ay). valueField picks which one the handle’s own displayed number reflects. Nests inside a feature canvas block. Emits nothing (sim/form-only).',
    defaults: { field: 'w', fieldH: 'h', value: '40', valueH: '30', ax: '0', ay: '0', sx: '1', sy: '1', minw: '', maxw: '', minh: '', maxh: '', valueField: 'field', label: 'W×H' },
    fields: ['field', 'fieldH', 'value', 'valueH', 'ax', 'ay', 'sx', 'sy', 'minw', 'maxw', 'minh', 'maxh', 'valueField', 'label'],
    emit: () => [],   // metadata only — produces no G-code (read at register/save → two socket-less rect-sized bindings)
};
