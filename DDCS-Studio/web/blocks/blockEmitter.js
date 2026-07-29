/**
 * blocks/blockEmitter.js — the STATELESS block→G-code emitter (recursive fold over a block stack).
 *
 * No state, no subscriptions — it takes blocks and returns G-code. (Program STATE lives in programModel.js;
 * this used to be misnamed "blockModel", which collided with that role.)
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
import { firstRapidXY } from '../wizards/ops/entry.js';   // t726 P2b — THE ONE cut-entry source for the entry fold (shared with the marker)
import { getDialect, DEFAULT_DIALECT, getCaps } from '../wizards/dialects/index.js';
import { num, r3 } from '../wizards/ops/util.js';
import { placeShiftFromParams } from '../wizards/ops/placement.js';
import { translateProgram, rotateProgram, mirrorProgram, relativizeProgram } from '../data/rotateProgram.js';
import { programRotation, flipForSetup } from '../wizards/ops/transform.js';   // t736 — the DECLARED program-level rotation ({angle,pivotX,pivotY}); t879 — the two-sided per-setup FLIP
import { serialBump, serialInline, glyphLibrary } from '../wizards/serialEngrave.js';   // t764 — {SN} dynamic serial: bump + per-digit dispatch + the shared glyph library

let _seq = 0;
/** Fresh block record from a registry type, seeded with that primitive's defaults. */
export function newBlock(type) {
    const def = BLOCKS[type];
    if (!def) throw new Error(`unknown block type: ${type}`);
    const b = { id: `${type}${++_seq}`, type, params: { ...def.defaults } };
    if (['container', 'path', 'loop', 'cond', 'depth', 'fill', 'place', 'rotate', 'skim', 'guard'].includes(def.kind)) b.children = [];
    return b;
}

/** One emitted line + its provenance: src = ancestry [outer…inner] of owning block ids, or null = program-owned. */
// t640 — a line may carry a DECLARED cap requirement (from its source block's params.cap): applyCapGating folds it to a
// comment when the active post lacks that cap (e.g. the ATC pneumatic/drawbar M-codes carry cap:'atc'). Only leaf emit tags a cap.
const tag = (line, src, cap) => (cap ? { line, src, cap } : { line, src });

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

/** The DECLARED geometry extent of the first wrapped atom that can measure itself ({minX,maxX,minY,maxY}), or null.
 *  A container atom (Array) composes its OWN extent with its child's (computed bottom-up), so a hole-pattern reports
 *  the pattern footprint. Recomputed from LIVE params (resolveParams) so placement tracks the geometry — the ONE
 *  source of truth, replacing the placeOnStock bbox SNAPSHOT for migrated atoms. Null (no atom declares an extent, or
 *  a container's child can't measure itself) → the place fold keeps the frozen snapshot, so un-migrated ops are unchanged. */
function liveExtent(blocks, scope) {
    for (const b of (blocks || [])) {
        if (!b) continue;
        const def = BLOCKS[b.type];
        if (!def) continue;
        if (def.extent) {                                   // an atom that knows its own footprint
            const childExt = b.children ? liveExtent(b.children, scope) : null;
            try { const e = def.extent(resolveParams(b.params, scope), childExt); if (e) return e; } catch { /* unmeasurable → fall through to the snapshot */ }
        } else if (b.children) {                            // a transparent wrapper → look inside
            const e = liveExtent(b.children, scope); if (e) return e;
        }
    }
    return null;
}

/** t718 LAYOUT PLACEMENT PARITY — the (x,y,z) placement shift an op's stack BAKES into its emit, exposed so the 2D
 *  layout can draw a twin's previewGeometry PLACED (coincident with the traced toolpath). It walks to the first
 *  kind:'place' block and returns the SAME placeShiftFromParams the place fold uses (line ~188) — NOT re-derived math.
 *  `bboxOverride` (when given) replaces the wrapped geometry's liveExtent: a twin whose previewGeometry is drawn in a
 *  DIFFERENT frame than its emit geometry (drill/bore — the pattern emits 0-relative at x0/y0 but the preview draws it
 *  at originX) passes its OWN origin-inclusive toolpath bbox, so the shift lands the drawn feature's datum corner where
 *  the emit lands it. Ops with origin-inclusive geometry (contour/pocket/…) pass nothing → liveExtent (identical result).
 *  Returns {x:0,y:0,z:0} for an op with no placement (probe ops) so the caller is safe to always call it. */
export function placeShiftOfStack(blocks, bboxOverride = null) {
    const scope = Object.create(null);
    let place = null;
    const walk = (bs) => {
        for (const b of (bs || [])) {
            if (!b) continue;
            const d = BLOCKS[b.type];
            if (d && d.kind === 'place') { place = b; return true; }
            if (b.uiChildren && walk(b.uiChildren)) return true;
            if (b.children && walk(b.children)) return true;
        }
        return false;
    };
    walk(blocks);
    if (!place) return { x: 0, y: 0, z: 0 };
    return placeShiftFromParams(resolveParams(place.params, scope), bboxOverride || liveExtent(place.children, scope));
}

/**
 * t1353 — A REFUSED TRANSFORM MUST NOT VANISH. The whole-program transforms refuse a program carrying parametric
 * motion (registers/expressions in absolute axis words) rather than half-applying one — see parametricMotion in
 * data/rotateProgram.js for the three measured failure modes. Refusing is the safe act; refusing INVISIBLY is not,
 * because the caller asked for a placement/rotation/mirror and would otherwise believe it happened.
 *
 * This is the console for now, deliberately: measured across every registered op there is currently NO absolute
 * register axis word anywhere, so the guard cannot fire in the running app until the switch makes parametric bodies
 * reachable. A preflight/lint surface is the right home the moment it CAN fire — building that UI for a condition
 * nothing can reach yet would be machinery ahead of its case.
 */
function reportRefusal(res, what) {
    if (res && res.refused) { try { console.warn('[DDCS] ' + what + ' skipped — ' + res.refused); } catch (_) { /* no console */ } }
    return res;
}

/** t1359 — the SOLE wrapped child that declares it absorbs its own frame (`absorbsPlacement`), or null. One source,
 *  read by both the place fold and the skim fold, so the two cannot disagree about which children are self-framing.
 *  Deliberately strict: exactly ONE child, declaring it. A mixed body (a self-framing atom beside a literal one) has
 *  no single right answer — the shift would have to be both passed and painted — so it falls through to the text
 *  rewrite, which is what those literal atoms have always used and still works for them. */
function absorbingChild(children) {
    const list = (children || []).filter(Boolean);
    if (list.length !== 1) return null;
    const d = BLOCKS[list[0].type];
    return (d && d.absorbsPlacement) ? list[0] : null;
}

/**
 * t1375 — THE PROGRAM ROTATION AN ATOM WILL ABSORB, or null.
 *
 * The rotation reaches emit() as program CONTEXT because that is the only level it exists at: the `xform` is a flat
 * SIBLING of the ops, not a wrapper, so no fold contains it and no fold could pass it down (t1371 measured this — it is
 * why the placement analogy did not hold). The atom DECLARES whether it can absorb one and says why not when it cannot;
 * a refusal is reported rather than swallowed, and the whole-program pass then refuses the parametric text as well, so
 * the program comes back untouched instead of half-rotated.
 */
function rotationAbsorbedBy(def, p, ctx) {
    if (!ctx || !ctx.angle || !def || !def.absorbsRotation) return null;
    const can = typeof def.absorbsRotation === 'function' ? def.absorbsRotation(p) : def.absorbsRotation;
    if (can !== true) { reportRefusal({ refused: String(can || 'this op does not absorb a program rotation') }, 'rotation absorption'); return null; }
    return { rotAngle: ctx.angle, rotPivotX: ctx.pivotX, rotPivotY: ctx.pivotY };
}

/** Recursive fold → tagged lines. `anc` = ancestry of block ids; `scope` = the variable environment;
 *  `ctx` = PROGRAM-level declarations an atom may absorb (t1375 — the rotation; null for a bare fold). */
function emit(block, dx = 0, dy = 0, anc = [], scope = Object.create(null), dialect = DEFAULT_DIALECT, ctx = null) {
    const def = BLOCKS[block.type];
    const own = [...anc, block.id];            // this block's full ancestry (drives the line→source map)

    // OP CONTAINER (a recorded op: { opType, label, requires, params, children }) — the structure/record for an
    // op (grouping in Blocks + op-form editing). TRANSPARENT at emit: it just emits its children. Gating is done
    // PER LINE (applyCapGating below) — more honest than hiding a whole op: you see every line, with the ones the
    // active post can't run commented out. The op is always kept in the stack.
    if (block.type === 'op') {
        const out = [];
        (block.children || []).forEach((c) => out.push(...emit(c, dx, dy, own, scope, dialect, ctx)));
        return out;
    }

    // Custom-op authoring containers are transparent at emit time: they only group metadata and execution blocks.
    if (block.type === 'user_root') {
        const out = [];
        (block.uiChildren || []).forEach((c) => out.push(...emit(c, dx, dy, own, scope, dialect, ctx)));
        (block.children || []).forEach((c) => out.push(...emit(c, dx, dy, own, scope, dialect, ctx)));
        return out;
    }
    if (block.type === 'param_group' || block.type === 'guard' || block.type === 'section' || block.type === 'setup' || block.type === 'safetraverse' || block.type === 'opunit') {   // t130 — section is transparent (emit its children in order); guard is normally pruned pre-emit; t879 — setup is the two-sided section derivative; t901 — safetraverse is a transparent BUNDLE (emits its composed children: lift + shaped travel + return) → byte-identical to the inline safeTraverseStack it wraps; t1063 — opunit is a DECLARED sub-unit boundary (transparent → byte-identical to the standard atoms loose)
        const out = [];
        (block.children || []).forEach((c) => out.push(...emit(c, dx, dy, own, scope, dialect, ctx)));
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
            (block.children || []).forEach((c) => out.push(...emit(c, dx, dy, own, child, dialect, ctx)));
        }
        return out;
    }

    if (def.kind === 'cond') {                 // IF: run the body once, only when the condition resolves true
        const on = resolveBool(block.params.cond, scope);
        const out = [tag(`( ${def.label} ${on ? 'true' : 'false'} )`, own)];
        if (on) (block.children || []).forEach((c) => out.push(...emit(c, dx, dy, own, scope, dialect, ctx)));
        return out;
    }

    if (def.kind === 'depth') {                // STEP DOWN: run the body once per Z level, exposing scope `z` (negative)
        const ev = (x, d) => { try { return evalExpr(x, scope); } catch { return d; } };
        const to = ev(block.params.to, 5), by = ev(block.params.by, 1) || 1;
        const confirmEvery = Math.max(0, Math.round(ev(block.params.confirmEvery, 0)) || 0);   // t1031 — pause & confirm every N passes (0 = off)
        const levels = depthLevels(to, by);
        const out = [];
        levels.forEach((L, i) => {
            const child = Object.create(scope); child.z = -L; child.by = by;   // t804 — expose `by` too: the fill's depth-entry (ramp/helix) descends exactly one level
            out.push(tag(`( ${def.label} z=${r3(-L)} )`, own));
            (block.children || []).forEach((c) => out.push(...emit(c, dx, dy, own, child, dialect, ctx)));
            // t1031 — pause & confirm after every Nth pass, but NOT after the last (the op is done → no point pausing)
            if (confirmEvery > 0 && (i + 1) % confirmEvery === 0 && i + 1 < levels.length) {
                BLOCKS.pauseconfirm.emit({}, dx, dy, dialect).forEach((ln) => out.push(tag(ln, own)));
            }
        });
        return out;
    }

    if (def.kind === 'fill') {                 // STEP OVER: clear the region at the current depth (auto-cut, or run a per-pass body)
        const p = resolveParams(block.params, scope);
        const z = num(p.z, 0);
        const out = [tag(`( ${p.strategy ? p.strategy + ' fill' : def.label} z=${r3(z)} )`, own)];
        if ((block.children || []).length && def.segments) {           // body present → run it once per pass with {x0,y0,x1,y1} in scope
            def.segments(p).forEach((seg) => {
                const child = Object.create(scope); Object.assign(child, seg);
                block.children.forEach((c) => out.push(...emit(c, dx, dy, own, child, dialect, ctx)));
            });
        } else def.lines(p, z).forEach((ln) => out.push(tag(ln, own)));   // empty body → auto-cut the passes
        out.push(tag(`G0 Z${r3(num(p.clearance, 5))}   ( retract )`, own));
        return out;
    }

    const p = resolveParams(block.params, scope);   // motion blocks: resolve expressions → numbers, then kernel

    if (def.kind === 'place') {                // PLACE ON STOCK: emit the wrapped op, then TRANSLATE its output so
        const inner = [];                      // the path's datum corner lands on the stock-attach corner (+ offset).
        (block.children || []).forEach((c) => inner.push(...emit(c, dx, dy, own, scope, dialect, ctx)));
        // Prefer the wrapped geometry's LIVE declared extent (recomputed from params) over the frozen bbox snapshot —
        // so the placement tracks the pattern (one source of truth). Falls back to the snapshot for un-migrated ops.
        const s = placeShiftFromParams(p, liveExtent(block.children, scope));
        if (!s.x && !s.y && !s.z) return inner;
        // t1359 — A CHILD THAT DECLARES `absorbsPlacement` TAKES THE SHIFT AS PARAMS, and the text is left alone.
        // translateProgram finds a number after an axis letter and writes a different number back: exact on a literal
        // toolpath, destructive on a parametric one. t1349 measured `G0 X0 Y#47` becoming `G0 X50 Y#47` — the X
        // shifted, the register Y not, the raster sheared. So placed geometry is told WHERE IT IS instead of being
        // moved afterwards. (The literal atoms keep the rewrite below; nothing about them changed.)
        const absorber = absorbingChild(block.children);
        if (absorber) {
            const framed = { ...absorber, params: { ...(absorber.params || {}),
                x: num((absorber.params || {}).x, 0) + s.x, y: num((absorber.params || {}).y, 0) + s.y, z0: num((absorber.params || {}).z0, 0) + s.z } };
            return emit(framed, dx, dy, own, scope, dialect, ctx);
        }
        const moved = reportRefusal(translateProgram(inner.map((t) => t.line).join('\n'), s.x, s.y, s.z), 'place-on-stock').text.split('\n');
        return inner.map((t, i) => (t.cap ? { line: moved[i], src: t.src, cap: t.cap } : { line: moved[i], src: t.src }));   // keep each line's provenance (1:1 translate)
    }

    if (def.kind === 'rotate') {               // ROTATE / ALIGN: emit the wrapped op(s), then rotate every absolute XY
        const inner = [];                      // move + arc I/J about the pivot (rotateProgram). The atom behind ⟳ Align.
        (block.children || []).forEach((c) => inner.push(...emit(c, dx, dy, own, scope, dialect, ctx)));
        const ang = num(p.angle, 0), px = num(p.pivotX, 0), py = num(p.pivotY, 0);
        if (!ang) return inner;                // 0° → pass through untouched
        const moved = reportRefusal(rotateProgram(inner.map((t) => t.line).join('\n'), ang, px, py), 'rotate block').text.split('\n');
        return inner.map((t, i) => (t.cap ? { line: moved[i], src: t.src, cap: t.cap } : { line: moved[i], src: t.src }));   // keep each line's provenance (1:1 rotate)
    }

    if (def.kind === 'skim') {                 // SKIM Z-MODE: emit the wrapped body, prepend a clearance LIFT, then
        const inner = [];                      // relativizeProgram the whole thing (abs → G91 deltas from the jog origin
        (block.children || []).forEach((c) => inner.push(...emit(c, dx, dy, own, scope, dialect, ctx)));   // 0,0,0) and wrap G91 … G90. The G53 retract sits OUTSIDE (footer, machine frame).
        const clr = r3(num(p.clearance, 5));
        // t1359 — A CHILD THAT ABSORBS ITS FRAME IS TOLD THE MODE instead of having its text relativized. Relativizing
        // a LOOP is not a harder version of relativizing a list — the deltas are runtime values, so there is nothing in
        // the text to rewrite (t1349 pinned the inter-level retract collapsing to `G0 Z0`: the tool never lifting).
        // The atom reads the live jog position into its own registers and emits ABSOLUTE moves in that frame, so no
        // G91 wrapper is needed or wanted: the program is already relative to wherever the operator jogged to.
        const skimAbsorber = absorbingChild(block.children);
        if (skimAbsorber) {
            const framed = { ...skimAbsorber, params: { ...(skimAbsorber.params || {}), zMode: 'skim', clearance: num(p.clearance, 5) } };
            return emit(framed, dx, dy, own, scope, dialect, ctx);
        }
        const rel = relativizeProgram([`G0 Z${clr}   ( clearance )`, ...inner.map((t) => t.line)].join('\n')).text.split('\n');
        const out = [tag('G91   ( skim - X/Y/Z relative to the jog start )', own), tag(rel[0], own)];   // G91 + the relativized clearance lift (own provenance)
        for (let i = 0; i < inner.length; i++) { const t = inner[i]; out.push(t.cap ? { line: rel[i + 1], src: t.src, cap: t.cap } : { line: rel[i + 1], src: t.src }); }   // relativized body, provenance kept
        out.push(tag('G90   ( absolute )', own));
        return out;
    }

    if (def.kind === 'xform') return [];       // PROGRAM ROTATION (t736): a childless DECLARATION — emits nothing here; it's
                                               // applied ONCE over the whole program in emitMapped (applyProgramTransform).
    if (def.kind === 'flip') return [];        // TWO-SIDED FLIP (t879): a childless DECLARATION — emits nothing here; the mirror
                                               // is applied to the named setup's line range in emitMapped (applySetupFlips).
    if (def.kind === 'entry') return [];       // ENTRY POINT (t726 P2b): a childless MARKER — emits nothing here. The waypoint
                                               // is applied ONCE over the whole program in emitMapped (applyEntryWaypoint), so the
                                               // marker sits as a sibling (no body-index shift → the goldens' positional bindings hold).
    if (def.kind === 'toolsel') {              // TOOL SELECTION (t768): a childless MARKER recording the op's declared tool
        const tn = num(p.toolNum, 0);          // number. t772 P2 — emit `( @TOOL n )` when a tool is declared; applyToolChanges
        return tn > 0 ? [tag(`( @TOOL ${tn} )`, own)] : [];   // consumes it → the change arm on difference. Unset → nothing (byte-identical).
    }

    if (def.kind === 'container') {            // STAMP child(ren) at each point (skip 1-based indices in p.skip)
        const pts = def.points(p);
        const skip = new Set(String(p.skip || '').split(/[ ,]+/).map((s) => parseInt(s, 10)).filter((n) => n > 0));
        const out = [];
        pts.forEach((pt, i) => {
            if (skip.has(i + 1)) return;
            (block.children || []).forEach((c) => {
                out.push(tag(`( ${def.label} ${i + 1} @ ${pt.x},${pt.y} )`, own));
                out.push(...emit(c, dx + pt.x, dy + pt.y, own, scope, dialect, ctx));
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
            else out.push(...emit(c, pt.x, pt.y, own, scope, dialect, ctx));                                // fallback: stamp
        }));
        out.push(tag(`G0 Z${clr}   ( retract )`, own));
        return out;
    }

    // t1375 — AN ATOM THAT ABSORBS THE PROGRAM ROTATION is TOLD the angle and bakes it into the coordinates it emits,
    // the same seam the placement frame and the skim mode already use. Its lines are then STAMPED `rot` — that stamp IS
    // the range map applyProgramTransform reads, declared by the emitter at the moment of emitting rather than
    // reconstructed from the text afterwards, and it rides the line RECORD so the later passes that splice lines in
    // cannot shift it out of alignment.
    const rotAbs = rotationAbsorbedBy(def, p, ctx);
    if (rotAbs) return def.emit({ ...p, ...rotAbs }, dx, dy, dialect).map((ln) => ({ ...tag(ln, own, block.params && block.params.cap), rot: true }));
    return def.emit(p, dx, dy, dialect).map((ln) => tag(ln, own, block.params && block.params.cap));   // leaf / move standalone (dialect = active profile; carry a declared cap requirement)
}

/** Fold the program → { text, lines, map }. map[i] = ancestry of block ids producing line i (null = a seam).
 *  No auto framing: the program is exactly its blocks. A full program begins with a Program Start block and
 *  ends with Program End; a snippet (probe/WCS/comms) simply omits them. Top blocks are blank-line separated. */
// No blank separator lines between top-level blocks. They used to space out high-level ops, but that made the
// projected program's spacing depend on its shape (leaf programs had none, high-level had some) — so a round-trip
// that flattened to leaves dropped them, an inconsistent "line jumps come and go". The program now emits with
// uniform single-line spacing; op structure reads from the marker comments ("( Step Down z=… )", "( Array N @ … )").
// t826 — the safe-Z retract's Expert unset-guard emits a forward-jump label (N<label>). A program can now hold SEVERAL
// safe-Z retracts (per-wall retreats + the error handler), so give each a UNIQUE label in emit order (base 91, unused by any
// wizard) — else duplicate N91s make the guard's GOTO ambiguous. Deterministic (walk order) → the twin + built-in match, and
// this subsumes the cross-op accumulation case (offsetLabels no longer special-cases saferetract). Idempotent (re-run safe).
function uniquifySafeRetractLabels(blocks) {
    let n = 91;
    // t913 — a `safehop` (the capped clearance hop, Expert) carries TWO forward-jump labels (its #520-guard + its cap check);
    // they draw from the SAME counter so a program mixing retracts and hops never collides any N<label>. In the DEFAULT max
    // mode there are NO safehop blocks, so the counter sees only saferetract → 91+ unchanged (byte-identical to B2a).
    const walk = (list) => {
        for (const b of (list || [])) {
            if (!b) continue;
            if (b.type === 'saferetract') { b.params = { ...(b.params || {}), label: n++ }; }
            else if (b.type === 'safehop') { b.params = { ...(b.params || {}), guardLabel: n++, capLabel: n++ }; }
            // t931 — the clearlift FOLDING atom takes labels per its resolved clearMode: max → 1 (the #520 unset-guard, same as
            // a saferetract → byte-identical), hop → 2 (guard + cap, like safehop), plane → 0 (no flow). One shared counter.
            else if (b.type === 'clearlift') {
                const m = b.params && b.params.clearMode;
                if (m === 'plane') { /* no forward-jump labels */ }
                else if (m === 'hop') { b.params = { ...(b.params || {}), guardLabel: n++, capLabel: n++ }; }
                else { b.params = { ...(b.params || {}), guardLabel: n++ }; }
            }
            if (b.children) walk(b.children);
            if (b.uiChildren) walk(b.uiChildren);
        }
    };
    walk(blocks);
}

export function emitMapped(blocks, settings = {}) {
    uniquifySafeRetractLabels(blocks);   // t826 — unique safe-Z guard labels per program (base 91), before the fold
    const dialect = settings.dialect || getDialect(settings.profileId);   // active controller profile → its G-code forms
    const scope = Object.create(null);   // top-level variable environment, threaded across the stack
    const T = [];
    const opRanges = [];                  // t772 P2 — each top-level block = one op; record its [start,end) line range as emitted
    // t1375 — the PROGRAM-level declarations an atom may absorb, read once and threaded down. The rotation is the first:
    // it is a flat sibling of the ops, so context is the only way it can reach the atom that bakes it.
    const ctx = { ...programRotation(blocks) };
    (blocks || []).forEach((b) => { const s = T.length; T.push(...emit(b, 0, 0, [], scope, dialect, ctx)); opRanges.push([s, T.length]); });
    applySetupFlips(T, opRanges, blocks, settings);   // t879 — the two-sided FLIP: mirror each setup-section's own line range (BEFORE tool/entry insert, so opRanges is fresh; mirrorProgram is 1:1 so ranges stay valid). No setup+flip → byte-identical.
    applyToolChanges(T, opRanges, dialect);   // t772 P2 — the DECLARED tool change: per op range, read its @TOOL marker, track the loaded tool, inject the arm (ATC/manual/none) ONLY on a difference. No tool declared → byte-identical.
    applyEntryWaypoint(T, blocks);        // t726 P2b — the DECLARED mill entry point: route the opening rapid through it (no-op unless it moves the cut entry)
    applyProgramTransform(T, blocks);     // t736 — the DECLARED program rotation: rotate the whole emitted program about the pivot (AFTER the entry so that move rotates too; 0°/none → byte-identical)
    applySerialLibrary(T, dialect);       // t764 — expand {SN} markers → the bump (top) + the per-digit dispatch + the glyph library (once per distinct height, after the program end). NO {SN} marker → byte-identical.
    applyModalFeed(T);                    // F is modal — drop it where it just repeats the current feed
    applyCapGating(T, dialect);           // comment out lines the active post can't run (honest per-line gating)
    balanceOwords(T, dialect);            // oword posts: drop orphan o<n> if/endif so structured flow is well-formed
    const lines = T.map((t) => t.line);
    // t1375 — the ABSORBED range map, exposed rather than kept private: it is the emitter's own declaration of which
    // lines already carry the program rotation, so a caller (and the coherence spec) can read it instead of guessing.
    const absorbed = []; T.forEach((t, i) => { if (t.rot) absorbed.push(i); });
    return { text: lines.join('\n'), lines, map: T.map((t) => t.src), absorbed };
}

/** t726 P2b — find the DECLARED entry-point marker anywhere in the stack (a childless `entry` block). */
function findEntryBlock(blocks) {
    for (const b of (blocks || [])) {
        if (!b) continue;
        if (b.type === 'entry') return b;
        const u = b.uiChildren && findEntryBlock(b.uiChildren); if (u) return u;
        const c = b.children && findEntryBlock(b.children); if (c) return c;
    }
    return null;
}

/** t726 P2b — THE MILL ENTRY POINT: if the op declares an entry marker with entryX/entryY set, and they differ from the
 *  program's OWN cut entry (firstRapidXY — the one shared source) beyond ε, insert ONE `G0 X Y` at clearance before the
 *  first cut move. UNSET / within-ε → no change (the emitted text is byte-identical). No entry marker → no-op (probe/etc). */
function applyEntryWaypoint(T, blocks) {
    const e = findEntryBlock(blocks); if (!e || !e.params) return;
    const ex = num(e.params.entryX, NaN), ey = num(e.params.entryY, NaN);
    if (!Number.isFinite(ex) || !Number.isFinite(ey)) return;   // unset → the cut owns its entry
    // t1365 — A DECLARED ENTRY POINT MUST NOT SILENTLY DO NOTHING. `firstRapidXY` reads the program's own cut entry by
    // matching literal numbers after X and Y, which is what every rapid looked like while ops unrolled their geometry
    // in JavaScript. A parametric body opens with `G0 X0 Y#47` — the row's Y is a register the machine fills in — so
    // that returned null and the whole pass RETURNED: the operator dragged the entry square, the emit ignored it, and
    // nothing said so. Measured on surfacing, and it would meet every op the parametric family takes next.
    //
    // The ε-compare is what genuinely cannot be done against a runtime value: there is no way to know at build time
    // whether the declared point is already where the cut starts. So the two cases split by what is KNOWABLE — a
    // literal entry keeps the exact behaviour it has always had (byte-identical), and an unresolvable one honours the
    // declaration, because the operator asked for the waypoint and a rapid to it is the safe act.
    const cut = firstRapidXY(T.map((t) => t.line).join('\n'));
    if (cut) {
        if (Math.abs(ex - cut.x) < 1e-3 && Math.abs(ey - cut.y) < 1e-3) return;   // within ε → byte-identical
        T.splice(cut.index, 0, { line: `G0 X${r3(ex)} Y${r3(ey)}   ( entry )`, src: e.id ? [e.id] : null });   // one waypoint at clearance, before the cut
        return;
    }
    // NOT IN A JOG-RELATIVE OP. A skim program is measured from wherever the operator jogged to, so an ABSOLUTE entry
    // point has nothing to be absolute against — routing through one would drive the tool to a machine position the
    // op never meant. The skim fold is a declared block, so this asks the stack rather than sniffing the text.
    if (hasSkimFold(blocks)) return;
    // the first rapid carrying BOTH axes in ANY form (a number, a register, or an expression) is the cut entry.
    const AX = (ax) => new RegExp(`${ax}\\s*(-?\\d|#|\\[)`);
    const idx = T.findIndex((t) => /\bG0\b/.test(t.line) && AX('X').test(t.line) && AX('Y').test(t.line));
    if (idx < 0) return;
    T.splice(idx, 0, { line: `G0 X${r3(ex)} Y${r3(ey)}   ( entry )`, src: e.id ? [e.id] : null });
}

/** t1365 — does this program carry a SKIM fold (a whole-op jog-relative frame)? Declared, not sniffed. */
function hasSkimFold(blocks) {
    const walk = (bs) => {
        for (const b of (bs || [])) {
            if (!b) continue;
            const d = BLOCKS[b.type];
            if (d && d.kind === 'skim') return true;
            if (b.uiChildren && walk(b.uiChildren)) return true;
            if (b.children && walk(b.children)) return true;
        }
        return false;
    };
    return walk(blocks);
}

/** t736 — THE DECLARED PROGRAM ROTATION: a flat `xform` sibling declares {angle,pivotX,pivotY}; rotate EVERY emitted
 *  absolute XY move + arc I/J about the pivot ONCE over the whole program (data/rotateProgram). 0° / no xform → untouched
 *  (byte-identical). Keeps each line's provenance (1:1 rotate). Runs AFTER the entry waypoint so that move rotates too. */
function applyProgramTransform(T, blocks) {
    const { angle, pivotX, pivotY } = programRotation(blocks);
    if (!angle) return;   // 0° / none → the emit is byte-identical to the un-rotated program
    // t1375 — RANGE-AWARE, on the opRanges precedent. The lines an absorbing atom already rotated carry the emitter's
    // own `rot` stamp; this pass reads that stamp and leaves those lines alone. It NEVER re-scans the text to work out
    // what was rotated — a map inferred from output is exactly how a range drifts and a line gets rotated twice, and a
    // double-rotated coordinate is a plausible-looking wrong part rather than an error.
    const absorbed = []; T.forEach((t, i) => { if (t.rot) absorbed.push(i); });
    const res = reportRefusal(rotateProgram(T.map((t) => t.line).join('\n'), angle, pivotX, pivotY, { absorbed }), 'program rotation');
    const rotated = res.text.split('\n');
    for (let i = 0; i < T.length && i < rotated.length; i++) T[i].line = rotated[i];
}

/** t879 — THE TWO-SIDED FLIP: each top-level `setup` block whose section declares a `flip` child gets its OWN emitted
 *  line range mirrored about the flip axis (data/mirrorProgram, using the declared stock span + thickness). SCOPED per
 *  setup (unlike the whole-program applyProgramTransform) so setup 1 stays put and only setup 2+ mirrors. mirrorProgram is
 *  a 1:1 line map, so opRanges (computed just above, pre tool/entry insert) stays valid. No setup / no flip → byte-identical. */
function applySetupFlips(T, opRanges, blocks, settings) {
    const stock = (settings && settings.stock) || {};
    (blocks || []).forEach((b, i) => {
        if (!b || b.type !== 'setup') return;
        const flip = flipForSetup(blocks, Number((b.params || {}).index));   // the flip sibling that names THIS setup index
        if (!flip || !flip.params) return;
        const axis = flip.params.axis || 'X';
        const [s, e] = opRanges[i] || [];
        if (s == null || e <= s) return;                          // an empty setup → nothing to mirror
        const seg = [];
        for (let k = s; k < e; k++) seg.push(T[k].line);
        const out = reportRefusal(mirrorProgram(seg.join('\n'), axis, stock.x, stock.y, stock.z), 'two-sided flip').text.split('\n');
        for (let k = s; k < e && (k - s) < out.length; k++) T[k].line = out[k - s];   // rewrite in place (length-preserving)
    });
}

/** t772 P2 — parse a `( @TOOL n )` marker (the toolsel block emits one per op that declares a tool). */
function parseToolMarker(line) {
    const m = String(line).match(/\(\s*@TOOL\s+(\d+)\s*\)/);
    return m ? Number(m[1]) : null;
}

/** t772 P2 — the DECLARED per-machine tool-change MODE (settings, profile-carried): atc | manual | none. Read LIVE from
 *  settings (like the ATC inline body). Default DERIVES from the existing "has a tool changer" declaration (hardwareTabs.atc)
 *  → atc when a changer is configured, else manual (an operator swaps by hand). 'none' (pre-staged, no stops) is an opt-in. */
function toolChangeMode() {
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings()) || {};
    const m = s.toolChange && s.toolChange.mode;
    if (m === 'atc' || m === 'manual' || m === 'none') return m;
    return (s.hardwareTabs && s.hardwareTabs.atc) ? 'atc' : 'manual';
}

/** t772 P2 — the tool library row for the change MESSAGE (dia/type/name). Live from settings; null if not in the library. */
function lookupTool(n) {
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings()) || {};
    const tools = (s.atc && s.atc.tools) || [];
    return tools.find((t) => t && Number(t.num) === Number(n)) || null;
}

/** t772 P2 — the change ARM as LINES, by mode. ATC → `T# M6` (the installed T.nc handles the physical change + the runtime
 *  #1300 tool-in-spindle no-op — Studio never guesses physical state). MANUAL → the confirmBlock prompt (dialect-aware: a
 *  scripted HMI prompt, or `( Load … )` + M0 that BLOCKS off-HMI). NONE → an honest comment (pre-stage the tool). */
function toolChangeArm(mode, n, dialect) {
    const t = lookupTool(n);
    const desc = t ? `T${n} - ${(t.dia != null && t.dia !== '') ? t.dia + 'mm ' : ''}${t.type || 'tool'}${t.name ? ' (' + t.name + ')' : ''}` : `T${n}`;
    if (mode === 'atc') return [`( tool change -> ${desc} )`, `T${n} M6`];
    if (mode === 'none') return [`( tool change: load ${desc} - no changer configured; pre-stage the tool before running )`];
    const cf = BLOCKS['confirm'];   // MANUAL — reuse the confirm atom's dialect-aware emit (block-degrades to a message + M0)
    return cf ? cf.emit({ msg: `Load ${desc}`, mode: 1, cancel: 2, pauseOnDegrade: true }, 0, 0, dialect) : [`( Load ${desc} )`, 'M0'];
}

/** t772 P2 — THE TOOL CHANGE PASS: each op (a top-level block, its line range from the emit loop) that declares a tool
 *  carries a `( @TOOL n )` marker. Track the modal loaded tool across the program and inject the change arm at the op's START
 *  ONLY on a DIFFERENCE (loaded starts null → the first declared tool ALWAYS arms; Studio never guesses physical state — a
 *  consecutive SAME tool resolves Studio-side to zero emit, and the runtime no-ops a redundant change). An op with NO declared
 *  tool keeps the loaded tool (no arm). The @TOOL marker is always consumed (never leaks). No tool anywhere → byte-identical. */
function applyToolChanges(T, opRanges, dialect) {
    if (!T.some((t) => parseToolMarker(t.line) != null)) return;   // no declared tool anywhere → byte-identical, no work
    const mode = toolChangeMode();
    const out = [];
    let loaded = null, cursor = 0;
    for (const [start, end] of opRanges) {
        while (cursor < start) { out.push(T[cursor++]); }   // any lines before this op (none in practice — ranges tile T)
        let toolNum = null; const body = [];
        for (let k = start; k < end; k++) {
            const n = parseToolMarker(T[k].line);
            if (n != null) toolNum = n; else body.push(T[k]);   // read + strip the marker; keep the rest verbatim
        }
        if (toolNum != null && toolNum !== loaded) out.push(...toolChangeArm(mode, toolNum, dialect).map((line) => ({ line, src: null })));   // a change point → the arm before the op body
        if (toolNum != null) loaded = toolNum;
        out.push(...body);
        cursor = end;
    }
    while (cursor < T.length) { out.push(T[cursor++]); }
    T.splice(0, T.length, ...out);
}

/** t764 — parse a self-describing `( @SN … )` marker (fillText emits one per {SN} placement per fill level). */
function parseSnMarker(line) {
    if (!line || !/\(\s*@SN\b/.test(line)) return null;
    const g = (k) => { const m = line.match(new RegExp('\\b' + k + '=(-?[0-9.]+)')); return m ? Number(m[1]) : null; };
    return { slot: g('slot'), count: g('count'), inc: g('inc'), x: g('x'), y: g('y'), h: g('h'), w: g('w'), depth: g('depth'), feed: g('feed'), plunge: g('plunge'), clr: g('clr') };
}

/** t764 — expand the {SN} markers into the DYNAMIC serial macro at PROGRAM scope: the counter bump ONCE at the top, the
 *  per-digit dispatch inline at each placement, and the glyph library ONCE per DISTINCT height (after the program end).
 *  Dedups a placement across fill levels (keeps the deepest → one engraving at full depth). NO {SN} marker → byte-identical.
 *  Non-DDCS posts (no persistent uservar) DEGRADE: the marker is dropped with an honest note — no dynamic serial. */
function applySerialLibrary(T, dialect) {
    const marks = [];
    T.forEach((t, i) => { const m = parseSnMarker(t.line); if (m && m.slot != null) marks.push({ ...m, i }); });
    if (!marks.length) return;
    // Which posts run the macro (persistent #vars · WHILE · IF/GOTO · M98 subs)? The DDCS uservar controllers only
    // (Expert / V4.1 / DM500 — t758); grbl / centroid / rs274 use a different macro dialect → DEGRADE honestly.
    const supports = !dialect || String(dialect.id || '').startsWith('ddcs-');
    if (!supports) {
        const body = T.map((t) => parseSnMarker(t.line) ? { line: '( {SN}: dynamic serial needs a DDCS Expert/V4.1/DM500 controller — this post has no persistent-var macro; type a fixed serial instead )', src: t.src } : t);
        T.splice(0, T.length, ...body);
        return;
    }
    // dedup by placement (slot,x,y) → keep the DEEPEST depth (one engraving at full depth); a distinct (h,w) → a distinct set.
    const kept = new Map();
    for (const m of marks) { const k = `${m.slot}|${m.x}|${m.y}`; const c = kept.get(k); if (!c || m.depth > c.depth) kept.set(k, m); }
    const sets = new Map(); let si = 0;
    for (const m of kept.values()) { const sk = `${m.h}|${m.w}`; if (!sets.has(sk)) sets.set(sk, si++); }
    const slots = new Map(); for (const m of kept.values()) if (!slots.has(m.slot)) slots.set(m.slot, m.inc);
    // rebuild T: bump(s) at top · body (kept marker → the inline, duplicates dropped) · the glyph libraries after the end
    const bump = [...slots].flatMap(([slot, inc]) => serialBump(slot, inc)).map((l) => ({ line: l, src: null }));
    const body = [];
    T.forEach((t, i) => {
        const m = parseSnMarker(t.line);
        if (!m) { body.push(t); return; }
        const keptM = kept.get(`${m.slot}|${m.x}|${m.y}`);
        if (keptM && keptM.i === i) for (const l of serialInline(m.slot, m.count, m.x, m.y, sets.get(`${m.h}|${m.w}`))) body.push({ line: l, src: t.src });
        // else: a duplicate (shallower-level) marker for the same placement → drop it
    });
    const lib = [];
    for (const [sk, setIndex] of sets) { const m = [...kept.values()].find((x) => `${x.h}|${x.w}` === sk); lib.push(...glyphLibrary(setIndex, m.h, m.w, { feed: m.feed, plunge: m.plunge, clearance: m.clr, depth: m.depth }).map((l) => ({ line: l, src: null }))); }
    T.splice(0, T.length, ...bump, ...body, ...lib);
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

/** Per-line capability gating: on a post that can't run #variables / in-program flow (grbl), comment out the
 *  lines it can't execute, keeping the op's RECORD intact (the op-container stays in the stack). Honest over
 *  hiding — you see every line, with the non-runnable ones commented. Posts that run #vars + flow (DDCS / V4.1 /
 *  DM500 / LinuxCNC / grblHAL) gate nothing. (Per-line can leave a lone runnable move — inherent to macro work.) */
function applyCapGating(T, dialect) {
    const caps = getCaps(dialect.id);
    // t640 — NO blanket early-return. The old `if (caps.vars && caps.flow !== 'none') return` assumed "#vars + flow ⇒ fully
    // capable ⇒ nothing to gate", but a post can run #vars + flow yet LACK other caps (atc/pneumatic, …) → Expert-only ATC
    // drawbar M-codes slipped straight through onto V4.1/DM500. Run per-line gating ALWAYS; on a fully-capable post (Expert:
    // every cap ON) every branch below is false → a true no-op (byte-identical). Cheap: one linear pass.
    for (const t of T) {
        const code = (t.line || '').trim();
        if (!code || code.startsWith('(') || code.startsWith(';')) continue;   // blank / already a comment
        // (1) DECLARED cap gate: the source block asked for a cap the active post lacks (declare-not-infer — e.g. the ATC
        //     pneumatic/drawbar M-codes carry cap:'atc'; V4.1/DM500 have caps.atc=false → fold the line to an honest comment).
        if (t.cap && !caps[t.cap]) { t.line = `( gated: ${code.replace(/[()]/g, '').trim()} )`; continue; }
        // (2) #vars / flow the post can't run.
        const hasVar = /#\d|#\[/.test(code);
        const isFlow = /^(IF\b|GOTO\b|N\d|o\d+ )/.test(code);
        if ((!caps.vars && hasVar) || (caps.flow === 'none' && (isFlow || hasVar))) {
            t.line = `( gated: ${code.replace(/[()]/g, '').trim()} )`;   // comment out the non-runnable line
        }
    }
}

/** O-word well-formedness for flow:'oword' posts (LinuxCNC / grblHAL). There, ifGoto→`o<n> if [neg]`,
 *  label→`o<n> endif`, and goto/probecheck fold to nothing (G38.2 ALARMs on no-contact, so the status-skip is
 *  moot). A folded ifGoto/goto leaves its target label's `o<n> endif` with no matching `o<n> if` (orphan) → the
 *  structured flow won't parse. This drops the orphans so the o-words are balanced and render cleanly.
 *  STACK-based (t646): each `o<n> endif` closes the nearest still-open `o<n> if`; an endif with no open if of its
 *  number is the orphan (dropped), and an if never closed is dropped too. Unlike the old Set-membership test, this
 *  stays correct when the SAME number is reused by a real pair AND a folded orphan (e.g. comm's cancel label — t632 —
 *  colliding with a probe wizard's o9): a real pair FOLLOWED by a same-number orphan keeps the pair, drops the orphan.
 *  The fail-branch guard degrades gracefully (the controller alarms instead). GOTO posts (Expert/V4.1/DM500) untouched. */
function balanceOwords(T, dialect) {
    if (getCaps(dialect.id).flow !== 'oword') return;
    const open = [];         // stack of {n, i} for each currently-unclosed `o<n> if`
    const drop = new Set();  // T indices to remove
    for (let i = 0; i < T.length; i++) {
        const s = (T[i].line || '').trim();
        let m = s.match(/^o(\d+)\s+if\b/);
        if (m) { open.push({ n: m[1], i }); continue; }
        m = s.match(/^o(\d+)\s+endif$/);
        if (!m) continue;
        let k = -1;
        for (let j = open.length - 1; j >= 0; j--) if (open[j].n === m[1]) { k = j; break; }   // nearest open if of the same number
        if (k >= 0) open.splice(k, 1);   // matched pair — keep both
        else drop.add(i);                // orphan endif — no open if of this number
    }
    for (const { i } of open) drop.add(i);   // an `o<n> if` never closed — drop it too
    for (let i = T.length - 1; i >= 0; i--) if (drop.has(i)) T.splice(i, 1);   // remove orphans (line + its map entry)
}

/** Back-compat string projection (callers that only need the text). */
export function emitProgram(blocks, settings = {}) {
    return emitMapped(blocks, settings).text;
}
