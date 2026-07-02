/**
 * wizards/ops/guard.js — a `guard`: a transparent container holding ONE arm of a structural fork, gated by a
 * `when:{param,is}`. At BUILD time pruneGuards (blocks/whenGuard.js) DROPS the guard when its `when` is false and
 * UNWRAPS it (splices its children in place) when true — so a DATA template carries every fork arm, each guarded, and
 * collapses to the chosen shape for the op's params. This is what makes a structural toggle re-authorable pure data
 * (② B4 M2) instead of JS-locked structure.
 *
 * A guard normally NEVER reaches emit (prune removes it first); the transparent emit below is a safety net (a stray
 * surviving guard emits its children, never an `( unknown block )`).
 */
export const guardBlock = {
    type: 'guard',
    label: 'Guard (when)',
    category: 'Control',
    kind: 'guard',
    defaults: { when: null },   // { param, is } — set by the seed/author
    fields: [],
    emit: (params, children) => children || [],
};
