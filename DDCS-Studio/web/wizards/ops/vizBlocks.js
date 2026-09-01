/**
 * wizards/ops/vizBlocks.js — Standalone preview & visualizer declaration UI blocks.
 * Declares the 2D interactive feature canvas's shape vocabulary.
 * t1734 — sim3dBoxBlock ('sim_3d_box') and codePreviewPanelBlock ('code_preview_panel') were deleted here: zero
 * readers anywhere in the app (confirmed at t1724, acted on at t1734), and the Blocks-tab right column no longer
 * has a placeholder-container concept for either — 3D preview and G-code are handled by the tab machinery itself
 * (blocksApp.js), not by a droppable block. t2507 (BACKLOG #61 L7) — layout2dCanvasBlock ('layout_2d_canvas'),
 * the third and last of these container blocks, deleted too: its own Blockly round-trip was genuinely wired
 * (bridge.js's generic mouth mechanism, confirmed live at t1726 — mechanically real, not a false claim), but
 * NOTHING ever read the block's own existence or fields (`minHeight`/`showRuler` were never consumed by any
 * renderer) — the actual 2D feature canvas is rendered by the SEPARATE `panel` node (formWidgets.js:1478),
 * completely independent of whether a `layout_2d_canvas` sat anywhere in the tree. It was a third way to say
 * something `panel`/`sim`/`code_preview`/the split/section/tab containers already say, wired but never useful.
 * Owner ruling 2026-09-01: delete. See ARCHITECTURE.md and WORK-LOG t1734/t2507.
 */

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
