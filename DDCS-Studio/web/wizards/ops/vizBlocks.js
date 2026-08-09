/**
 * wizards/ops/vizBlocks.js — Standalone preview & visualizer declaration UI blocks.
 * Declares 3D toolpath simulation, 2D interactive feature canvas, and G-code output boxes.
 */
export const sim3dBoxBlock = {
    type: 'sim_3d_box', label: '3D toolpath box', category: 'Wizard Previews',
    defaults: { minHeight: '300px', showControls: true },
    fields: ['minHeight', 'showControls'],
    emit: () => [],
};

export const layout2dCanvasBlock = {
    // t1627 — `kind: 'uibox'`: a UI container that HOLDS declarations (the shape primitives nest in its DO mouth)
    // and never emits its children. A NEW declared kind on the existing mouth axis — the t1595 guard precedent:
    // bridge (the mouth row) + stackBridge (BOTH round-trip directions) each list it; the emitter's kind branches
    // don't know it, so it falls through to `emit: () => []` exactly like the kind-less leaf it used to be.
    type: 'layout_2d_canvas', label: '2D feature canvas', category: 'Wizard Layout', kind: 'uibox', mouth: 'DO',
    defaults: { minHeight: '250px', showRuler: true },
    fields: ['minHeight', 'showRuler'],
    emit: () => [],
};

/**
 * ── t1627 — THE FOUR SHAPE PRIMITIVES (`Wizard Shapes` gets its contents) ─────────────────────────────────────
 *
 * The set is the FeatureCanvas's own item vocabulary — rect / circle / line / marker(hole) are the four `kind`s
 * the canvas has always drawn, and every shipped 2D preview is already expressed in them (the survey's test:
 * pocket=rect, drill pattern=markers, slot=lines, bore=circle; the parallelogram is four lines). Nothing new is
 * invented; the declaration makes DATA of what the role-sniffs and view code hand-rolled.
 *
 * THE FORMAT, designed for a future declaring-MODAL to emit (the user's standing ruling): one block per shape,
 * flat coordinate fields in WORK coordinates (X-right / Y-up, the canvas convention), each field a NUMBER OR AN
 * EXPRESSION over the wizard's params ('width / 2') — evaluated per render by the ONE evaluator (ops/expr.js)
 * with the live params as scope. A field that resolves to nothing skips ITS shape, never breaks the canvas.
 * Deliberately NOT taken (the granularity forks the dispatch named, answered by the survey): no parametric-path
 * primitive (declared geometry beyond these four stays the previewGeometry code seam — t708); no transform
 * blocks (the canvas item model is absolute-coordinate; placement is the emit's placeShift machinery).
 */
export const shapeRectBlock = {
    type: 'shape_rect', label: 'rectangle', category: 'Wizard Shapes',
    help: 'Draw a rectangle on the 2D feature canvas. Each field takes a number or an expression over the wizard’s params (e.g. width / 2).',
    defaults: { x: '0', y: '0', w: '50', h: '30' },
    fields: ['x', 'y', 'w', 'h'],
    emit: () => [],
};
export const shapeCircleBlock = {
    type: 'shape_circle', label: 'circle', category: 'Wizard Shapes',
    help: 'Draw a circle on the 2D feature canvas — centre + diameter (a number or an expression over the wizard’s params).',
    defaults: { cx: '0', cy: '0', dia: '20' },
    fields: ['cx', 'cy', 'dia'],
    emit: () => [],
};
export const shapeLineBlock = {
    type: 'shape_line', label: 'line', category: 'Wizard Shapes',
    help: 'Draw a line segment on the 2D feature canvas (numbers or expressions over the wizard’s params).',
    defaults: { x1: '0', y1: '0', x2: '50', y2: '0' },
    fields: ['x1', 'y1', 'x2', 'y2'],
    emit: () => [],
};
export const shapeMarkerBlock = {
    type: 'shape_marker', label: 'point marker', category: 'Wizard Shapes',
    help: 'Draw a small point marker (a drill-pattern style dot) on the 2D feature canvas.',
    defaults: { x: '0', y: '0' },
    fields: ['x', 'y'],
    emit: () => [],
};

/** ONE source for "is this a 2D shape declaration" — the spec builder draws them, the ui-tree walker skips them
 *  (their rendering IS the canvas), and a future lint names them. A fifth primitive is a row here. */
export const SHAPE_2D_TYPES = new Set(['shape_rect', 'shape_circle', 'shape_line', 'shape_marker']);

export const codePreviewPanelBlock = {
    type: 'code_preview_panel', label: 'G-code preview', category: 'Wizard Previews',
    defaults: { title: 'Code Preview', maxHeight: '150px' },
    fields: ['title', 'maxHeight'],
    emit: () => [],
};
