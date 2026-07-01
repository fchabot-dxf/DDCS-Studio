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
