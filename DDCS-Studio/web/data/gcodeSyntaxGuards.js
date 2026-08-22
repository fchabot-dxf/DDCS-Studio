/**
 * data/gcodeSyntaxGuards.js — the DDCS-syntax rewrite every emitted G-code line must pass through, extracted
 * so `blocks/blockEmitter.js` and `data/slotPack.js` (the CAM slot-macro path) share ONE implementation, in
 * ONE declared order (t2141).
 *
 * ── WHY A NEW LEAF MODULE, NOT AN IMPORT FROM blockEmitter.js ────────────────────────────────────────────────
 * The first cut of this fix imported the two passes FROM `blockEmitter.js` directly (t2137/t2139 precedent:
 * `data/exposeClassifier.js`/`data/stackToSlot.js` already import single pieces from it, no cycle). That is
 * safe for CORRECTNESS but not for WEIGHT: `blockEmitter.js` imports `wizards/ops/index.js`, the full BLOCKS
 * registry — MEASURED, not assumed, to corrupt an UNRELATED `GcodeExecutionEngine` trace of a hand-written CAM
 * macro once pulled through `data/probeToSlot.js → data/slotPack.js` (a bisection that imported ONLY
 * `wizards/ops/index.js` into slotPack.js, nothing else, reproduced the exact same broken trace — root cause
 * not chased to one specific file in the registry, not needed to fix it). `data/rotateProgram.js` is this
 * project's own precedent for the right shape: a zero-import leaf of emit-time TEXT passes that
 * `blockEmitter.js` imports and calls — followed here, not reinvented.
 *
 * ── WHY ONE EXPORT, NOT TWO ───────────────────────────────────────────────────────────────────────────────────
 * The clamp-then-flush ORDER is itself a fact (`blockEmitter.js` used to document it inline: the flush must run
 * LAST because the clamp rewrite inserts its own new lines, which also need flushing). Exporting the two passes
 * separately would copy that ordering fact into every caller, and a caller that ever got it backwards would
 * ship a re-indented clamp-skip label with nobody the wiser. One function, both passes, the order baked in —
 * a caller cannot get this wrong. Both internal passes are individually idempotent (a line the clamp already
 * rewrote no longer matches its own trigger shape; stripping already-flush whitespace is a no-op), so the
 * COMBINED function is idempotent too — confirmed, not assumed: the universal CAM arm's body is already
 * `emitMapped`-treated before it ever reaches `slotMacro`, so it passes through here a SECOND time, and that
 * is required to be a byte-identical no-op, not merely tolerated.
 */

// t2070 — INLINE `IF <cond> THEN <var>=<val>` IS A HARD SYNTAX ERROR on the DDCS Expert (bench-confirmed 2026-08-17:
// the Expert does `IF <cond> GOTO <label>` only, never a THEN-assignment). Looped ops (surfacing/pocket/holecycle/…)
// emit these as depth/row CLAMPS (`IF #z > #depth THEN #z=#depth`, `IF #n < 1 THEN #n=1`), so every one errored on the
// Expert. Rewrite each to the equivalent GOTO-skip: `IF <var> <INVERSE-op> <bound> GOTO<L>` / `<var>=<val>` / `N<L>`
// (skip the assignment unless the clamp condition holds — provably the same result as the inline form). Labels
// start ABOVE every N-label already present in `T` so they never collide.
//
// t2141 — WORD-FORM OPERATORS (GT/LT/GE/LE/EQ/NE), FOUND MISSING WHILE FIXING THE CAM PATH, NOT INFERRED. DDCS
// macro syntax accepts a comparison as EITHER a symbol (`>`, `==`, …) or its word form (`GT`, `EQ`, …); the
// wizard-op emit path (blockEmitter.js) only ever produced the symbolic form, so this regex was never exercised
// against the word form until this turn ran it against real hand-written CAM-generator text (measured: reusing
// the symbol-only regex verbatim caught 2 of 23 real inline-THEN lines across the twelve generator arms and
// silently passed the other 21 through unrewritten — including plain conditional ASSIGNMENTS like
// `IF #1 EQ 2 THEN #90=0-1`, not just depth/row clamps; the rewrite is equally valid for those, this just
// widens WHICH lines it recognizes). The inverse is emitted in the SAME FORM as the source operator (word stays
// word, symbol stays symbol) — these bodies are hand-written DDCS text, not emitter output, so a symbolic
// inverse spliced into a word-operator line would be a NEW syntax error, not a fix.
const CLAMP_INV = {
    '>': '<=', '<': '>=', '>=': '<', '<=': '>', '==': '!=', '!=': '==',
    'GT': 'LE', 'LT': 'GE', 'GE': 'LT', 'LE': 'GT', 'EQ': 'NE', 'NE': 'EQ',
};
const CLAMP_RE = /^(\s*)IF\s+(.+?)\s*(>=|<=|==|!=|>|<|\bGE\b|\bLE\b|\bGT\b|\bLT\b|\bEQ\b|\bNE\b)\s*(.+?)\s+THEN\s+(\S+?)\s*=\s*(.+?)(\s+\(.*\))?\s*$/;

function applyInlineClampSkip(T, dialect) {
    if (!dialect || !dialect.flushIndent) return;   // DDCS family only — other dialects accept the inline THEN form
    let next = 90;                                   // the next free label: strictly above every N-label already present
    for (const t of T) { const m = /(?:^|\s)N(\d+)\b/.exec(t.line || ''); if (m) next = Math.max(next, +m[1]); }
    next += 1;
    for (let i = 0; i < T.length; i++) {
        const m = CLAMP_RE.exec(T[i].line || '');
        if (!m) continue;
        const [, indent, lhs, op, rhs, av, aval, comment] = m;
        const inv = CLAMP_INV[op]; if (!inv) continue;
        const L = next++;
        T[i].line = `${indent}IF ${lhs} ${inv} ${rhs} GOTO${L}${comment || ''}`;   // guard: skip unless the clamp fires
        const mk = (line) => ({ ...T[i], line });    // inherit src/anc so the line map stays 1:1
        T.splice(i + 1, 0, mk(`${indent}${av}=${aval}`), mk(`${indent}N${L}`));
        i += 2;
    }
}

/** t2139 — NO INDENTATION, EVER: strip leading whitespace off every line, unconditionally. */
function flushLeft(T) {
    for (const t of T) if (t && typeof t.line === 'string') t.line = t.line.replace(/^[ \t]+/, '');
}

/**
 * THE ONE ENTRY POINT. Runs the inline-clamp-skip rewrite, THEN the flush strip, on `T` — mutated in place, in
 * this order, always: the clamp rewrite inserts NEW lines (the GOTO-skip's own `N<L>` label) that also need
 * flushing, so flush must run last, and a caller cannot get this backwards because there is nothing to reorder.
 * @param {Array<{line:string}>} T   a per-line token array — mutated in place. A token needs only `.line`;
 *   any OTHER field (`.src`, an editor line-map anchor, …) is preserved for free by the clamp pass's own object
 *   spread when it inserts new lines, so a caller with no other fields to carry passes plain `{line}` tokens
 *   and a caller that needs `.src` (the real emitter) gets it threaded through unchanged — one code path, not
 *   a CAM-specific branch that drops it.
 * @param {{flushIndent?: boolean}} dialect   DDCS family only (declared via `flushIndent`) gets the clamp
 *   rewrite; every other dialect's controller accepts the inline THEN form, so a no-op there is correct. The
 *   flush strip is unconditional regardless (t2139 — no per-dialect exception, ever).
 */
export function applyDdcsSyntaxGuards(T, dialect) {
    applyInlineClampSkip(T, dialect);
    flushLeft(T);
}
