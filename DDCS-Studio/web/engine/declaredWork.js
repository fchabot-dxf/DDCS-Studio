/**
 * engine/declaredWork.js — HOW MUCH WORK A PROGRAM EXPECTS TO DO, DECLARED BY THE THING THAT KNOWS (t1383).
 *
 * ── THE BUG THIS FIXES IS A MISSING DECLARATION, NOT A WRONG NUMBER ───────────────────────────────────────────────
 * The tracer's runaway guard was `max(program.length * 50, 5000)` steps — the cap sized by program TEXT LENGTH. That is
 * a reasonable proxy for an UNROLLED program, where each line executes about once. It is exactly the wrong proxy for a
 * PARAMETRIC one, because collapsing the text is the whole point of a loop: t1381 measured a literal helical bore on a
 * 24-hole bolt circle at ~11700 lines (cap ~585k, traces whole) against the parametric body emitting the IDENTICAL path
 * at 43 lines (cap 5000 — the floor — truncating at about a TWELFTH of the 117061 steps it actually needs).
 *
 * So the guard was INFERRING execution size from output size. The atom that emits the loop already computes the real
 * counts — holes, pecks, revolutions, rows × levels — so it DECLARES them instead, and the tracer reads the
 * declaration. A cap is then proportional to the work, not to the accident of how compactly the work is written.
 *
 * ── WHY THE CARRIER IS A TOKEN IN THE ATOM'S OWN HEADER COMMENT ───────────────────────────────────────────────────
 * The declaration has to reach the tracer, and the tracer is fed TEXT from several hosts — a block emit, the CAM
 * pendant, and the raw editor buffer a user can type into. A side-channel object would therefore be BOTH extra
 * plumbing at four call sites AND stale against the editor host, which has no emit to carry it. Riding IN the emit is
 * the only carrier that is one source for every consumer, and it is what "a declared quantity on the emit" means.
 *
 * It is a token inside the header comment the atom ALREADY emits rather than a new marker LINE, and that is deliberate:
 * a new line would shift every line index in the program (the emitter's `map`, `absorbed` and `feedFolds` are all
 * index-aligned) and perturb the round-trip diff for every program that grew one. A token widens a comment that is
 * already there — no new step, no index shift, and `stripAnnotations` (the equivalence harness's normalizer) drops it
 * with every other parenthetical, so no byte-equivalence bridge can see it.
 *
 * SUMMED, NOT SINGULAR: a program may hold several declaring ops (a drill pass, then a bored hole). Every marker in the
 * text adds to the total, so composition needs no extra mechanism.
 */

/** The declared grammar, in ONE place — `workMarker` writes it, `readDeclaredWork` reads it, nothing else parses it. */
const WORK_RE = /@work\s+(\d+)/g;

/** Print the declaration. Atoms embed this in their header comment: `( ---- DRILL … · @work 4820 ---- )`. */
export function workMarker(steps) {
    return `@work ${Math.max(0, Math.round(Number(steps) || 0))}`;
}

/** Total declared work in a program, or 0 when nothing declares (→ the caller uses the flow-aware floor below). */
export function readDeclaredWork(text) {
    let total = 0;
    for (const m of String(text || '').matchAll(WORK_RE)) total += Number(m[1]) || 0;
    return total;
}

/**
 * THE MARGIN on a declaration. A declaration is a good-faith estimate of executed lines, not a proof: an atom counts
 * its loop trips and its body, and the two are multiplied, so a small per-trip miscount scales. 4x absorbs that while
 * still bounding a genuine runaway to a small multiple of the intended work — which is the property the guard exists
 * for. A declaration that is wrong by more than 4x is a BUG IN THE DECLARATION, and it surfaces as a truncated preview
 * that now says so out loud rather than as a silently short toolpath.
 */
export const WORK_MARGIN = 4;

/**
 * THE FLOOR FOR AN UNDECLARED PROGRAM THAT CARRIES FLOW — the honest answer when there is nothing to read.
 *
 * `program.length * 50` is a fair cap for straight-line G-code and a nonsense one for a loop, so the floor splits on
 * whether the text HAS a loop rather than pretending length means the same thing in both cases. This is not inference
 * standing in for a declaration; it is the fallback for text nobody declared — a hand-written macro, a pendant program,
 * an .nc from another CAM system — where no declaration can exist.
 *
 * Sized from t1381's own measurement of the worst REALISTIC job (a bolt-24 helical bore at d20/p0.25): 467k steps,
 * ~450ms. 750k clears that with room and still gives up promptly on a true runaway. The cost is paid once per preview
 * refresh, not per keystroke — and NOT by the value-glow localizer, which t1381 assumed pays it (see the correction in
 * the t1383 WORK-LOG: `opGlow.js` imports `emitMapped` only and never traces, so no localize touches this path).
 */
export const FLOW_FLOOR = 750_000;

/** Does this text contain controller flow? `WHILE`/`DOn`/`ENDn` loops, or a backward `GOTO`. */
export function hasFlow(text) {
    return /(^|[^A-Z0-9_])(WHILE|DO\d|END\d|GOTO)([^A-Z0-9_]|$)/i.test(String(text || ''));
}

/**
 * THE SENTENCE A TRUNCATED PREVIEW SHOWS — ONE phrasing, so the 2D panel, the 3D panel and any later host cannot
 * describe the same truncation three different ways. This is the other half of the ruling: `stats.capped` was already
 * true and already correct, and NOTHING READ IT, so a partial toolpath was indistinguishable from a finished one. A
 * preview that has been cut short says so.
 *
 * The two cases read differently on purpose, because they call for different actions from the person reading them:
 * a DECLARED program that still overran means the declaration is wrong (a bug to report), while an undeclared one
 * that overran is most likely a genuine runaway loop in the program itself (a bug to fix in the G-code).
 */
export function truncationReason({ cap, declared, source } = {}) {
    const n = Number(cap) || 0;
    return declared > 0
        ? `Preview truncated at ${n.toLocaleString()} steps — this program declared ${Number(declared).toLocaleString()} and ran past ${WORK_MARGIN}x that. The path shown is INCOMPLETE.`
        : `Preview truncated at ${n.toLocaleString()} steps — ${source === 'flow-floor' ? 'this program loops further than the safety limit for undeclared G-code' : 'this program runs longer than its length allows for'}. The path shown is INCOMPLETE.`;
}

/**
 * THE ONE CAP DECISION, so the engine and any other tracer answer identically.
 * @param {string} text        the program as fed to the tracer (the declaration rides in it)
 * @param {number} lineCount   the loaded program's step count
 * @param {number} override    an explicit caller cap (`traceStepCap`) — still honoured, still the escape hatch
 * @returns {{cap:number, declared:number, source:'declared'|'flow-floor'|'length'|'override'}}
 */
export function traceCap(text, lineCount, override = 0) {
    const declared = readDeclaredWork(text);
    const byLength = Math.max(Number(lineCount) || 0, 0) * 50;
    const ov = Number(override) || 0;
    // FOUR candidates, each LABELLED by which one wins, because the label is what the truncation sentence reads to decide
    // what to tell the user. Deriving the label by comparing the winning NUMBER back against the candidates (what a first
    // cut here did) mislabels every tie: a 5-line straight program's 250-by-length loses to the plain 5000 floor and got
    // reported as 'flow-floor' despite having no flow at all. The branch that decides is the branch that names itself.
    const flow = declared <= 0 && hasFlow(text);
    const floor = declared > 0 ? declared * WORK_MARGIN : (flow ? FLOW_FLOOR : 5000);
    const floorSource = declared > 0 ? 'declared' : (flow ? 'flow-floor' : 'length');
    const cap = Math.max(byLength, floor, ov);
    const source = ov === cap && ov > floor && ov > byLength ? 'override' : (floor >= byLength ? floorSource : 'length');
    return { cap, declared, source };
}
