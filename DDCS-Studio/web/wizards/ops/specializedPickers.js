/**
 * wizards/ops/specializedPickers.js — Specialized datum, picker, and input control blocks.
 * Defines 3x3 datum grid, region picker, tool library picker, thread picker, declared I/O picker,
 * range slider, and stepper input blocks.
 */

export const cornerGridPickerBlock = {
    type: 'corner_grid_picker', label: '3x3 datum grid', category: 'Wizard Inputs',
    defaults: { param: 'datum', label: 'Datum Corner', dflt: 'nn' },
    fields: ['param', 'label', 'dflt'],
    emit: () => [],
};

export const regionPickFieldBlock = {
    type: 'region_pick_field', label: 'region/plane picker', category: 'Wizard Inputs',
    defaults: { param: 'region', label: 'Selected Plane' },
    fields: ['param', 'label'],
    emit: () => [],
};

export const toolLibraryPickerBlock = {
    type: 'tool_library_picker', label: 'tool picker (with ⚙)', category: 'Wizard Inputs',
    defaults: { param: 'toolNum', label: 'Tool Number', dflt: '' },
    fields: ['param', 'label', 'dflt'],
    emit: () => [],
};

export const threadPresetPickerBlock = {
    type: 'thread_preset_picker', label: 'thread/pitch picker', category: 'Wizard Inputs',
    defaults: { param: 'pitch', label: 'Pitch / Lead', dflt: '1.0' },
    fields: ['param', 'label', 'dflt'],
    emit: () => [],
};

export const declaredIoPickerBlock = {
    type: 'declared_io_picker', label: 'controller I/O picker', category: 'Wizard Inputs',
    defaults: { param: 'pin', label: 'I/O Pin', kind: 'output' },
    fields: ['param', 'label', 'kind'],
    selects: { kind: [['Output Pin (M62-M65)', 'output'], ['Input Pin (M66)', 'input']] },
    emit: () => [],
};

export const sliderFieldBlock = {
    type: 'slider_field', label: 'range slider', category: 'Wizard Inputs',
    defaults: { param: 'feedRatio', label: 'Feed Ratio %', min: '10', max: '200', step: '5', dflt: '100' },
    fields: ['param', 'label', 'min', 'max', 'step', 'dflt'],
    emit: () => [],
};

export const stepperFieldBlock = {
    type: 'stepper_field', label: 'stepper input', category: 'Wizard Inputs',
    defaults: { param: 'passes', label: 'Pass Count', stepperSide: 'left', step: '1', dflt: '1' },
    fields: ['param', 'label', 'stepperSide', 'step', 'dflt'],
    selects: { stepperSide: [['Left Side', 'left'], ['Right Side', 'right']] },
    emit: () => [],
};
