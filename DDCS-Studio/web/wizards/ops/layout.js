/**
 * wizards/ops/layout.js — the LAYOUT GUI block. Declares a custom wizard's layout kind (none, corner, etc.)
 * right in the stack. Emits NOTHING — it's metadata read at SAVE/RUNTIME time.
 */
export const layoutBlock = {
    type: 'layout', label: 'layout', category: 'Wizard Layout',
    defaults: { kind: 'none' },
    fields: ['kind'],
    emit: () => [],   // metadata only — produces no G-code
};

export const splitHorizontalBlock = {
    type: 'split_horizontal', label: 'split horizontal', category: 'Wizard Layout',
    defaults: { ratio: '1:1' },
    fields: ['ratio'],
    // t2311 — '360px:*' added: a fixed-width LEFT pane (matching .wiz-2pane's own 360px controls column) beside
    // one that fills the rest ('*'). formWidgets.js's renderUiTree parses either side of `ratio` independently,
    // so this reaches the same runtime vocabulary a hand-declared uiChildren tree can already express.
    selects: { ratio: [['1:1', '1:1'], ['2:1', '2:1'], ['1:2', '1:2'], ['360px:*', '360px + fill']] },
    mouths: [{ name: 'LEFT', label: 'Left Pane' }, { name: 'RIGHT', label: 'Right Pane' }],
    emit: (params, children) => children || [],
};

export const splitVerticalBlock = {
    type: 'split_vertical', label: 'split vertical', category: 'Wizard Layout',
    defaults: { ratio: '1:1' },
    fields: ['ratio'],
    selects: { ratio: [['1:1', '1:1'], ['2:1', '2:1'], ['1:2', '1:2'], ['360px:*', '360px + fill']] },
    mouths: [{ name: 'TOP', label: 'Top Pane' }, { name: 'BOTTOM', label: 'Bottom Pane' }],
    emit: (params, children) => children || [],
};
