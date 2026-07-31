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
 * The two output styles. `indented` is today's bytes, unchanged and default — so a user who never opens the setting
 * gets exactly the program they got before this existed, which is what makes the whitespace-only proof meaningful.
 * `flush` is the FALLBACK: the factory corpus contains ZERO indented lines, so if a controller turns out to balk at
 * leading whitespace the operator has a documented switch rather than a bug report (V15_indent.nc is the decider).
 */
export const INDENT_STYLES = ['indented', 'flush'];
export const DEFAULT_INDENT_STYLE = 'indented';

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
