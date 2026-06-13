/**
 * blocks/blockModel.js — the Blocks-tab program model + recursive emit.
 *
 * A program is an ordered list of block records; each block is a primitive from the ops registry.
 * emit() folds the tree:
 *   - leaf / move  → its kernel (def.emit)
 *   - container    → STAMP: points × children, each child translated to the point  (array → bore = drill)
 *   - path         → SWEEP: a move child run to each generated point in order      (helix → probe = helical probe)
 * Same kernels as the STUDIO presets — proven: [array(bore)] == the drill wizard (byte-identical toolpath).
 *
 * emitMapped() returns { text, lines, map } — map[i] is the ancestry of block ids that produced line i
 * (null = program header/footer/seam), powering per-block code reveal + linked selection.
 *
 * Variables/Control (Codeblocks-style): the fold threads a `scope` (a variable environment). `Set`
 * (kind:'var') binds a variable; `Count` (kind:'loop') runs its sub-stack once per step, exposing the
 * index. Any field can be an expression — resolveParams() evaluates it against the scope right before
 * the kernel runs, so the kernels still receive plain numbers and never change. Blocks give SYNTACTIC
 * correctness, not motion safety (lint comes next — see MULTI-OP-STACKING.md).
 */
import { BLOCKS, evalExpr } from '../wizards/ops/index.js';
import { num, r3 } from '../wizards/ops/util.js';
import { headerBlock, footerBlock } from '../wizards/cuttingBlocks.js';

let _seq = 0;
/** Fresh block record from a registry type, seeded with that primitive's defaults. */
export function newBlock(type) {
    const def = BLOCKS[type];
    if (!def) throw new Error(`unknown block type: ${type}`);
    const b = { id: `${type}${++_seq}`, type, params: { ...def.defaults } };
    if (def.kind === 'container' || def.kind === 'path' || def.kind === 'loop' || def.kind === 'cond') b.children = [];
    return b;
}

/** One emitted line + its provenance: src = ancestry [outer…inner] of owning block ids, or null = program-owned. */
const tag = (line, src) => ({ line, src });

/** Resolve a value socket → a number: a literal, a scalar/expression string, or a Reporter record
 *  (Variable/Math) evaluated recursively via its def's `reduce` (Math operands resolve through `rc`). */
function resolveValue(v, scope) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') { try { return evalExpr(v, scope); } catch { return NaN; } }
    const def = BLOCKS[v.type];                              // a reporter pill plugged into the socket
    return def && def.reduce ? def.reduce(v.params || {}, scope, (c) => resolveValue(c, scope)) : 0;
}

/** Resolve a boolean socket → true/false: empty = false; a number/expression is truthy when ≠ 0; a boolean
 *  reporter pill (Compare) is reduced (its numeric operands resolve through resolveValue). */
function resolveBool(v, scope) {
    if (v == null || v === '') return false;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') { try { return evalExpr(v, scope) !== 0; } catch { return false; } }
    const def = BLOCKS[v.type];                              // a boolean reporter pill in the socket
    return def && def.reduce ? !!def.reduce(v.params || {}, scope, (c) => resolveValue(c, scope)) : false;
}

/** Resolve a block's params against the variable scope: a Reporter pill (object) is reduced; a string that
 *  parses as an expression becomes a number; anything else (e.g. a select like 'grid') is kept. */
function resolveParams(params, scope) {
    const out = {};
    for (const k in params) {
        const v = params[k];
        if (v && typeof v === 'object') out[k] = resolveValue(v, scope);          // Reporter pill in a value socket
        else if (typeof v === 'string') { try { out[k] = evalExpr(v, scope); } catch { out[k] = v; } }
        else out[k] = v;
    }
    return out;
}

/** Recursive fold → tagged lines. `anc` = ancestry of block ids; `scope` = the variable environment. */
function emit(block, dx = 0, dy = 0, anc = [], scope = Object.create(null)) {
    const def = BLOCKS[block.type];
    const own = [...anc, block.id];            // this block's full ancestry (drives the line→source map)
    if (!def) return [tag(`( unknown block ${block.type} )`, own)];

    if (def.kind === 'var') {                  // SET: bind a variable in the current scope
        let val; try { val = evalExpr(block.params.value, scope); } catch { val = 0; }
        scope[block.params.name] = val;
        return [tag(`( ${block.params.name} = ${r3(val)} )`, own)];
    }

    if (def.kind === 'loop') {                 // COUNT: run the sub-stack once per step, exposing the index
        const name = block.params.var || 'i';
        const ev = (x, d) => { try { return evalExpr(x, scope); } catch { return d; } };
        const from = ev(block.params.from, 1), to = ev(block.params.to, 0), by = ev(block.params.by, 1) || 1;
        const steps = by > 0 ? Math.floor((to - from) / by) + 1 : (by < 0 ? Math.floor((from - to) / -by) + 1 : 0);
        const out = [];
        for (let s = 0; s < Math.max(0, Math.min(steps, 100000)); s++) {   // cap guards runaway loops
            const k = from + s * by;
            const child = Object.create(scope); child[name] = k;          // child scope: index visible, doesn't leak out
            out.push(tag(`( ${block.id}: ${name}=${r3(k)} )`, own));
            (block.children || []).forEach((c) => out.push(...emit(c, dx, dy, own, child)));
        }
        return out;
    }

    if (def.kind === 'cond') {                 // IF: run the body once, only when the condition resolves true
        const on = resolveBool(block.params.cond, scope);
        const out = [tag(`( ${block.id}: if ${on ? 'true' : 'false'} )`, own)];
        if (on) (block.children || []).forEach((c) => out.push(...emit(c, dx, dy, own, scope)));
        return out;
    }

    const p = resolveParams(block.params, scope);   // motion blocks: resolve expressions → numbers, then kernel

    if (def.kind === 'container') {            // STAMP child(ren) at each point
        const pts = def.points(p);
        const out = [];
        pts.forEach((pt, i) => (block.children || []).forEach((c) => {
            out.push(tag(`( ${block.id}[${i + 1}] @ ${pt.x},${pt.y} )`, own));
            out.push(...emit(c, dx + pt.x, dy + pt.y, own, scope));
        }));
        return out;
    }

    if (def.kind === 'path') {                 // SWEEP a move child along the path
        const pts = def.points(p);
        const clr = num(p.clearance, 5);
        const out = [];
        if (pts.length) out.push(tag(`G0 X${pts[0].x} Y${pts[0].y}   ( ${block.id} start )`, own), tag(`G0 Z${clr}`, own));
        pts.forEach((pt) => (block.children || []).forEach((c) => {
            const cd = BLOCKS[c.type];
            if (cd && cd.step) out.push(tag(cd.step(resolveParams(c.params, scope), pt), [...own, c.id]));  // step swept point
            else out.push(...emit(c, pt.x, pt.y, own, scope));                                              // fallback: stamp
        }));
        out.push(tag(`G0 Z${clr}   ( retract )`, own));
        return out;
    }

    return def.emit(p, dx, dy).map((ln) => tag(ln, own));   // leaf / move standalone
}

/** Fold the program → { text, lines, map }. map[i] = ancestry of block ids producing line i (null = header/footer/seam). */
export function emitMapped(blocks, settings = {}) {
    const clr = num(settings.clearance, 5);
    const scope = Object.create(null);   // top-level variable environment, threaded across the stack
    const T = [
        tag('( DDCS Studio - Blocks )', null),
        ...headerBlock(settings).map((l) => tag(l, null)),
        tag(`G0 Z${clr}   ( clearance )`, null),
    ];
    (blocks || []).forEach((b) => {
        T.push(tag('', null), tag(`( --- ${b.type.toUpperCase()} ${b.id} --- )`, [b.id]));
        T.push(...emit(b, 0, 0, [], scope));
    });
    T.push(tag('', null), ...footerBlock(settings).map((l) => tag(l, null)));
    const lines = T.map((t) => t.line);
    return { text: lines.join('\n'), lines, map: T.map((t) => t.src) };
}

/** Back-compat string projection (callers that only need the text). */
export function emitProgram(blocks, settings = {}) {
    return emitMapped(blocks, settings).text;
}
