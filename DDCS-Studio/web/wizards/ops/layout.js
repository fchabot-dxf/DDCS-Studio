/**
 * wizards/ops/layout.js — the LAYOUT GUI block. Declares a custom wizard's layout kind (none, corner, etc.)
 * right in the stack. Emits NOTHING — it's metadata read at SAVE/RUNTIME time.
 */
export const layoutBlock = {
    type: 'layout', label: 'layout', category: 'Wizard UI',
    defaults: { kind: 'none' },
    fields: ['kind'],
    emit: () => [],   // metadata only — produces no G-code
};

export const splitHorizontalBlock = {
    type: 'split_horizontal', label: 'split horizontal', category: 'Wizard UI',
    defaults: { ratio: '1:1' },
    fields: ['ratio'],
    selects: { ratio: [['1:1', '1:1'], ['2:1', '2:1'], ['1:2', '1:2']] },
    mouths: [{ name: 'LEFT', label: 'Left Pane' }, { name: 'RIGHT', label: 'Right Pane' }],
    emit: (params, children) => children || [],
};

export const splitVerticalBlock = {
    type: 'split_vertical', label: 'split vertical', category: 'Wizard UI',
    defaults: { ratio: '1:1' },
    fields: ['ratio'],
    selects: { ratio: [['1:1', '1:1'], ['2:1', '2:1'], ['1:2', '1:2']] },
    mouths: [{ name: 'TOP', label: 'Top Pane' }, { name: 'BOTTOM', label: 'Bottom Pane' }],
    emit: (params, children) => children || [],
};
