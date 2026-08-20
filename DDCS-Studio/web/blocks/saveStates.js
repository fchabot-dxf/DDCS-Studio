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
 * S4-1 — the SHARED destructive-load guard, the ONE seam every door that replaces the program routes through
 * (t1938 — commandDeck.js's .nc import, programFile.js's loadProject, editorManager.js's Clear; t1942 —
 * wizardManager.js's own Insert, now 3-way). Loading a stack REPLACES the current program
 * (`ddcsLoadBlockStack`). When the program is NON-EMPTY and the incoming stack would actually change it,
 * CONFIRM before it is replaced — so the user never loses visible work silently. An empty program, or a load of
 * the identical stack, proceeds with NO prompt. Returns true if the caller should load, false on Cancel — the
 * caller does its own showApp / ddcsLoadBlockStack after a true, so a Cancel leaves the caller's surface
 * untouched.
 *
 * The current program is SNAPSHOTTED into the save-state history first, and the message promises Undo. (t1145 found the
 * program-level Undo could NOT restore a programmatically-loaded prior program; t1161 FIXED that at the source — the
 * reproject echo no longer pollutes the history — so a proceed IS recoverable via Undo now.) Cancel remains the instant
 * protection. Async — dlgConfirm/dlgChoice are lazy-imported to keep this history module free of any top-level UI
 * coupling.
 *
 * `opts`: `what` names the thing being opened (the default message's own noun); `label` is the snapshot entry.
 * `message`/`title`/`okLabel`/`cancelLabel` OVERRIDE the default Blocks-tab-worded dialog — t1938: the seam is
 * shared, the WORDING is a parameter of it, not hard-coded to one caller's own context. A caller passing none of
 * these gets byte-identical behaviour to before this turn (devMode.js's two existing callers, unchanged).
 *
 * t1942 — `opts.choices` (an array, `dlgChoice`'s own shape) switches this to N-WAY mode: shows `dlgChoice`
 * instead of `dlgConfirm` and resolves the CHOSEN KEY (a string), not a boolean — but the SILENT-PASS condition
 * and the Undo snapshot above are UNCHANGED, exercised exactly once, here, regardless of 2-way or N-way mode.
 * `opts.silentKey` names which key the silent (nothing-to-lose) path should resolve to, since an N-way caller
 * needs a KEY to act on even when no dialog appears — defaults to `true` (meaningless to an N-way caller, so
 * pass it explicitly for choices mode; the wizard-bar Insert door passes `'replace'`, since replacing an EMPTY
 * program is identical to adding to one — `addOperation([], op)` and a plain replace produce the same result).
 */
export async function confirmDestructiveLoad(incoming, opts = {}) {
    const cur = getProg();
    const willReplace = Array.isArray(cur) && cur.length > 0 && sig(cur) !== sig(incoming);
    if (!willReplace) return opts.choices ? (opts.silentKey != null ? opts.silentKey : true) : true;   // nothing to lose → silent
    snapshot(opts.label || 'before edit');               // the recovery point → the message promises Undo (t1161 made it work)
    if (opts.choices) {
        const { dlgChoice } = await import('../ui/dialog.js');
        return dlgChoice(
            opts.message || `Opening ${opts.what || 'this'} in Blocks replaces the program in the editor — it's saved to Undo, or Cancel to keep it.`,
            opts.choices,
            { title: opts.title || 'Open in Blocks?' }
        );
    }
    const { dlgConfirm } = await import('../ui/dialog.js');
    return dlgConfirm(
        opts.message || `Opening ${opts.what || 'this'} in Blocks replaces the program in the editor — it's saved to Undo, or Cancel to keep it.`,
        { title: opts.title || 'Open in Blocks?', okLabel: opts.okLabel || 'Open (replace)', cancelLabel: opts.cancelLabel || 'Cancel' }
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
    onProgramChange(({ origin }) => { if (origin !== 'refresh' && origin !== 'reproject') snapshot(LABELS[origin] || origin); });   // t1161 — 'reproject' = the post-render echo (blocksApp) that re-syncs ids/defaults, NOT a user edit → no Undo state
    snapshot('open');   // baseline so the first edit has somewhere to undo back to
    // Keep the header Undo/Redo buttons' enabled state in sync with the history. Re-find them each tick (the
    // header may render before or after this runs), so it's robust to ordering. onChange fires on every snapshot
    // + undo/redo; sync() runs once now for the initial state.
    const sync = () => { const ub = document.getElementById('btn-undo'), rb = document.getElementById('btn-redo'); if (ub) ub.disabled = !canUndo(); if (rb) rb.disabled = !canRedo(); };
    onChange(sync); sync();
    installUndoKeys();
}

/**
 * t2077 — PROGRAM UNDO/REDO ON THE KEYBOARD. Until now the two header buttons were the ONLY door to this history;
 * when they moved into the editor pane the shortcut they never had became a requirement, not a nicety.
 *
 * ⛔ IT MUST NOT FIRE WHILE THE USER IS TYPING, and that is the whole subtlety. Ctrl+Z inside a text field means
 * the FIELD's native character-level undo — a different, expected behaviour that a machinist mid-word would be
 * furious to lose. This history is the BLOCK/PROGRAM one. So the binding bails whenever focus is in a textarea,
 * input, select or anything contenteditable, leaving native undo untouched there; the editor's own buttons remain
 * the door while typing.
 *
 * Ctrl+Shift+Z AND Ctrl+Y both redo — the modern convention and the older Windows one; apps that pick only one
 * are wrong for half their users. ⌘ counts as Ctrl so a Mac build behaves.
 */
function installUndoKeys() {
    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        const t = e.target;
        const tag = t && t.tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || (t && t.isContentEditable)) return;   // native undo owns it here
        const k = (e.key || '').toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
    });
}

// Undo/Redo for the toolbar buttons (saveStates owns the history; snapshots arrive via the onChange subscription).
if (typeof window !== 'undefined') {
    window.ddcsUndo = undo;
    window.ddcsRedo = redo;
}
