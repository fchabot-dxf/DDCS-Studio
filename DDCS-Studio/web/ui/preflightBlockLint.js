/**
 * ui/preflightBlockLint.js — the BLOCK-SIDE contributor to the pre-flight badge (t1568).
 *
 * The badge is the declared "warn BEFORE motion" surface and it is G-code-side: it reads the editor text and
 * runs `checkEnvelope`. `lintProgram` is block-side and speaks in block ids. Rather than build a second warnings
 * surface next to it, this module translates one into the other so the badge stays ONE surface with TWO
 * contributors.
 *
 * WHY AN UNRESOLVABLE EXPRESSION IS AMBER, AND NEVER RED. Amber's declared meaning is "can't verify (why)", and
 * for this case that is not an approximation, it is literally true: if a move's coordinate never resolved, the
 * envelope check on that line did not pass — it was never performed on the real number. Red means "outside the
 * envelope", a stronger claim we cannot support, since the value that would have been checked is exactly the one
 * we do not have. So this can only ever RAISE green to amber; a red verdict stays red and keeps its own
 * per-line annotations.
 *
 * THE LINE NUMBERS ARE ONLY HONEST WHEN THE MAP IS. The join reuses two seams that already existed rather than
 * re-emitting: `getProjection()` (the cached `{text, lines, map}`, where `map[i]` is the block ANCESTRY of line
 * i) and `editorMatchesProjection()` (the app's own "is that map currently valid" guard, already gating
 * `ddcsOpAtLine`). Re-emitting to rebuild the map would have been wrong twice over — `emitMapped` calls
 * `uniquifyFlowLabels`, which MUTATES the stack, so a read-only badge render would have had a side effect.
 *
 * When the editor has been hand-edited away from the projection the map is stale, so a line number would point
 * at whatever now occupies that row. In that state this contributes NOTHING: a warning with a confidently wrong
 * line is worse than no warning, and the user is looking at G-code they typed, not at the blocks.
 */
import { lintProgram, LINT_KIND } from '../blocks/lint.js';
import { editorMatchesProjection, linesForOp } from '../blocks/programModel.js';

/**
 * The block-side violations for the badge, in the badge's OWN vocabulary
 * ([{ kind:'unresolved-expr', line, msg, severity }], `line` 1-based like checkEnvelope's).
 * Returns [] whenever the block→line map cannot be trusted.
 */
export function blockLintViolations() {
    if (typeof window === 'undefined') return [];
    let matches = false;
    try { matches = editorMatchesProjection(); } catch (_) { return []; }
    if (!matches) return [];   // hand-edited G-code: the map is stale, so no line number here is honest

    const stack = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
    if (!stack.length) return [];

    let records;
    try { records = lintProgram(stack); } catch (_) { return []; }   // the badge must never break on a lint fault

    const out = [];
    for (const r of records) {
        // Filter on the DECLARED kind, never on message text — the motion-safety checks are a different
        // conversation and would flood a surface whose whole value is that a clean program says nothing.
        if (!r || r.kind !== LINT_KIND.UNRESOLVABLE_EXPR) continue;
        let idx = [];
        try { idx = r.blockId ? linesForOp(r.blockId) : []; } catch (_) { idx = []; }
        out.push({
            kind: 'unresolved-expr',
            line: idx.length ? idx[0] + 1 : null,   // projection indices are 0-based; badge lines are 1-based
            msg: r.msg,
            severity: r.severity,
        });
    }
    return out;
}
