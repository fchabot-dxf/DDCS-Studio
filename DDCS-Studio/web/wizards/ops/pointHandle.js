/**
 * wizards/ops/pointHandle.js — the POINT-HANDLE GUI block (t2521, BACKLOG #71's second gesture — the mill
 * family's own POSITION handle: a corner/edge/probe-start "pos" dot).
 *
 * Same shape as `length_handle` (its own header has the full account, including the t2525 fix): `fx`/`fy` are
 * MUST-MATCH PICKERS naming EXISTING params two "Op Param" `formfield` blocks elsewhere in the stack already
 * bind — `handleBindingsFromStack`/`attach()` merges this handle's anchor onto each real binding, so dragging
 * reaches emit for real. Nests inside `feature_canvas`'s own mouth, fixed literal anchor (ax/ay).
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
    help: 'A draggable 2D POINT handle on the feature canvas, at a fixed anchor (ax, ay). `fx`/`fy` must each name an EXISTING "Op Param" form field elsewhere in the stack — dragging writes them for real (it reaches the emitted G-code).',
    defaults: { fx: 'px', fy: 'py', x: '40', y: '60', ax: '0', ay: '0', label: 'pos' },
    fields: ['fx', 'fy', 'x', 'y', 'ax', 'ay', 'label'],
    emit: () => [],   // metadata only — the BLOCK produces no G-code itself; the params it names (once resolved) do, via the merged real bindings
};
