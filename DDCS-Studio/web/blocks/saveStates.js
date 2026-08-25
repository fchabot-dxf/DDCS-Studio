/**
 * blocks/saveStates.js — program-level undo/redo history (save states).
 *
 * t2287 — DUAL FORMAT, decided per-snapshot by an observable fact (does a Blockly workspace exist yet), never a
 * global mode: before the Blocks tab has EVER been opened, a save state is the app's own semantic
 * `{type,params,children}` record — exactly as before this turn, and correct as-is: there is no canvas, so
 * there is no viewport to preserve either, and "gesture, not delta" has no gesture to record (editor edits and
 * wizard inserts are already one call per meaningful change, via onProgramChange below). Once a workspace
 * exists (blocksApp.js registers one, once, the first time it's built — see registerBlocklyBridge), a save
 * state is Blockly's OWN native serialization (block positions included) plus scroll/scale, taken at GESTURE
 * boundaries (blocksApp.js's own listener calls recordGesture — see its own doc for why a drag's own
 * `isStart:false` event is the reliable close signal, with a short debounce for non-drag gestures that never
 * fire one). A session's history can hold BOTH kinds — the workspace, once created, persists for the rest of
 * the session (confirmed live, t2287: the SAME instance survives a tab round-trip), so this is a ONE-TIME
 * boundary, never interleaved back and forth. `apply()` dispatches on each ENTRY's own kind, not on whatever
 * currently exists — undoing back past the boundary restores a pre-Blocks semantic entry even with a live
 * workspace mounted (the canvas re-lays-out, since position was never captured for that old entry — expected,
 * unavoidable, and handled without touching the live workspace's own existence either way).
 *
 * Snapshots are taken at COARSE points (each wizard Insert), at GRANULAR points (each editor edit / reconciled
 * block change), AND — new this turn — at every recorded GESTURE once a workspace exists. NOT on form edits,
 * because those are preview-only until Insert (the program/op commits only in WizardManager.insert; closing the
 * wizard discards them — unaffected by this turn, verified below). Undo/Redo walk the history and reload the
 * program. An `applying` guard (plus the Blocks app's own muteChanges) stops an undo/redo reload from being
 * recorded as a new state, so there's no feedback loop.
 */

import { onChange as onProgramChange } from './programModel.js';
import { isWorkspaceDirtyToFile } from '../data/backup.js';   // t2184 (amendment 23) — wouldLoseWork()'s workspace-scope half

const MAX = 100;
let history = [];      // [{ kind: 'semantic'|'blockly', ...payload, label }] oldest → newest
let ptr = -1;          // index of the current state
let applying = false;  // true while we reload a state (so the resulting change isn't re-recorded)
const subs = new Set();

const getProg = () => { try { return (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || []; } catch (_) { return []; } };
const clone = (s) => { try { return JSON.parse(JSON.stringify(s || [])); } catch (_) { return []; } };
const sig = (s) => { try { return JSON.stringify(s || []); } catch (_) { return ''; } };
const notify = () => subs.forEach((cb) => { try { cb(); } catch (_) { /* noop */ } });

/** t2287 — the ONE seam into Blockly this otherwise-pure-state module has, kept minimal and injected rather
 *  than imported: blocksApp.js calls this ONCE, the moment its workspace is built (never before — the module
 *  stays free of any Blockly import either way, matching its existing "pure state" design). `hasWorkspace()`
 *  is the single observable fact that decides which format a NEW snapshot takes; `capture()`/`restore(state)`
 *  do the actual Blockly-native save/load + re-derive the semantic layer via blocksApp's own reproject path,
 *  so this module never needs to know HOW that happens, only that it does. */
let blocklyBridge = null;
export function registerBlocklyBridge(bridge) { blocklyBridge = bridge; }
const hasWorkspace = () => !!(blocklyBridge && blocklyBridge.hasWorkspace());

function pushEntry(entry) {
    history = history.slice(0, ptr + 1);                             // drop any redo tail
    history.push(entry);
    if (history.length > MAX) history.shift();
    ptr = history.length - 1;
    notify();
}

/** Record a new save state. Called on Insert + on a reconciled editor/block edit (via onProgramChange below),
 *  and directly by confirmDestructiveLoad's own "before edit" recovery point. No-op during undo/redo. Format
 *  is decided HERE, by `hasWorkspace()` — every caller stays unaware which one it gets. */
export function snapshot(label = '') {
    if (applying) return;                                            // don't record our own undo/redo reloads
    if (hasWorkspace()) {
        const payload = blocklyBridge.capture();                      // { blocks, scrollX, scrollY, scale }
        if (!payload) return;                                         // bridge declined (e.g. workspace mid-teardown) — nothing safe to record
        pushEntry({ kind: 'blockly', ...payload, label });             // no sig-based dedup here — every recorded gesture counts, deliberately (t2287 human ruling)
        return;
    }
    const snap = clone(getProg());
    if (ptr >= 0 && history[ptr].kind === 'semantic' && sig(history[ptr].stack) === sig(snap)) return;   // identical to current → no real change
    pushEntry({ kind: 'semantic', stack: snap, label });
}

/** t2287 — the gesture-boundary entry point, called ONLY from blocksApp.js's own listener (never from
 *  onProgramChange — see its own updated comment for why 'blockly'-origin changes are skipped there now).
 *  Thin wrapper so the call site reads as what it is; behaves identically to snapshot() once a workspace
 *  exists (which it always does when this is called at all — blocksApp.js is the only caller). */
export function snapshotGesture(label = '') { snapshot(label); }

function apply(state) {
    applying = true;
    try {
        if (state.kind === 'blockly') {
            if (hasWorkspace()) blocklyBridge.restore(state);
            // else: a blockly-native entry with no live workspace should be unreachable (the workspace persists
            // for the rest of the session once built — confirmed live, t2287) — but fail SILENTLY rather than
            // throw if it ever happens, matching this module's existing defensive style throughout.
        } else if (window.ddcsLoadBlockStack) {
            window.ddcsLoadBlockStack(clone(state.stack));             // exactly today's path — safe even with a live workspace mounted (already the normal load-while-Blocks-open case)
        }
    } finally { applying = false; }
    notify();
}

// t2287 — Undo/Redo flush any gesture the Blockly bridge is still debouncing BEFORE reading the history: a
// gesture inside its own quiet window has no entry yet, so pressing Undo right after finishing an edit (an
// entirely normal fast sequence) would otherwise skip that edit's own state (found live,
// undo-reproject-echo.spec.js). A no-op when there's nothing pending, or no workspace at all.
const flushPendingGesture = () => { try { if (blocklyBridge && blocklyBridge.flushGesture) blocklyBridge.flushGesture(); } catch (_) { /* best-effort */ } };
export const canUndo = () => ptr > 0;
export const canRedo = () => ptr < history.length - 1;
export function undo() { flushPendingGesture(); if (canUndo()) { ptr -= 1; apply(history[ptr]); } }
export function redo() { flushPendingGesture(); if (canRedo()) { ptr += 1; apply(history[ptr]); } }
export const undoLabel = () => (canUndo() ? history[ptr].label : '');
export const redoLabel = () => (canRedo() ? history[ptr + 1].label : '');

/** Subscribe to history changes (button enable/disable). Returns an unsubscribe fn. */
export function onChange(cb) { subs.add(cb); return () => subs.delete(cb); }

/**
 * t2184 (amendments 21-23) — "am I really going to lose something?" (the human's own question, verbatim — put
 * here because it is the reason this predicate exists, not decoration). This RETIRES "will this replace
 * content" as the guard's own question: a confirm firing on an empty canvas isn't friction, it's the app
 * telling someone they may have made a mistake when they haven't — "it makes me wonder what did i do wrong"
 * (the human, on hitting this while opening something over nothing). A name like willReplaceContent() invites
 * exactly that widening back, because replacing content SOUNDS dangerous and the name agrees; this one can't be
 * widened without the widener noticing they're lying about what it answers.
 *
 * PROGRAM scope (default): is there a real, non-empty program in the editor right now? Loading ANYTHING over an
 * empty canvas has nothing to lose — the emptiness itself is the whole answer, before any incoming-stack
 * comparison. `confirmDestructiveLoad` below layers ONE further refinement on top for its own callers (loading
 * the IDENTICAL stack back over itself is also nothing lost), but that refinement needs the incoming stack,
 * which this predicate deliberately doesn't take — it answers the simpler, shared question every door asks
 * first.
 *
 * WORKSPACE scope (`workspace: true`): Workspace Open additionally replaces settings/wizards/CAM/etc via a full
 * page reload (ui/workspaceManager.js), which would ALSO wipe an unsaved program even if the workspace's own
 * dirty-to-file signal were clean — so it asks BOTH halves. Reuses `isWorkspaceDirtyToFile()` (data/backup.js)
 * as-is rather than inventing a second dirty-flag (the human's own instruction) — its own accuracy (it can read
 * dirty on an untouched device-only change like a theme switch, a separate, deeper bug traced but not fixed
 * this turn — see WORK-LOG) is a property of THAT signal, not of this predicate composing it honestly.
 */
export function wouldLoseWork({ workspace = false } = {}) {
    const cur = getProg();
    if (Array.isArray(cur) && cur.length > 0) return true;
    if (workspace) { try { if (isWorkspaceDirtyToFile()) return true; } catch (_) { /* matches isWorkspaceDirtyToFile's own read-error default: not dirty */ } }
    return false;
}

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
    // t2184 — wouldLoseWork() answers the shared, simpler half ("is there anything here at all"); the
    // signature comparison is this caller's own refinement (loading the IDENTICAL stack back is also nothing
    // lost), which needs the incoming stack wouldLoseWork() deliberately doesn't take.
    const willReplace = wouldLoseWork() && sig(cur) !== sig(incoming);
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
 *  program change becomes a save state — op insert ('load'), editor edit ('editor'). Form edits never reach here
 *  (preview-only until Insert); 'refresh' (post-proc recompute) and our own undo/redo reloads (the `applying`
 *  guard) are skipped, so there's no loop.
 *  t2287 — 'blockly'-origin ALSO skipped here now: it fires once per qualifying Blockly event (potentially many
 *  times per gesture), which used to collapse to ~one entry only because position-only intra-gesture changes
 *  happened to produce a byte-identical semantic stack. That coincidence is gone once gestures are recorded
 *  deliberately — snapshotting 'blockly' here too would create one entry per EVENT, not per gesture. Ownership
 *  moves entirely to blocksApp.js's own gesture-boundary listener (snapshotGesture), which is a strict superset:
 *  anything that used to reach here via 'blockly' fires a real, non-UI Blockly event, which the gesture listener
 *  already watches — nothing is lost, gestures are just grouped correctly instead of one-entry-per-sub-event. */
let _wired = false;
export function initSaveStates() {
    if (_wired) return; _wired = true;
    // t2287 — deferred to a microtask: onProgramChange fires DURING setStack, synchronously, before every
    // subscriber has run — including blocksApp's own renderFromModel, which does the actual workspace rebuild
    // (stackToWorkspace) synchronously inside ITS subscriber callback. Capturing here undeferred can run BEFORE
    // that rebuild (subscriber order is registration order, and this module's onProgramChange is wired at app
    // boot, earlier than blocksApp's), snapshotting the STALE pre-rebuild workspace instead of the one matching
    // the new stack. A microtask always runs after the current synchronous turn (setStack's whole subs.forEach)
    // finishes, so by the time capture() runs, any live workspace already reflects the new model — regardless of
    // subscriber order. (Found live: a scripted load-then-drag undid to an EMPTY workspace, not the loaded one.)
    onProgramChange(({ origin }) => { if (origin !== 'refresh' && origin !== 'reproject' && origin !== 'blockly') queueMicrotask(() => snapshot(LABELS[origin] || origin)); });   // t1161 — 'reproject' = the post-render echo (blocksApp) that re-syncs ids/defaults, NOT a user edit → no Undo state
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
