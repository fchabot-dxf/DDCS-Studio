/**
 * wizards/ops/layoutWidget.js — the LAYOUT-2D widget GUI block (composable-authoring PILOT 2: point-pick).
 *
 * The GUI twin of the formfield block (PILOT 1): a `layoutwidget` block DECLARES a draggable 2D handle on the layout
 * canvas, bound to op params. v1 = POINT-PICK — a draggable point bound to two params (fx, fy). It lives in the
 * `user_root` PRESENTATION mouth alongside formfield/panel/sim, and EMITS NOTHING (sim/form-only): userOps.
 * layoutBindingsFromStack expands it to TWO `{group, role:'x'/'y', anchor}` bindings, which the EXISTING
 * layoutSpecFromOp x+y→`point` derivation renders as a draggable handle (canvasWidgets CANVAS_GESTURES.point). Dragging
 * the point writes fx/fy (the world coords); typing fx/fy moves the point (two-way). A DECLARATION, never inferred.
 *
 * THE ANCHOR (the crux): `anchor:{kind, frame}` declares WHERE the handle lives. kind 'point' + frame 'stock-min' = an
 * ABSOLUTE PHYSICAL point (stock min-XY, ax=0) — the datum model (coords stored physical, datum-relative is display-only,
 * deferred). layoutSpecFromOp switches on anchor.kind (KEEPING the magic-name sniff fallback so corner/edge/② stay
 * byte-identical). Drag-only, absolute (NO relTo/incremental, NO click-to-place — the clean pilot with no implicit derivation).
 */
export const layoutWidgetBlock = {
    type: 'layoutwidget', label: 'point pick', category: 'Wizard UI', kind: 'layoutwidget',
    help: 'A draggable 2D POINT on the layout canvas, bound to two params (fx, fy). Emits nothing (sim/form-only): dragging the point writes the params, typing them moves the point. anchor point + frame stock-min = an absolute physical point (stock min-XY).',
    defaults: { fx: 'px', fy: 'py', anchor: 'point', frame: 'stock-min', xval: '50', yval: '50', label: 'pt' },
    fields: ['fx', 'fy', 'anchor', 'frame', 'xval', 'yval', 'label'],
    emit: () => [],   // metadata only — produces no G-code (read at register/save → the group/role layout bindings)
};
