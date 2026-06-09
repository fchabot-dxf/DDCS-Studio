/**
 * engine/core/program.js — canonical program text handling.
 *
 * Comment/semicolon stripping, line splitting, N-label collection. Both the
 * execution engine (which keeps every line for editor highlighting) and the
 * simulator (which skips empties and tracks REPOSITION passes) build their
 * program image through loadProgram().
 */
import { tokenizeWords } from './tokenizer.js';

/** Strip ( ... ) comments and ; trailing comments, and trim. */
export function stripLine(raw) {
    return String(raw).replace(/\([^)]*\)/g, ' ').replace(/;.*$/, ' ').trim();
}

/**
 * Build a program image from raw text.
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {boolean} [opts.keepEmpty=false]  keep blank/comment-only lines as
 *   steps (the engine needs 1:1 lineIndex mapping for editor highlighting)
 * @param {boolean} [opts.repositionMarkers=false]  emit {type:'reposition'}
 *   steps for lines containing "REPOSITION:" (preview/simulator passes)
 * @returns {{ program: object[], labels: Map<number, number>, totalLines: number }}
 *   program steps: { raw, stripped, tokens, label, lineIndex } (or {type:'reposition'})
 */
export function loadProgram(text, opts = {}) {
    const { keepEmpty = false, repositionMarkers = false } = opts;
    const lines = String(text || '').split(/\r?\n/);
    const program = [];
    const labels = new Map();

    lines.forEach((raw, lineIndex) => {
        if (repositionMarkers && /reposition:/i.test(raw)) {
            program.push({ type: 'reposition', raw, lineIndex });
            return;
        }
        const stripped = stripLine(raw);
        if (!stripped && !keepEmpty) return;
        const tokens = tokenizeWords(stripped);
        const labelToken = tokens.find((t) => t.letter === 'N' && t.value != null);
        const label = labelToken ? Number.parseInt(labelToken.value, 10) : null;
        if (label != null && Number.isFinite(label)) {
            labels.set(label, program.length);
        }
        program.push({ raw, stripped, tokens, label, lineIndex });
    });

    return { program, labels, totalLines: lines.length };
}
