/**
 * wizards/ops/pointHandle.js — the POINT-HANDLE GUI block (t2521, BACKLOG #71's second gesture — the mill
 * family's own POSITION handle: a corner/edge/probe-start "pos" dot).
 *
 * Same shape as `length_handle` (its own header has the full account): self-contained (carries its own bound
 * param names + defaults), nests inside `feature_canvas`'s own mouth, fixed literal anchor (ax/ay), emits
 * nothing (sim/form-only).
 *
 * WHERE IT DIFFERS FROM LENGTH: this gesture already had ONE render-side branch
 * (`anchor.kind === 'point'`, panelTypes.js), reached today only by `layoutwidget` (nested in `param_group`,
 * always anchored at {0,0} — its own `frame` field selects a coordinate FRAME, never a literal offset). Rather
 * than declare a second, parallel anchor kind, this block reuses that SAME branch: `layoutSpecFromOp`'s own
 * `pos()` helper already took an `(ax, ay)` pair, just always called with none — extended (this turn) to read
 * an optional `anchor.ax`/`anchor.ay`/`anchor.label` off the group, defaulting to `(0, 0, 'pos')` so
 * `layoutwidget`'s own existing behaviour is byte-identical. TWO bound params (fx/fy), not one — matching the
 * gesture's own two-field shape, same as `layoutwidget`'s.
 */
export const pointHandleBlock = {
    type: 'point_handle', label: 'point handle', category: 'Wizard Layout', kind: 'point_handle',
    help: 'A draggable 2D POINT handle on the feature canvas, bound to two params (fx, fy), at a fixed anchor (ax, ay). Nests inside a feature canvas block. Emits nothing (sim/form-only): dragging writes fx/fy relative to the anchor, typing them moves the point.',
    defaults: { fx: 'px', fy: 'py', x: '40', y: '60', ax: '0', ay: '0', label: 'pos' },
    fields: ['fx', 'fy', 'x', 'y', 'ax', 'ay', 'label'],
    emit: () => [],   // metadata only — produces no G-code (read at register/save → a socket-less point binding)
};
