/**
 * blocks/lint.js — motion-safety lint for the Blocks tab. WARN, never block: catastrophic-but-creative
 * code stays *possible*, the lint just makes it *visible* (the product wedge — see MULTI-OP-STACKING.md).
 *
 * Param-level checks (no G-code parsing — params are the source of truth). Each leaf/move op is checked
 * against its own RESOLVED params (expression fields evaluated against the same scope emit uses). Set
 * blocks bind the scope; loops are checked for a zero-iteration range and their children linted once with
 * the index at its first value. Each warning is tagged with the producing block id (like the source map).
 */
import { BLOCKS, evalExpr } from '../wizards/ops/index.js';
import { UNRESOLVED } from '../wizards/ops/expr.js';   // t1577 — a Set binding whose own value failed propagates, it does not default
import { num } from '../wizards/ops/util.js';

/**
 * t1566 — WHICH string params are MEANT to be expressions, so a broken one can be NAMED instead of swallowed.
 *
 * `evalExpr` throws for two completely different reasons, and only one of them is a defect:
 *   1. the value was never an expression — a select like 'grid'/'rapid', a label, a filename. Throwing is the
 *      DESIGNED signal here ("not an expression, keep the raw value"), and warning would cry wolf.
 *   2. the value IS meant to compute and is broken — `fedrate * 2`, `3 +`. Silently substituting the declared
 *      default for this is the t1564 finding: a typo'd param name is indistinguishable from a deliberate value.
 *
 * The declared discriminator is the block def's OWN default: a field whose default is a number holds a number,
 * so a string sitting in it is an expression. Read from `def.defaults` rather than importing `fieldKind` from
 * the Blockly bridge — that module requires window.Blockly, and lint runs on the emit path where it must not.
 *
 * CONTROLLER_TOKEN is the one carve-out: `#7`, `[#5+1]` are DDCS variable/expression references that ride
 * through to the controller verbatim and are not ours to evaluate. Measured across every registered twin stack
 * before choosing this rule: 1172 string params throw, 47 sit on numeric fields, and ALL 47 are these tokens —
 * so on a clean corpus the rule fires exactly 0 times and only speaks when something is genuinely broken.
 */
/**
 * t1566 (amendment) — SEVERITY IS A DECLARED SLOT, not a hardcoded literal.
 *
 * Every lint record carries `severity`. Today every one of them is 'warn', so behaviour and emitted G-code
 * are unchanged — the point is that the slot EXISTS. The run-time fork is already ruled: an unresolvable
 * expression will REFUSE to emit rather than substitute a default. When that act lands it flips ONE declared
 * value below, instead of retrofitting a severity onto every call site and every consumer of the channel.
 * A declaration is near-free; the retrofit is not.
 */
export const LINT_SEVERITY = { WARN: 'warn', ERROR: 'error' };

/**
 * The severity an UNRESOLVABLE EXPRESSION reports at — and t1579 is the act that flips it, exactly as the slot
 * was declared for. It is no longer a "maybe": with the emit now writing the author's text out verbatim, a file
 * containing an unresolvable expression is one the controller REFUSES (bench-confirmed) and PARTIALLY executes
 * — the ops before it cut, then the machine halts with the tool in the material. That is an error about the
 * file, not a warning about a preference, and one declared value carries it to every consumer.
 */
export const UNRESOLVABLE_EXPR_SEVERITY = LINT_SEVERITY.ERROR;

/**
 * t1568 — KIND is the second declared axis, and it exists so a CONSUMER can select without reading messages.
 *
 * The pre-flight badge takes only the unresolvable-expression records: the motion-safety checks are a different
 * conversation (and would flood a surface whose whole value is that a clean program says nothing). Selecting them
 * by matching message text would be inferring intent back out of output — the thing this codebase keeps getting
 * burned by. A declared field is free; the consumer filters on `kind`.
 */
export const LINT_KIND = { MOTION: 'motion', UNRESOLVABLE_EXPR: 'unresolvable-expr' };

const CONTROLLER_TOKEN = /^\s*[#[]/;
const isExprField = (def, k) => typeof ((def && def.defaults) || {})[k] === 'number';

/** Evaluate, keeping the evaluator's OWN message so the warning can name the cause ("unknown var: fedrate"). */
function tryEval(src, scope) {
    try { return { v: evalExpr(src, scope) }; } catch (e) { return { err: e && e.message ? e.message : 'invalid expression' }; }
}

function resolve(params, scope, def, add) {
    const out = {};
    for (const k in params) {
        const v = params[k];
        if (typeof v === 'string') {
            const r = tryEval(v, scope);
            if (!('err' in r)) { out[k] = r.v; continue; }
            out[k] = v;   // unchanged: the raw value still flows on, so emitted G-code is untouched
            // t1575 — THE MESSAGE HAS TO MATCH WHAT THE EMIT NOW DOES. This said "using the default instead",
            // which was true when a failed expression was laundered into the declared default (a coordinate
            // became X0 — a legal line, wrong place, silent). The emit now writes the author's text out
            // verbatim so the controller refuses it by name, so the old wording would be the warning lying
            // about the file sitting next to it. (t1577 — the Set-block site has since stopped defaulting too and
            // its message moved with it; the LOOP-bound site still genuinely falls back, so that one is unchanged.
            // Each was re-checked against the real emit rather than swept along with this one.)
            if (add && isExprField(def, k) && !CONTROLLER_TOKEN.test(v)) add(`${k} = "${v}": ${r.err} — emitted as written, so the controller will refuse this line`, UNRESOLVABLE_EXPR_SEVERITY, LINT_KIND.UNRESOLVABLE_EXPR);
        } else out[k] = v;
    }
    return out;
}

/** Per-type checks → array of warning strings, given RESOLVED params. */
const CHECKS = {
    line: (p) => {
        const m = [], depth = num(p.depth, 0), step = num(p.stepdown, depth), clr = num(p.clearance, 0), feed = num(p.feed, 0);
        if (clr <= 0) m.push(`clearance ${clr} ≤ 0 — rapids at/below stock top (Z0)`);
        if (depth <= 0) m.push(`depth ${depth} ≤ 0 — nothing is cut`);
        else if (step > depth) m.push(`stepdown ${step} > depth ${depth} — cuts full depth in one pass`);
        if (feed <= 0) m.push(`feed ${feed} ≤ 0`);
        return m;
    },
    bore: (p) => {
        const m = [], depth = num(p.depth, 0), hole = num(p.holeDia, 0), tool = num(p.toolDia, 0), clr = num(p.clearance, 0), feed = num(p.feed, 0);
        if (clr <= 0) m.push(`clearance ${clr} ≤ 0 — rapids at/below stock top (Z0)`);
        if (depth <= 0) m.push(`depth ${depth} ≤ 0 — nothing is cut`);
        if (hole <= tool) m.push(`holeDia ${hole} ≤ toolDia ${tool} — plunges straight down, doesn't bore`);
        else if (num(p.pitch, 0) > depth && depth > 0) m.push(`pitch ${num(p.pitch, 0)} > depth ${depth} — full depth in one plunge`);
        if (feed <= 0) m.push(`feed ${feed} ≤ 0`);
        return m;
    },
    drill: (p) => {
        const m = [], depth = num(p.depth, 0), peck = num(p.peck, depth), clr = num(p.clearance, 0), feed = num(p.feed, 0);
        if (clr <= 0) m.push(`clearance ${clr} ≤ 0 — rapids at/below stock top (Z0)`);
        if (depth <= 0) m.push(`depth ${depth} ≤ 0 — nothing is cut`);
        else if (peck > depth) m.push(`peck ${peck} > depth ${depth} — drills full depth in one plunge`);
        if (feed <= 0) m.push(`feed ${feed} ≤ 0`);
        return m;
    },
    probe: (p) => {
        const m = [], z = num(p.z, 0), feed = num(p.feed, 0);
        if (z >= 0) m.push(`probe Z ${z} ≥ 0 — probes at/above stock top; set a negative Z to reach the surface`);
        if (feed <= 0) m.push(`probe feed ${feed} ≤ 0`);
        return m;
    },
};

/** Lint a program → [{ blockId, msg, severity, kind }] (today all 'warn'; nothing blocks). */
export function lintProgram(blocks) {
    const out = [];
    walk(blocks || [], Object.create(null), out);
    return out;
}

function walk(blocks, scope, out) {
    for (const b of blocks) {
        const def = BLOCKS[b.type]; if (!def) continue;
        const add = (msg, severity = LINT_SEVERITY.WARN, kind = LINT_KIND.MOTION) => out.push({ blockId: b.id, msg, severity, kind });

        if (def.kind === 'var') {   // Set: bind the scope (and warn on a broken formula)
            // t1566 — this site ALREADY warned, but its bare `catch` discarded the evaluator's named reason, so a
            // typo'd reference read the same as any other bad formula. Keep the message, add the cause.
            const r = tryEval(b.params.value, scope);
            // t1577 — the message HAD to change with the behaviour, again: this said "defaults to 0", which was
            // true until the Set binding stopped defaulting. It now propagates the failure, so every line that
            // READS this name fails too and emits verbatim — which is where the machine finally sees it.
            if ('err' in r) { scope[b.params.name] = UNRESOLVED; add(`"${b.params.name}" = ${b.params.value}: ${r.err} — every line using ${b.params.name} is emitted as written, so the controller will refuse it`, UNRESOLVABLE_EXPR_SEVERITY, LINT_KIND.UNRESOLVABLE_EXPR); }
            else scope[b.params.name] = r.v;
            continue;
        }

        // t1577/t1579 — a LOOP/DEPTH bound is reported HERE, once, by the block that owns it. Letting the generic
        // resolve() report it too gave two rows for one typo with contradictory messages. t1579 also fixes two
        // things that turn: the message ("using 0" stopped being true the moment the emit started writing the
        // author's text out instead of guessing), and DEPTH — lint has no depth branch, so t1577's routing had
        // silenced Step Down's bounds entirely. One reporter, both kinds, saying what actually happens.
        const boundsReportedBelow = def.kind === 'loop' || def.kind === 'depth';
        const p = resolve(b.params, scope, def, boundsReportedBelow ? null : add);
        let badBounds = null;
        if (boundsReportedBelow) {
            const fields = def.kind === 'loop' ? ['from', 'to', 'by'] : ['to', 'by', 'confirmEvery'];
            const found = [];
            for (const f of fields) {
                const raw = b.params[f];
                if (typeof raw !== 'string' || raw.trim() === '' || CONTROLLER_TOKEN.test(raw)) continue;
                const rr = tryEval(raw, scope);
                if ('err' in rr) found.push({ f, raw: raw.trim(), err: rr.err });
            }
            found.forEach((bb) => add(`${bb.f} = "${bb.raw}": ${bb.err} — emitted as written, so the controller will refuse this line`, UNRESOLVABLE_EXPR_SEVERITY, LINT_KIND.UNRESOLVABLE_EXPR));
            badBounds = found.length ? found : null;
        }
        if (CHECKS[b.type]) CHECKS[b.type](p).forEach(add);

        // t1581 — THE IF CONDITION reported NOTHING. `cond`'s default is a string (a boolean socket), so the
        // numeric-default discriminator skipped it — and this was the one case where silence was most expensive,
        // because an unresolvable condition silently took the else-branch and both branches are plausible whole
        // programs. Reported at its own site for the same reason the bounds are: this block knows what actually
        // happens to its condition, and the generic reporter does not.
        if (def.kind === 'cond') {
            const raw = b.params.cond;
            if (typeof raw === 'string' && raw.trim() !== '' && !CONTROLLER_TOKEN.test(raw)) {
                const rc = tryEval(raw, scope);
                if ('err' in rc) add(`condition "${raw.trim()}": ${rc.err} — emitted as written, so the controller will refuse this line (neither branch is chosen)`, UNRESOLVABLE_EXPR_SEVERITY, LINT_KIND.UNRESOLVABLE_EXPR);
            }
        }

        if (def.kind === 'loop') {
            const name = b.params.var || 'i';
            // t1566 — the loop bounds are the third swallow site: a broken `from`/`to`/`by` silently became the
            // fallback, so "runs 0 times" was reported without ever saying the bound was a typo. Name it here too;
            // a controller token in a bound is not ours to evaluate, same carve-out as resolve().
            const ev = (x, d) => { const r = tryEval(x, scope); return ('err' in r) ? d : r.v; };   // bounds are reported above
            const from = ev(b.params.from, 1), to = ev(b.params.to, 0), by = ev(b.params.by, 1) || 1;
            const steps = by > 0 ? Math.floor((to - from) / by) + 1 : (by < 0 ? Math.floor((from - to) / -by) + 1 : 0);
            // t1579 — "runs 0 times" was a CONSEQUENCE of the fallback, and the fallback is gone: an unresolvable
            // bound no longer unrolls to zero, it emits the author's text for the machine to refuse. Reporting a
            // zero-iteration count for a loop that never got that far would be the same stale-warning failure.
            if (steps <= 0 && !badBounds) add(`runs 0 times (from ${from} to ${to} by ${by})`);
            if (!(b.children || []).length) add('empty loop — add a block to repeat');
            const child = Object.create(scope); child[name] = from;
            walk(b.children || [], child, out);
        } else if (def.kind === 'container' || def.kind === 'path') {
            if (!(b.children || []).length) add('no child op — add a block to repeat/sweep');
            walk(b.children || [], scope, out);
        }
    }
}
