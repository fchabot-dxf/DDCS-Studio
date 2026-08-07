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
            if (add && isExprField(def, k) && !CONTROLLER_TOKEN.test(v)) add(`${k} = "${v}": ${r.err} — using the default instead`);
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

/** Lint a program → [{ blockId, msg }] (all warnings; nothing blocks). */
export function lintProgram(blocks) {
    const out = [];
    walk(blocks || [], Object.create(null), out);
    return out;
}

function walk(blocks, scope, out) {
    for (const b of blocks) {
        const def = BLOCKS[b.type]; if (!def) continue;
        const add = (msg) => out.push({ blockId: b.id, msg });

        if (def.kind === 'var') {   // Set: bind the scope (and warn on a broken formula)
            // t1566 — this site ALREADY warned, but its bare `catch` discarded the evaluator's named reason, so a
            // typo'd reference read the same as any other bad formula. Keep the message, add the cause.
            const r = tryEval(b.params.value, scope);
            if ('err' in r) { scope[b.params.name] = 0; add(`"${b.params.name}" = ${b.params.value}: ${r.err} — defaults to 0`); }
            else scope[b.params.name] = r.v;
            continue;
        }

        const p = resolve(b.params, scope, def, add);
        if (CHECKS[b.type]) CHECKS[b.type](p).forEach(add);

        if (def.kind === 'loop') {
            const name = b.params.var || 'i';
            // t1566 — the loop bounds are the third swallow site: a broken `from`/`to`/`by` silently became the
            // fallback, so "runs 0 times" was reported without ever saying the bound was a typo. Name it here too;
            // a controller token in a bound is not ours to evaluate, same carve-out as resolve().
            const ev = (x, d, which) => {
                const r = tryEval(x, scope);
                if (!('err' in r)) return r.v;
                if (typeof x === 'string' && x !== '' && !CONTROLLER_TOKEN.test(x)) add(`${which} = "${x}": ${r.err} — using ${d}`);
                return d;
            };
            const from = ev(b.params.from, 1, 'from'), to = ev(b.params.to, 0, 'to'), by = ev(b.params.by, 1, 'by') || 1;
            const steps = by > 0 ? Math.floor((to - from) / by) + 1 : (by < 0 ? Math.floor((from - to) / -by) + 1 : 0);
            if (steps <= 0) add(`runs 0 times (from ${from} to ${to} by ${by})`);
            if (!(b.children || []).length) add('empty loop — add a block to repeat');
            const child = Object.create(scope); child[name] = from;
            walk(b.children || [], child, out);
        } else if (def.kind === 'container' || def.kind === 'path') {
            if (!(b.children || []).length) add('no child op — add a block to repeat/sweep');
            walk(b.children || [], scope, out);
        }
    }
}
