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
import { BLOCKS, evalExpr, depthLevels } from '../wizards/ops/index.js';
import { getDialect, DEFAULT_DIALECT, getCaps } from '../wizards/dialects/index.js';
import { num, r3 } from '../wizards/ops/util.js';

let _seq = 0;
/** Fresh block record from a registry type, seeded with that primitive's defaults. */
export function newBlock(type) {
    const def = BLOCKS[type];
    if (!def) throw new Error(`unknown block type: ${type}`);
    const b = { id: `${type}${++_seq}`, type, params: { ...def.defaults } };
    if (['container', 'path', 'loop', 'cond', 'depth', 'fill'].includes(def.kind)) b.children = [];
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
function emit(block, dx = 0, dy = 0, anc = [], scope = Object.create(null), dialect = DEFAULT_DIALECT) {
    const def = BLOCKS[block.type];
    const own = [...anc, block.id];            // this block's full ancestry (drives the line→source map)

    // OP CONTAINER (a recorded op: { opType, label, requires, params, children }). Caps-gated: on a post whose
    // capabilities can't run the op (e.g. a probe/ATC macro on grbl — no #vars) emit ONE marker comment and keep
    // the op in the stack (switch to a capable post → it re-emits in full). On a capable post it's transparent —
    // the children emit exactly as before, so capable-post output is unchanged.
    if (block.type === 'op') {
        const caps = getCaps(dialect.id);
        const has = (r) => (r === 'flow' ? caps.flow !== 'none' : caps[r] !== false);
        const unmet = (block.requires || []).filter((r) => !has(r));
        if (unmet.length) {
            const label = block.label || block.opType || 'op';
            return [tag(`( ${label} - not emitted on ${dialect.name}: needs ${unmet.join(' + ')}; op kept, switch post to emit )`, own)];
        }
        const out = [];
        (block.children || []).forEach((c) => out.push(...emit(c, dx, dy, own, scope, dialect)));
        return out;
    }

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
            out.push(tag(`( ${def.label} ${name}=${r3(k)} )`, own));
            (block.children || []).forEach((c) => out.push(...emit(c, dx, dy, own, child, dialect)));
        }
        return out;
    }

    if (def.kind === 'cond') {                 // IF: run the body once, only when the condition resolves true
        const on = resolveBool(block.params.cond, scope);
        const out = [tag(`( ${def.label} ${on ? 'true' : 'false'} )`, own)];
        if (on) (block.children || []).forEach((c) => out.push(...emit(c, dx, dy, own, scope, dialect)));
        return out;
    }

    if (def.kind === 'depth') {                // STEP DOWN: run the body once per Z level, exposing scope `z` (negative)
        const ev = (x, d) => { try { return evalExpr(x, scope); } catch { return d; } };
        const to = ev(block.params.to, 5), by = ev(block.params.by, 1) || 1;
        const out = [];
        for (const L of depthLevels(to, by)) {
            const child = Object.create(scope); child.z = -L;          // child scope: cut Z visible to the body, doesn't leak out
            out.push(tag(`( ${def.label} z=${r3(-L)} )`, own));
            (block.children || []).forEach((c) => out.push(...emit(c, dx, dy, own, child, dialect)));
        }
        return out;
    }

    if (def.kind === 'fill') {                 // STEP OVER: clear the region at the current depth (auto-cut, or run a per-pass body)
        const p = resolveParams(block.params, scope);
        const z = num(p.z, 0);
        const out = [tag(`( ${p.strategy ? p.strategy + ' fill' : def.label} z=${r3(z)} )`, own)];
        if ((block.children || []).length && def.segments) {           // body present → run it once per pass with {x0,y0,x1,y1} in scope
            def.segments(p).forEach((seg) => {
                const child = Object.create(scope); Object.assign(child, seg);
                block.children.forEach((c) => out.push(...emit(c, dx, dy, own, child, dialect)));
            });
        } else def.lines(p, z).forEach((ln) => out.push(tag(ln, own)));   // empty body → auto-cut the passes
        out.push(tag(`G0 Z${r3(num(p.clearance, 5))}   ( retract )`, own));
        return out;
    }

    const p = resolveParams(block.params, scope);   // motion blocks: resolve expressions → numbers, then kernel

    if (def.kind === 'container') {            // STAMP child(ren) at each point (skip 1-based indices in p.skip)
        const pts = def.points(p);
        const skip = new Set(String(p.skip || '').split(/[ ,]+/).map((s) => parseInt(s, 10)).filter((n) => n > 0));
        const out = [];
        pts.forEach((pt, i) => {
            if (skip.has(i + 1)) return;
            (block.children || []).forEach((c) => {
                out.push(tag(`( ${def.label} ${i + 1} @ ${pt.x},${pt.y} )`, own));
                out.push(...emit(c, dx + pt.x, dy + pt.y, own, scope, dialect));
            });
        });
        return out;
    }

    if (def.kind === 'path') {                 // SWEEP a move child along the path
        const pts = def.points(p);
        const clr = num(p.clearance, 5);
        const out = [];
        if (pts.length) out.push(tag(`G0 X${pts[0].x} Y${pts[0].y}   ( ${def.label} start )`, own), tag(`G0 Z${clr}`, own));
        pts.forEach((pt) => (block.children || []).forEach((c) => {
            const cd = BLOCKS[c.type];
            if (cd && cd.step) out.push(tag(cd.step(resolveParams(c.params, scope), pt), [...own, c.id]));  // step swept point
            else out.push(...emit(c, pt.x, pt.y, own, scope, dialect));                                     // fallback: stamp
        }));
        out.push(tag(`G0 Z${clr}   ( retract )`, own));
        return out;
    }

    return def.emit(p, dx, dy, dialect).map((ln) => tag(ln, own));   // leaf / move standalone (dialect = active profile)
}

/** Fold the program → { text, lines, map }. map[i] = ancestry of block ids producing line i (null = a seam).
 *  No auto framing: the program is exactly its blocks. A full program begins with a Program Start block and
 *  ends with Program End; a snippet (probe/WCS/comms) simply omits them. Top blocks are blank-line separated. */
// No blank separator lines between top-level blocks. They used to space out high-level ops, but that made the
// projected program's spacing depend on its shape (leaf programs had none, high-level had some) — so a round-trip
// that flattened to leaves dropped them, an inconsistent "line jumps come and go". The program now emits with
// uniform single-line spacing; op structure reads from the marker comments ("( Step Down z=… )", "( Array N @ … )").
export function emitMapped(blocks, settings = {}) {
    const dialect = settings.dialect || getDialect(settings.profileId);   // active controller profile → its G-code forms
    const scope = Object.create(null);   // top-level variable environment, threaded across the stack
    const T = [];
    (blocks || []).forEach((b) => { T.push(...emit(b, 0, 0, [], scope, dialect)); });
    applyModalFeed(T);                    // F is modal — drop it where it just repeats the current feed
    const lines = T.map((t) => t.line);
    return { text: lines.join('\n'), lines, map: T.map((t) => t.src) };
}

/** Feedrate is modal in G-code: once set it sticks until changed. The kernels emit F on every cutting line
 *  (simple + always correct); this folds out an F *attached to a motion word* that merely repeats the current
 *  modal feed — the way a CAM post does — so a 150-pass fill shows F once per change, not 150 times. Only a
 *  plain-number F folds; an F#var / F[expr] (probe feeds) is kept and clears tracking so the next numeric F
 *  always shows. gcodeToStack mirrors this (backfills the modal feed) so the round-trip stays byte-exact. */
function applyModalFeed(T) {
    let modalF = null;
    for (const t of T) {
        const m = t.line.match(/ F(-?\d+(?:\.\d+)?)\b/);   // F attached to a motion line (leading space), not a bare "F300"
        if (m) {
            const f = Number(m[1]);
            if (modalF !== null && f === modalF) t.line = t.line.slice(0, m.index) + t.line.slice(m.index + m[0].length);
            else modalF = f;
        } else if (/ F[#[]/.test(t.line)) {
            modalF = null;   // a #var/[expr] feed — can't fold; force the next numeric F to show
        }
    }
}

/** Back-compat string projection (callers that only need the text). */
export function emitProgram(blocks, settings = {}) {
    return emitMapped(blocks, settings).text;
}
