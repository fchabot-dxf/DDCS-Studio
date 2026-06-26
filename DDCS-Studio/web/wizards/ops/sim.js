/**
 * wizards/ops/sim.js — the PREVIEW-RIG GUI block. Declares a custom wizard's preview intent (4th-axis rotary rig /
 * machine frame / ATC magazine) right in the stack — the blocks-native twin of the dev-panel "Preview rig"
 * checkboxes, paired with the `param` + `panel` blocks as the visible authoring layer. Emits NOTHING: it's metadata
 * read at SAVE time (devMode → def.sim). Intent is DECLARED, never inferred from the stack's motion (the axis
 * letter doesn't carry intent for an open-world op — see opSimContext / [[custom-op-sim-intent-infer-vs-declare]]).
 */
export const simBlock = {
    type: 'sim', label: 'preview rig', category: 'Wizard UI',
    defaults: { rotary: false, machine: false, magazine: false },
    fields: ['rotary', 'machine', 'magazine'],
    emit: () => [],   // metadata only — produces no G-code
};
