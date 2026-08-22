/**
 * ui/editorTextOps.js — the editor's COMMENT / UNCOMMENT operation on a selection (t1452). Writes REAL bytes.
 *
 * t2139 — this file used to also hold indent/outdent (t1450); retired entirely (human ruling — "no indentation
 * ever", BACKLOG.md "NO INDENTATION, EVER"). Comment/uncomment survives and absorbs the two pieces
 * `data/indentStyle.js` (now deleted) held alongside it by filing accident — `COMMENT_MARK` and the
 * whole-line block-selection helper — so this file is the ONE remaining home for the editor's text ops.
 *
 * t2147 — TWO DOORS IN, ONE IMPLEMENTATION: Ctrl+/ and the right-click context menu both drive this file's ONE
 * `commentEditor()` — never a second copy of the toggle logic per door. (The dedicated toolbar BUTTON was a
 * third door once; t2099/da280131 retired it deliberately, "Ctrl+/ and the right-click menu keep it" — a
 * documented decision, not a regression, so the count here is TWO, current, not the three it once was. Its own
 * `#editor-comment` lookup below still runs — the element it looks for is gone from index.html, so it is
 * inert, not wired to anything; named here rather than silently left to look load-bearing.)
 *
 * ── IT WRITES REAL BYTES, AND THAT IS THE RULING ─────────────────────────────────────────────────────────────────
 * No display-only padding anywhere (ruled OUT by the user; deliberately not built). The editor is a byte-truth
 * surface: what you see is what the controller reads. So this edits the textarea's VALUE directly, and the
 * syntax-colouring overlay follows because it re-renders from that value.
 *
 * ── UNDO IS THE HARD PART, AND IT IS WHY THIS GOES THROUGH execCommand ───────────────────────────────────────────
 * Assigning `textarea.value` WIPES the browser's native undo stack — the user comments a block, presses Ctrl+Z, and
 * loses not just the comment but every edit before it. `insertText` on a selection is the one path that records an
 * undoable step, so the block is selected and replaced in a single command. It is deprecated-but-universal for
 * exactly this reason and has no standard replacement; `setRangeText` does not enter the undo stack either. The
 * fallback (assignment) exists only for a host without it — noted rather than silent, since undo is the thing lost.
 */

/**
 * ── t1452 — THE COMMENT MARK, AND WHY IT IS `;` AND NOT `( … )` ──────────────────────────────────────────────────
 *
 * G-code's usual comment is a parenthesis pair, and on THIS controller it cannot be used to comment out an arbitrary
 * line: **DDCS refuses a nested `( … ( … ) )`** with "Unrecognized characters" (the export path already strips parens
 * for exactly this reason). Wrapping a line that already carries a comment — which is most emitted lines, since every
 * parametric body annotates itself — would produce a line the machine rejects. Nesting is not a rare case here; it is
 * the common one.
 *
 * SO THE MARK IS A LEADING SEMICOLON, and that is EVIDENCE rather than preference: **189 lines in the captured
 * factory corpus begin with `;`**. It is demonstrated on the controller, it needs no closing token, and it cannot
 * nest — so commenting is total (any line, whatever it contains) and uncommenting is exact.
 *
 * THE MARK GOES AT THE LINE'S OWN LEADING WHITESPACE, not always at column 0: a commented line keeps its place, so
 * commenting a loop body and uncommenting it round-trips to the identical bytes. That is asserted, not assumed.
 */
export const COMMENT_MARK = ';';

/** Is every non-blank line in this block already commented? (Blank lines do not vote — else one empty line in a
 *  selection would flip the whole block's meaning, and a user cannot see why.) */
const allCommented = (lines) => {
    const real = lines.filter((l) => l.trim() !== '');
    return real.length > 0 && real.every((l) => l.trimStart().startsWith(COMMENT_MARK));
};

/** The whole-line block a selection covers — the SAME rule `indentBlock` used to share this with, kept here now
 *  it is the only consumer: a caret with no selection acts on its own line; a selection is expanded to whole lines. */
function blockOf(text, selStart, selEnd) {
    const src = String(text == null ? '' : text);
    const a = Math.max(0, Math.min(src.length, selStart | 0));
    const b = Math.max(a, Math.min(src.length, selEnd | 0));
    const from = src.lastIndexOf('\n', a - 1) + 1;
    let to = src.indexOf('\n', b);
    if (to === -1) to = src.length;
    const end = (b > a && b === from) ? b : to;
    return { blockStart: from, blockEnd: end, block: src.slice(from, end), a, b };
}

/** The editor textarea, or null when the editor is not mounted (a wizard-only screen). */
const editorEl = () => document.getElementById('editor');

/**
 * Comment / uncomment the selected lines — a TOGGLE, like every editor: comment unless the block is already fully
 * commented, in which case uncomment. BLANK LINES ARE LEFT ALONE (a `;` on an empty line is noise the user then
 * has to clean up by hand).
 */
export function commentBlock(text, selStart, selEnd) {
    const B = blockOf(text, selStart, selEnd);
    const lines = B.block.split('\n');
    const off = allCommented(lines);
    const out = lines.map((ln) => {
        if (ln.trim() === '') return ln;
        const lead = (ln.match(/^[ \t]*/) || [''])[0];
        if (!off) return lead + COMMENT_MARK + ln.slice(lead.length);
        const rest = ln.slice(lead.length);
        return rest.startsWith(COMMENT_MARK) ? lead + rest.slice(COMMENT_MARK.length) : ln;
    });
    const replacement = out.join('\n');
    return { ...B, replacement, commented: !off, changed: replacement !== B.block,
        text: text.slice(0, B.blockStart) + replacement + text.slice(B.blockEnd),
        start: B.blockStart, end: B.blockStart + replacement.length };
}

/**
 * t1452 — COMMENT / UNCOMMENT the selected lines. The one place bytes are replaced (`applyBlock`), so there is
 * exactly one undoable path.
 */
export function commentEditor(ed = editorEl()) {
    return applyBlock(ed, (v, s, e) => commentBlock(v, s, e));
}

/** Run a pure block operation against the editor and write it back UNDOABLY. */
function applyBlock(ed, op) {
    if (!ed) return false;
    const r = op(ed.value, ed.selectionStart, ed.selectionEnd);
    if (!r.changed) return false;                       // e.g. nothing selected and the line is blank: do nothing, quietly
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
 * Wire the comment toggle's entry points. Idempotent — safe to call again after a re-render, which the editor
 * does often. t2147 — the `#editor-comment` lookup below is VESTIGIAL: that button left index.html at
 * t2099/da280131 ("Ctrl+/ and the right-click menu keep it"), so `b` is always null now and its wiring never
 * runs. Left in place (harmless, not load-bearing) rather than deleted here — a small doc fix, not a code
 * removal; flagged for whoever next touches this file.
 */
export function installEditorTextOps() {
    const ed = editorEl();
    if (!ed || ed.dataset.textOpsWired === '1') return;
    ed.dataset.textOpsWired = '1';
    // t1452/t2147 — Ctrl+/ is the comment toggle every editor has. Same one implementation as the menu.
    ed.addEventListener('keydown', (e) => {
        if (e.key !== '/' || !(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        commentEditor(ed);
    });
    const b = document.getElementById('editor-comment');
    if (b && b.dataset.textOpsWired !== '1') {
        b.dataset.textOpsWired = '1';
        /**
         * ⚠ THE BUTTON MUST NOT TAKE FOCUS, and that is a real behaviour fix rather than a test convenience. Pressing
         * a toolbar button blurs the textarea; the blur drops the SELECTION the button is about to act on, and in this
         * app it also lets the editor re-sync from the program model underneath the gesture. Found while driving the
         * button the way a user does — the keyboard path never blurs, so it passed and hid this completely.
         * `preventDefault` on mousedown is the standard cure: the click still fires, the caret never moves.
         */
        b.addEventListener('mousedown', (e) => e.preventDefault());
        b.addEventListener('click', () => commentEditor(ed));
    }
}

/** The one entry the right-click menu shows — declared here so the menu cannot describe a different action. */
export const commentMenuItems = () => [
    { label: `${COMMENT_MARK} Comment / uncomment`, fn: () => commentEditor() },
];
