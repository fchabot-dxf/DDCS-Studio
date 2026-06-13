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

function resolve(params, scope) {
    const out = {};
    for (const k in params) {
        const v = params[k];
        if (typeof v === 'string') { try { out[k] = evalExpr(v, scope); } catch { out[k] = v; } }
        else out[k] = v;
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
            try { scope[b.params.name] = evalExpr(b.params.value, scope); }
            catch { scope[b.params.name] = 0; add(`"${b.params.name}" = ${b.params.value}: not a valid expression, defaults to 0`); }
            continue;
        }

        const p = resolve(b.params, scope);
        if (CHECKS[b.type]) CHECKS[b.type](p).forEach(add);

        if (def.kind === 'loop') {
            const name = b.params.var || 'i';
            const ev = (x, d) => { try { return evalExpr(x, scope); } catch { return d; } };
            const from = ev(b.params.from, 1), to = ev(b.params.to, 0), by = ev(b.params.by, 1) || 1;
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
