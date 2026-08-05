/**
 * wizards/ops/tabGroup.js — tab_group & tab_page UI blocks.
 * Declares tabbed container interfaces for organizing wizard form controls.
 */
export const tabGroupBlock = {
    type: 'tab_group', label: 'tab group', category: 'Wizard UI',
    defaults: { activeTab: '0' },
    fields: ['activeTab'],
    mouths: [{ name: 'TABS', label: 'Tab Pages' }],
    emit: (params, children) => children || [],
};

export const tabPageBlock = {
    type: 'tab_page', label: 'tab page', category: 'Wizard UI',
    defaults: { title: 'General', icon: '' },
    fields: ['title', 'icon'],
    mouths: [{ name: 'DO', label: 'Page Content' }],
    emit: (params, children) => children || [],
};
