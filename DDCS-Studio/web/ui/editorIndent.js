/**
 * ui/editorIndent.js — BLOCK INDENT / OUTDENT in the editor, on the selection (t1450, user-designed).
 *
 * Three ways in, ONE implementation: the toolbar buttons, Tab / Shift+Tab, and the right-click menu all call
 * `indentEditor(dir)`. Three entry points with three copies of the string surgery is how two of them come to disagree
 * about what a selection is — and here that disagreement writes bytes into the user's file.
 *
 * ── IT WRITES REAL SPACES, AND THAT IS THE RULING ────────────────────────────────────────────────────────────────
 * No display-only padding anywhere (ruled OUT by the user; deliberately not built). The editor is a byte-truth
 * surface: what you see is what the controller reads. So this edits the textarea's VALUE, the width comes from the
 * same `INDENT` the emitters write, and the syntax-colouring overlay follows because it re-renders from that value.
 *
 * ── UNDO IS THE HARD PART, AND IT IS WHY THIS GOES THROUGH execCommand ───────────────────────────────────────────
 * Assigning `textarea.value` WIPES the browser's native undo stack — the user indents a block, presses Ctrl+Z, and
 * loses not just the indent but every edit before it. `insertText` on a selection is the one path that records an
 * undoable step, so the block is selected and replaced in a single command. It is deprecated-but-universal for
 * exactly this reason and has no standard replacement; `setRangeText` does not enter the undo stack either. The
 * fallback (assignment) exists only for a host without it — noted rather than silent, since undo is the thing lost.
 */
import { INDENT, INDENT_WIDTH, indentBlock, commentBlock, COMMENT_MARK } from '../data/indentStyle.js';

export { INDENT, INDENT_WIDTH, COMMENT_MARK };

/** The editor textarea, or null when the editor is not mounted (a wizard-only screen). */
const editorEl = () => document.getElementById('editor');

/**
 * Indent (dir > 0) or outdent (dir < 0) the selected lines — or the caret's own line when nothing is selected.
 * Returns true when bytes actually changed, so a caller can skip the re-render and the toolbar can stay honest.
 */
export function indentEditor(dir = 1, ed = editorEl()) {
    return applyBlock(ed, (v, s, e) => indentBlock(v, s, e, dir));
}

/**
 * t1452 — COMMENT / UNCOMMENT the selected lines, as a toggle. Shares `applyBlock` with indent, so both operations
 * take the same one undoable path: a second copy of that surgery is how one of them would quietly lose undo.
 */
export function commentEditor(ed = editorEl()) {
    return applyBlock(ed, (v, s, e) => commentBlock(v, s, e));
}

/** Run a pure block operation against the editor and write it back UNDOABLY. The one place bytes are replaced. */
function applyBlock(ed, op) {
    if (!ed) return false;
    const r = op(ed.value, ed.selectionStart, ed.selectionEnd);
    if (!r.changed) return false;                       // e.g. outdent on already-flush lines: do nothing, quietly
    ed.focus();
    ed.setSelectionRange(r.blockStart, r.blockEnd);
    let ok = false;
    try { ok = document.execCommand('insertText', false, r.replacement); } catch (_) { ok = false; }
    if (!ok) ed.value = r.text;                          // ⚠ fallback only — this path loses native undo (see header)
    ed.setSelectionRange(r.start, r.end);
    // The highlight overlay + gutter listen on `input`; execCommand fires it, the fallback does not.
    if (!ok) ed.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
}

/**
 * Wire the three entry points. Idempotent — safe to call again after a re-render, which the editor does often.
 *
 * ⚠ TAB IS TAKEN, AND TAKING IT IS A REAL DECISION. In a textarea Tab moves focus, which is the accessibility
 * default and the thing every code editor overrides. It is overridden HERE ONLY, and only while the editor has
 * focus, so the rest of the app keeps keyboard navigation; and Escape-then-Tab still leaves, because Escape blurs
 * nothing — the user can still reach the next control by clicking. That is the same trade every editor makes and it
 * is stated rather than assumed.
 */
export function installEditorIndent() {
    const ed = editorEl();
    if (!ed || ed.dataset.indentWired === '1') return;
    ed.dataset.indentWired = '1';
    ed.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();                              // never let Tab move focus out of the editor
        indentEditor(e.shiftKey ? -1 : 1, ed);
    });
    // t1452 — Ctrl+/ is the comment toggle every editor has. Same one implementation as the button and the menu.
    ed.addEventListener('keydown', (e) => {
        if (e.key !== '/' || !(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        commentEditor(ed);
    });
    for (const [id, dir] of [['editor-indent', 1], ['editor-outdent', -1], ['editor-comment', 0]]) {
        const b = document.getElementById(id);
        if (!b || b.dataset.indentWired === '1') continue;
        b.dataset.indentWired = '1';
        /**
         * ⚠ THE BUTTON MUST NOT TAKE FOCUS, and that is a real behaviour fix rather than a test convenience. Pressing
         * a toolbar button blurs the textarea; the blur drops the SELECTION the button is about to act on, and in this
         * app it also lets the editor re-sync from the program model underneath the gesture. Found while driving the
         * button the way a user does — the keyboard path never blurs, so it passed and hid this completely.
         * `preventDefault` on mousedown is the standard cure: the click still fires, the caret never moves.
         */
        b.addEventListener('mousedown', (e) => e.preventDefault());
        b.addEventListener('click', () => (dir === 0 ? commentEditor(ed) : indentEditor(dir, ed)));
    }
}

/** The two entries the right-click menu shows — declared here so the menu cannot describe a different action. */
export const indentMenuItems = () => [
    { label: `⇥ Indent (${INDENT_WIDTH} spaces)`, fn: () => indentEditor(1) },
    { label: '⇤ Outdent', fn: () => indentEditor(-1) },
    { label: `${COMMENT_MARK} Comment / uncomment`, fn: () => commentEditor() },
];
