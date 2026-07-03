/**
 * wizards/ops/userRoot.js — the CUSTOM WIZARD root and UI container blocks.
 *
 * `user_root`: The top-level definition block for a custom wizard. It visually separates the
 * UI/Sim metadata into a Presentation mouth, and the G-code macros into an Execution mouth.
 * During G-code generation, it simply emits all children sequentially, but the metadata
 * blocks natively emit nothing, while the execution blocks emit G-code.
 *
 * `param_group`: A nested mouth for grouping parameters in the Presentation mouth.
 */

export const userRootBlock = {
    type: 'user_root',
    label: 'Define Custom Wizard',
    category: 'Wizard UI',
    kind: 'user_root',
    defaults: {},
    fields: [],
    // Emits both UI/Presentation blocks (which typically emit nothing but variable assignments) 
    // and the Execution blocks.
    emit: (params, children, rec) => [...(rec.uiChildren || []), ...(rec.children || [])],
};

export const paramGroupBlock = {
    type: 'param_group',
    label: 'Parameter Group',
    category: 'Wizard UI',
    kind: 'param_group',
    defaults: { group: 'Settings' },
    fields: ['group'],
    // Emits its DO children (e.g. Set Variable assignments)
    emit: (params, children) => children || [],
};

// `section`: a generic TITLED, transparent-emit container (the param_group generalization, t130). A custom wizard uses it
// to organise its blocks into labeled concern-sections (STRUCTURAL / VARIABLES / the PRESENTATION view peers / G-CODE)
// WITHOUT changing the emit — it emits its DO children in order, so wrapping atoms in sections is byte-transparent. Every
// walker (flattenBlocks, pruneGuards, blockEmitter) already recurses generically through `.children`, so nesting is safe.
export const sectionBlock = {
    type: 'section',
    label: 'Section',
    category: 'Wizard UI',
    kind: 'section',
    defaults: { title: 'Section' },
    fields: ['title'],
    emit: (params, children) => children || [],   // transparent — the label is authoring-only; emit order = children order
};
