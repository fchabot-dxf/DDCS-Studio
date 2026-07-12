/**
 * engine/simUserVars.js — the SIM's PERSISTENT uservar store (t764). Models the real controller's non-volatile
 * `uservar` file (#100-#549, t758): the sim reuses ONE Map across Plays, so a serial counter bumped by a {SN} program
 * survives run→run — two consecutive Plays engrave DIFFERENT serials, the user-visible proof the dynamic serial works.
 * Only user vars persist here; controller PARAMS (probe/ATC config, DRO regs) are re-seeded fresh into it each run.
 */
const _store = new Map();

/** The shared persistent Map — the preview panel's createVarStore returns this (re-seeding the config vars each run). */
export function simUserVarStore() { return _store; }

/** Set a persistent user var (the {SN} "Initialize counter" action seeds the start value here for the sim). */
export function setSimUserVar(n, value) { _store.set(Number(n), Number(value)); }

/** Read a persistent user var (unset → undefined). */
export function getSimUserVar(n) { return _store.get(Number(n)); }

/** Clear the store (tests + a fresh session). */
export function resetSimUserVars() { _store.clear(); }
