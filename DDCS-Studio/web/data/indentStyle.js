/**
 * data/indentStyle.js — HOW WIDE IS AN INDENT, and what the emit does with it. ONE source, two consumers (t1450).
 *
 * ── THE USER'S RULING: INDENTATION IS LITERAL ────────────────────────────────────────────────────────────────────
 * The spaces are REAL BYTES in the file, everywhere. There is no display-only padding anywhere in Studio — no
 * rendered gutter that pretends a line is nested, no editor that shows structure the file does not contain. Ruled
 * out deliberately: the editor is a byte-truth surface, and the moment what you SEE differs from what the controller
 * READS, every argument about the program stops being about the program. So the editor writes spaces, and the emit
 * setting changes the bytes it produces.
 *
 * ── WHY THE WIDTH IS DECLARED HERE RATHER THAN TYPED TWICE ──────────────────────────────────────────────────────
 * Two things now need to agree about what one level of indent IS: the emitters (which have written two spaces per
 * level since the first parametric body — `  #46=0`, `    G1 X…`) and the editor's block indent/outdent. Typed
 * twice, they drift the first time either is tuned, and the symptom is silent and ugly: a user indents a line by
 * hand, the wizard regenerates the region, and the file now mixes two widths that look identical until something
 * counts them. So it is ONE constant, imported by both.
 *
 * ⚠ THE VALUE IS NOT A PREFERENCE — it is a MEASUREMENT of what the emitters already write. Changing it is changing
 * every parametric body's output, so it belongs to the emit, not to taste.
 */

/** One level of indent, as the emitters have always written it. */
export const INDENT = '  ';
export const INDENT_WIDTH = INDENT.length;

/**
 * The two output styles. `flush` is now the DEFAULT for every dialect (t2070): the DDCS Expert turned out to balk at
 * leading whitespace exactly as the fallback anticipated — a leading space before an `N`-label is a hard syntax error
 * (bench-confirmed 2026-08-17, controlled A/B on CNC-FAIRY). The factory corpus already contains ZERO indented lines,
 * so column-0 is the corpus-true form; indentation was only ever cosmetic readability in the editor, which keeps its
 * own indent/outdent regardless. `indented` remains a selectable style for a controller that tolerates (or wants) it,
 * but no path defaults to it now. DDCS dialects additionally FORCE flush (dialect.flushIndent) so a user cannot pick
 * `indented` into a syntax error.
 */
export const INDENT_STYLES = ['indented', 'flush'];
export const DEFAULT_INDENT_STYLE = 'flush';

/** The style these settings ask for — unknown words resolve to the default rather than emitting something unasked. */
export function indentStyleOf(settings = {}) {
    const v = String((settings && settings.indentStyle) == null ? '' : settings.indentStyle).trim();
    return INDENT_STYLES.includes(v) ? v : DEFAULT_INDENT_STYLE;
}

/**
 * THE ONE BOUNDARY TRANSFORM. Strips LEADING whitespace only, so it can never touch a coordinate, a comment's
 * contents or the spacing inside an expression — which is what makes "whitespace-only diff" a property of the code
 * rather than a hope the corpus sweep has to re-establish.
 *
 * It mutates the emitter's own line records in place (the `applyModalFeed`/`applyCapGating` convention) because the
 * line COUNT must not change: `map`, `absorbed`, `feedFolds` and every op range are line indices, and a transform
 * that added or dropped a line would silently invalidate all four.
 */
export function applyIndentStyle(T, settings = {}) {
    if (indentStyleOf(settings) !== 'flush') return;   // 'indented' is what the emitters already wrote — no pass at all
    for (const t of (T || [])) {
        if (!t || typeof t.line !== 'string') continue;
        t.line = t.line.replace(/^[ \t]+/, '');
    }
}

/**
 * ── THE EDITOR'S BLOCK INDENT / OUTDENT, as a pure string function ───────────────────────────────────────────────
 *
 * Given the whole text and a [start, end) selection, returns the new text and the selection that should survive it.
 * Pure so the real symptom can be asserted on the BYTES without a DOM, and so the DOM path has nothing to get wrong
 * beyond applying it.
 *
 * THE SELECTION IS EXPANDED TO WHOLE LINES, which is the behaviour every editor has and the reason this is a BLOCK
 * operation: indenting half a line would insert spaces mid-token. A caret with no selection indents its own line, so
 * the feature works before you have selected anything.
 *
 * OUTDENT REMOVES UP TO ONE LEVEL AND NEVER MORE, and never touches a line that has no leading whitespace — so
 * repeated outdent lands flush and stops, instead of eating a line's first characters.
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
 * THE MARK GOES AT THE LINE'S INDENT, not at column 0: a commented line keeps its place in the structure, so
 * commenting a loop body and uncommenting it round-trips to the identical bytes. That is asserted, not assumed.
 */
export const COMMENT_MARK = ';';

/** Is every non-blank line in this block already commented? (Blank lines do not vote — else one empty line in a
 *  selection would flip the whole block's meaning, and a user cannot see why.) */
const allCommented = (lines) => {
    const real = lines.filter((l) => l.trim() !== '');
    return real.length > 0 && real.every((l) => l.trimStart().startsWith(COMMENT_MARK));
};

/**
 * Comment / uncomment the selected lines — a TOGGLE, like every editor: comment unless the block is already fully
 * commented, in which case uncomment. Same block/selection rules as `indentBlock`, and BLANK LINES ARE LEFT ALONE
 * (a `;` on an empty line is noise the user then has to clean up by hand).
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

/** The whole-line block a selection covers — shared by both operations so they can never disagree about it. */
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

export function indentBlock(text, selStart, selEnd, dir = 1) {
    const src = String(text == null ? '' : text);
    const a = Math.max(0, Math.min(src.length, selStart | 0));
    const b = Math.max(a, Math.min(src.length, selEnd | 0));
    const from = src.lastIndexOf('\n', a - 1) + 1;                       // start of the first selected line
    let to = src.indexOf('\n', b);                                       // end of the last selected line (exclusive)
    if (to === -1) to = src.length;
    // A selection that ENDS exactly at a line start has not selected that line — the caret is merely sitting on it.
    // Without this, dragging down through a line indents the one after it too, which reads as a bug every time.
    const end = (b > a && b === from) ? b : to;
    const block = src.slice(from, end);
    const lines = block.split('\n');
    let firstDelta = 0, total = 0;
    const out = lines.map((ln, i) => {
        if (dir > 0) {
            if (i === 0) firstDelta = INDENT_WIDTH;
            total += INDENT_WIDTH;
            return INDENT + ln;
        }
        const m = ln.match(/^[ \t]+/);
        if (!m) return ln;
        const cut = Math.min(m[0].length, INDENT_WIDTH);
        if (i === 0) firstDelta = -cut;
        total -= cut;
        return ln.slice(cut);
    });
    return {
        text: src.slice(0, from) + out.join('\n') + src.slice(end),
        // keep the same block selected, so the user can press the key again and again
        start: Math.max(from, a + firstDelta),
        end: Math.max(from, b + total),
        blockStart: from, blockEnd: end, replacement: out.join('\n'),
        changed: total !== 0,
    };
}
