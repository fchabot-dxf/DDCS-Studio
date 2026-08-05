/**
 * wizards/ops/groupBox.js — group_box UI block.
 * Titled visual card container block with optional collapse capability.
 */
export const groupBoxBlock = {
    type: 'group_box', label: 'group box', category: 'Wizard UI',
    defaults: { title: 'Group', collapsible: true, collapsedDefault: false },
    fields: ['title', 'collapsible', 'collapsedDefault'],
    mouths: [{ name: 'DO', label: 'Group Content' }],
    emit: (params, children) => children || [],
};
