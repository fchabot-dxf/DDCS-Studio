/**
 * blocks/opRecord.js — the last STUDIO op that generated code, for "open as blocks".
 *
 * A wizard calls recordOp(type, params) every time it generates; the Blocks tab reads it on open and renders
 * that op AS its block stack with the real param values. Deliberately IMPORT-FREE so any wizard can record
 * without creating an import cycle (wizards → opRecord; the Blocks side → opRecord + the wizards).
 */
let lastOp = null;

/** Snapshot the op that just generated (params are copied so later form edits don't mutate the snapshot). */
export function recordOp(type, params) { lastOp = { type, params: { ...params } }; }

/** The most recent op, or null. */
export function getLastOp() { return lastOp; }
