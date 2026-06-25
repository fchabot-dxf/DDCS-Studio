/**
 * blocks/opStacks.js — DEPRECATED back-compat barrel.
 *
 * The old mediator split into focused modules; this barrel re-exports the same public surface so existing
 * importers keep working unchanged. New code should import from the real module:
 *   - opBuilders.js   — BUILDERS (the wizard stack-builder registry)
 *   - opSession.js    — the wizard session + program mutations + reverse-sync
 *   - opGlow.js       — the form-vs-blocks diff (glow / chip / Merge-gate)
 *   - programModel.js — the marker codec (opFromMarker / importMarkedNc)
 *
 * Slated for deletion once every importer points at the real module.
 */
export { BUILDERS } from './opBuilders.js';
export {
    hasActiveOpStack, unportedActiveOp, buildActiveOpStack, previewActiveOp,
    commitActiveOp, replaceOp, deleteOp, duplicateOp, commitDecodedCode,
    reconcileActiveOp, mergeOpBlocks,
} from './opSession.js';
export { isOpBlockEdited, editedLinesForOp, editedRangesForOp } from './opGlow.js';
export { opFromMarker, importMarkedNc } from './programModel.js';
