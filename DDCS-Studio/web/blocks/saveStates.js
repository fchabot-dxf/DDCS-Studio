/**
 * blocks/saveStates.js — program-level undo/redo history (save states).
 *
 * A save state = a snapshot of the program block stack. Snapshots are taken at COARSE points (each wizard Insert)
 * and at GRANULAR points (each block edit) — NOT on form edits, because those are preview-only until Insert (the
 * program/op commits only in WizardManager.insert; closing the wizard discards them). Undo/Redo walk the history
 * and reload the program. An `applying` guard (plus the Blocks app's own muteChanges) stops an undo/redo reload
 * from being recorded as a new state, so there's no feedback loop.
 */

import { onChange as onProgramChange } from './programModel.js';

const MAX = 100;
let history = [];      // [{ stack, label }] oldest → newest
let ptr = -1;          // index of the current state
let applying = false;  // true while we reload a state (so the resulting change isn't re-recorded)
const subs = new Set();

const getProg = () => { try { return (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || []; } catch (_) { return []; } };
const clone = (s) => { try { return JSON.parse(JSON.stringify(s || [])); } catch (_) { return []; } };
const sig = (s) => { try { return JSON.stringify(s || []); } catch (_) { return ''; } };
const notify = () => subs.forEach((cb) => { try { cb(); } catch (_) { /* noop */ } });

/** Record the current program as a new save state. Called on Insert + on a block edit. No-op during undo/redo. */
export function snapshot(label = '') {
    if (applying) return;                                            // don't record our own undo/redo reloads
    const snap = clone(getProg());
    if (ptr >= 0 && sig(history[ptr].stack) === sig(snap)) return;   // identical to current → no real change
    history = history.slice(0, ptr + 1);                             // drop any redo tail
    history.push({ stack: snap, label });
    if (history.length > MAX) history.shift();
    ptr = history.length - 1;
    notify();
}

function apply(state) {
    applying = true;
    try { if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(clone(state.stack)); }
    finally { applying = false; }
    notify();
}

export const canUndo = () => ptr > 0;
export const canRedo = () => ptr < history.length - 1;
export function undo() { if (canUndo()) { ptr -= 1; apply(history[ptr]); } }
export function redo() { if (canRedo()) { ptr += 1; apply(history[ptr]); } }
export const undoLabel = () => (canUndo() ? history[ptr].label : '');
export const redoLabel = () => (canRedo() ? history[ptr + 1].label : '');

/** Subscribe to history changes (button enable/disable). Returns an unsubscribe fn. */
export function onChange(cb) { subs.add(cb); return () => subs.delete(cb); }

/**
 * S4-1 — the SHARED destructive-load guard. Loading a stack into the Blocks tab REPLACES the current program
 * (`ddcsLoadBlockStack`). When the program is NON-EMPTY and the incoming stack would actually change it, CONFIRM
 * before it is replaced — so the user never loses visible work silently. An empty program, or a load of the identical
 * stack, proceeds with NO prompt. Returns true if the caller should load, false on Cancel — the caller does its own
 * showApp / ddcsLoadBlockStack after a true, so a Cancel leaves the caller's surface untouched.
 *
 * The CANCEL is the guaranteed protection, and the message promises THAT (not Undo). We STILL snapshot the current
 * program first (the advisor's ask, a best-effort recovery point) — BUT t1145 MEASURED that the program-level Undo
 * does NOT reliably restore a programmatically-loaded prior program (the real header Undo button, clicked repeatedly,
 * never reverts past a `ddcsLoadBlockStack` — app-wide, not just this path), so the message deliberately does NOT
 * claim "saved to Undo". (`what` names the thing being opened; `label` is the snapshot entry.) Async — dlgConfirm is
 * lazy-imported to keep this history module free of any top-level UI coupling.
 */
export async function confirmDestructiveLoad(incoming, opts = {}) {
    const cur = getProg();
    const willReplace = Array.isArray(cur) && cur.length > 0 && sig(cur) !== sig(incoming);
    if (!willReplace) return true;                       // empty program or an identical load → nothing to lose → silent
    snapshot(opts.label || 'before edit');               // best-effort recovery point (see the note above re: Undo)
    const { dlgConfirm } = await import('../ui/dialog.js');
    return dlgConfirm(
        `Opening ${opts.what || 'this'} in Blocks replaces the program currently in the editor. Cancel to keep your current program.`,
        { title: 'Open in Blocks?', okLabel: 'Open (replace)', cancelLabel: 'Cancel' }
    );
}

// Origin → friendly history label (programModel tags each setStack with its origin).
const LABELS = { load: 'insert', blockly: 'block edit', editor: 'edit', refresh: '' };

/** Subscribe to the program model + seed a baseline. Called once at app start (after initProgramModel). Every real
 *  program change becomes a save state — op insert ('load'), block edit ('blockly'), editor edit ('editor'). Form
 *  edits never reach here (preview-only until Insert); 'refresh' (post-proc recompute) and our own undo/redo
 *  reloads (the `applying` guard) are skipped, so there's no loop. */
let _wired = false;
export function initSaveStates() {
    if (_wired) return; _wired = true;
    onProgramChange(({ origin }) => { if (origin !== 'refresh') snapshot(LABELS[origin] || origin); });
    snapshot('open');   // baseline so the first edit has somewhere to undo back to
    // Keep the header Undo/Redo buttons' enabled state in sync with the history. Re-find them each tick (the
    // header may render before or after this runs), so it's robust to ordering. onChange fires on every snapshot
    // + undo/redo; sync() runs once now for the initial state.
    const sync = () => { const ub = document.getElementById('btn-undo'), rb = document.getElementById('btn-redo'); if (ub) ub.disabled = !canUndo(); if (rb) rb.disabled = !canRedo(); };
    onChange(sync); sync();
}

// Undo/Redo for the toolbar buttons (saveStates owns the history; snapshots arrive via the onChange subscription).
if (typeof window !== 'undefined') {
    window.ddcsUndo = undo;
    window.ddcsRedo = redo;
}
