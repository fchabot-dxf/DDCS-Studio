/**
 * wizards/ops/formControls.js — Form control & diagram UI blocks.
 * Provides explicit dropdown, toggle, segmented picker, SVG diagram, and action button controls.
 */
export const formDropdownBlock = {
    type: 'form_dropdown', label: 'dropdown field', category: 'Wizard Inputs',
    defaults: { param: 'mode', label: 'Mode', options: 'Option A, Option B', dflt: 'Option A' },
    fields: ['param', 'label', 'options', 'dflt'],
    emit: () => [],
};

export const formCheckboxBlock = {
    type: 'form_checkbox', label: 'toggle field', category: 'Wizard Inputs',
    defaults: { param: 'enabled', label: 'Enabled', dflt: 'false' },
    fields: ['param', 'label', 'dflt'],
    selects: { dflt: [['False', 'false'], ['True', 'true']] },
    emit: () => [],
};

export const formSegmentedBlock = {
    type: 'form_segmented', label: 'segmented picker', category: 'Wizard Inputs',
    defaults: { param: 'axis', label: 'Axis', options: 'X, Y, Z' },
    fields: ['param', 'label', 'options'],
    emit: () => [],
};

export const formDiagramBlock = {
    type: 'form_diagram', label: 'inline diagram', category: 'Wizard Previews',
    defaults: { svgAsset: 'corner_diagram.svg', maxHeight: '120px' },
    fields: ['svgAsset', 'maxHeight'],
    emit: () => [],
};

export const formActionBtnBlock = {
    type: 'form_action_btn', label: 'action button', category: 'Wizard Inputs',
    defaults: { label: 'Open Tool Library', action: 'toolLibrary' },
    fields: ['label', 'action'],
    selects: { action: [['Tool Library', 'toolLibrary'], ['Homing Setup', 'homingSetup'], ['ATC Setup', 'atcSetup']] },
    emit: () => [],
};
