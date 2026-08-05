/**
 * wizards/ops/gridContainer.js — grid_container UI block.
 * Declares a multi-column CSS Grid container for form controls. Emits children in order.
 */
export const gridContainerBlock = {
    type: 'grid_container', label: 'grid container', category: 'Wizard UI',
    defaults: { columns: '2', gap: '16px' },
    fields: ['columns', 'gap'],
    selects: {
        columns: [['2 Columns', '2'], ['3 Columns', '3'], ['4 Columns', '4']],
        gap: [['8px', '8px'], ['16px', '16px'], ['24px', '24px']],
    },
    mouths: [{ name: 'DO', label: 'Child Controls' }],
    emit: (params, children) => children || [],
};
