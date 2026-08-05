/**
 * wizards/ops/vizBlocks.js — Standalone preview & visualizer declaration UI blocks.
 * Declares 3D toolpath simulation, 2D interactive feature canvas, and G-code output boxes.
 */
export const sim3dBoxBlock = {
    type: 'sim_3d_box', label: '3D toolpath box', category: 'Wizard UI',
    defaults: { minHeight: '300px', showControls: true },
    fields: ['minHeight', 'showControls'],
    emit: () => [],
};

export const layout2dCanvasBlock = {
    type: 'layout_2d_canvas', label: '2D feature canvas', category: 'Wizard UI',
    defaults: { minHeight: '250px', showRuler: true },
    fields: ['minHeight', 'showRuler'],
    emit: () => [],
};

export const codePreviewPanelBlock = {
    type: 'code_preview_panel', label: 'G-code preview', category: 'Wizard UI',
    defaults: { title: 'Code Preview', maxHeight: '150px' },
    fields: ['title', 'maxHeight'],
    emit: () => [],
};
