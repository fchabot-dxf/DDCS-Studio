/**
 * viz/opSimStarts.js — the SIM-START registry: a declared op-type → per-pass PREVIEW-START inference.
 *
 * "Declare, never infer" applied to the per-pass start MARKERS. A multi-pass probe macro (a boss-both, an alignment A→B,
 * a 3-point rotary fit) repositions between passes, so the preview shows one draggable start marker ①②③④ per pass. WHERE
 * each pass starts used to be inferred AD-HOC by a per-wizard `inferStarts(params, stock)` method, with no shared home —
 * the one remaining wizard→engine leak in an otherwise declared sim side. This module is that single home: every consumer
 * (the wizard's own `inferStarts` delegate today; a generic preview later) asks `opSimStarts(opType, params, stock)`.
 *
 * Shaped as a REGISTRY (the same federated pattern as opSimContext / builderOf-specOf): a pristine BUILT-IN layer (the
 * inference we authored, MOVED here verbatim — behaviour-preserving) + a USER_* layer so the WIZARD MAKER plugs into the
 * SAME seam: a custom op DECLARES its sim-starts (never inferred from motion) and registers a provider via
 * `setUserSimStarts`. Built-ins use the static map; custom ops use their declared provider; everything else returns null
 * (the caller falls back to a single start). Pure + side-effect-free, so it's testable as plain data.
 *
 * Scope (increment 1): MOVE the existing multi-pass inference (middle / alignment / rotary_center). The custom-op path is
 * shaped (setUserSimStarts) but not yet driven from `def.sim` — `def.sim` declares preview INTENT (rotary rig / machine /
 * magazine), not starts, so wiring a declared sim-starts spec is a follow-up (see WORK-LOG / the userOps note).
 */

import { num } from '../wizards/ops/util.js';

const n = (v, d) => num(v, d);

// ── BUILT-IN per-pass start inference (MOVED verbatim from the wizards; pure (params, stock) → [{x,y,z}, …]) ───────────
const BUILT_IN = {
    // MIDDLE — boss/pocket centre. Pocket = 1 pass (centre). Boss: in-axis manual → each wall its own pass; the trans
    // pass (auto or manual) adds the secondary marker(s). The pass count MUST mirror the macro's reposition() calls.
    middle(params, stock) {
        const sx = n(stock && stock.x, 100), sy = n(stock && stock.y, 80), sz = n(stock && stock.z, 20);
        const cx = sx / 2, cy = sy / 2, probeZ = -Math.min(5, sz * 0.5);
        const centre = { x: cx, y: cy, z: probeZ };
        const boss = (params.featureType || 'pocket') === 'boss';
        const twoAxis = !!params.twoAxis || !!params.findBoth;
        const inAxisManual = (params.inAxis || params.approach) === 'manual';   // the IN-axis toggle drives the per-axis pass count
        const axis = (params.axis || 'X') === 'Y' ? 'Y' : 'X';
        const second = axis === 'X' ? 'Y' : 'X';
        const dir1Plus = (params.dir1 || 'pos') === 'pos';
        const dir2Plus = (typeof params.dir2 === 'string' ? params.dir2 : (dir1Plus ? 'neg' : 'pos')) === 'pos';
        const outset = Math.max(6, Math.min(n(params.dist, 20) * 0.6, 15));
        const outside = (ax, plus) => ax === 'X'
            ? { x: plus ? -outset : sx + outset, y: cy, z: probeZ }
            : { x: cx, y: plus ? -outset : sy + outset, z: probeZ };

        if (!boss) return [centre];                                  // pocket: always one pass, from the centre
        const prim = inAxisManual ? [outside(axis, dir1Plus), outside(axis, !dir1Plus)] : [outside(axis, dir1Plus)];
        if (!twoAxis) return prim;                                   // single-axis: in-axis manual → 2 walls, auto → 1
        const sec = inAxisManual ? [outside(second, dir2Plus), outside(second, !dir2Plus)] : [outside(second, dir2Plus)];
        return [...prim, ...sec];                                    // the trans pass (auto or manual) always adds the secondary marker(s)
    },

    // ALIGNMENT — probe A, reposition (jog to B along the fence), probe B → 2 passes. Spread A/B along the checkAxis so
    // both markers are DISTINCT (else both probes start at the same spot). Probe height = just above the stock top.
    alignment(params, stock) {
        const sx = n(stock && stock.x, 150), sy = n(stock && stock.y, 100), sz = n(stock && stock.z, 25);
        const checkAxis = (params && params.checkAxis) === 'Y' ? 'Y' : 'X';   // fence runs along this
        const z = Math.min(5, sz * 0.5);
        if (checkAxis === 'X') {
            // Fence along X → A and B differ in X (spread along X), near the +Y edge; probe moves in Y.
            return [{ x: sx * 0.3, y: sy * 0.85, z }, { x: sx * 0.7, y: sy * 0.85, z }];
        }
        // Fence along Y → A and B differ in Y; probe moves in X.
        return [{ x: sx * 0.85, y: sy * 0.3, z }, { x: sx * 0.85, y: sy * 0.7, z }];
    },

    // ROTARY_CENTER — KNOWN = 1 hands-free pass; FIT repositions twice → 3 passes, spread to DISTINCT points around the
    // bar (cylinder along X, cross-section in Y-Z; top-at-0 preview → centreline at Z = -R) so the circle solve isn't
    // degenerate: pass 0 = over the TOP at centreline (probe down Z); pass 1/2 = the +Y / -Y flanks (probe in Y).
    rotary_center(params, stock) {
        const sx = n(stock && stock.x, 150), sy = n(stock && stock.y, 76), sz = n(stock && stock.z, 76);
        const cx = sx / 2, cy = sy / 2;
        const R = Math.min(sy, sz) / 2;                 // bar radius (cross-section = min of the two cross dims)
        const retract = n(params && params.retract, 2);
        const top = { x: cx, y: cy, z: Math.min(5, sz * 0.5) };   // above the top, ready to probe down
        const method = (params && params.method) === 'fit' ? 'fit' : 'known';
        if (method !== 'fit') return [top];
        const flankZ = -R;                              // centreline height in the top-at-0 preview frame
        return [
            top,
            { x: cx, y: cy + R + retract, z: flankZ },  // +Y flank, beside the bar at centreline height
            { x: cx, y: cy - R - retract, z: flankZ },  // -Y flank
        ];
    },
};

// ── USER_* layer: a custom op DECLARES its per-pass sim-starts and registers a provider here (the wizard-maker seam) ───
// A provider is `(params, stock) => [{x,y,z}, …]`. The DECLARED-spec → provider wiring (read def.sim) is the follow-up;
// for now userOps can register a provider directly. Mirrors opSimContext's USER_INTENT / setUserSimIntent.
const USER_STARTS = new Map();

/** Register (or clear with provider=null) a custom op's per-pass sim-start provider. Called by userOps on
 *  register/delete so a user_* op gets per-pass markers from its DECLARED intent, never inferred from its motion. */
export function setUserSimStarts(opType, provider) {
    if (typeof provider === 'function') USER_STARTS.set(opType, provider); else USER_STARTS.delete(opType);
}

// ── makeProvider: a DECLARED `def.sim.starts` ROWS spec → a (params, stock) ⇒ [{x,y,z}…] provider (Option A, blessed) ────
// Each ROW = one pass. The human-blessed bounded vocabulary:
//   anchor : 'centre' | 'edge'(axis,side,out) | 'frac'(fx,fy) | 'radial'(axis,sign,r)
//   plane  : 'top' (above the top, +z) | 'probe' (below the top, into the stock) | '@flank' (= -R, the bar centreline) | <number>
//   side/out/r : a literal OR an @token from the bound set { @dir1 @dir2 @outset @R }
//   when   : { param, is } — optional; the row only contributes when params[param] matches (the conditional pass count)
// PURE: it derives the SAME scope the built-ins use (sx/sy/sz, cx/cy, outset, R) so a built-in's pattern is expressible as
// rows (proof-of-sufficiency). Unknown picks degrade to the stock centre — never throws (valid-by-construction).
const TOK = (v, ctx) => {
    if (typeof v !== 'string' || v[0] !== '@') return v;          // a literal passes through untouched
    switch (v) {
        case '@dir1': return ctx.params.dir1;
        case '@dir2': return ctx.params.dir2;
        case '@outset': return ctx.outset;
        case '@R': return ctx.R;
        default: return v;
    }
};

const planeZ = (p, ctx) => {
    if (typeof p === 'number') return p;
    if (p === 'top') return Math.min(5, ctx.sz * 0.5);            // above the top, ready to probe down
    if (p === 'probe') return -Math.min(5, ctx.sz * 0.5);         // just below the top, into the stock
    if (p === '@flank') return -ctx.R;                            // the bar centreline (top-at-0 frame)
    return 0;
};

const rowToStart = (row, ctx) => {
    const z = planeZ(row.plane, ctx);
    const { sx, sy, cx, cy } = ctx;
    switch (row.anchor) {
        case 'edge': {
            const axis = row.axis === 'Y' ? 'Y' : 'X';
            const side = TOK(row.side, ctx);                      // 'pos'/'min' → the -out side; 'neg'/'max' → the +out side
            const minSide = side === 'pos' || side === 'min';     // matches the built-in outside(): pos ⇒ -out
            const out = n(TOK(row.out, ctx), 0);
            const coord = minSide ? -out : (axis === 'X' ? sx : sy) + out;
            return axis === 'X' ? { x: coord, y: cy, z } : { x: cx, y: coord, z };
        }
        case 'frac':
            return { x: sx * n(row.fx, 0.5), y: sy * n(row.fy, 0.5), z };
        case 'radial': {
            const axis = row.axis === 'X' ? 'X' : 'Y';
            const r = n(TOK(row.r, ctx), 0) * (row.sign === '-' ? -1 : 1);
            return axis === 'X' ? { x: cx + r, y: cy, z } : { x: cx, y: cy + r, z };
        }
        case 'centre':
        default:
            return { x: cx, y: cy, z };
    }
};

const whenOk = (when, params) => {
    if (!when) return true;
    const v = (params || {})[when.param];
    return typeof when.is === 'boolean' ? !!v === when.is : v === when.is;
};

/** A DECLARED `def.sim.starts` rows spec → a per-pass provider (params, stock) ⇒ [{x,y,z}…]. Register via setUserSimStarts. */
export function makeProvider(rows) {
    const spec = Array.isArray(rows) ? rows : [];
    return (params, stock) => {
        const sx = n(stock && stock.x, 100), sy = n(stock && stock.y, 80), sz = n(stock && stock.z, 20);
        const dist = n(params && params.dist, 20);
        const ctx = {
            sx, sy, sz, cx: sx / 2, cy: sy / 2,
            outset: Math.max(6, Math.min(dist * 0.6, 15)),        // the standard stand-off (matches built-in middle)
            R: Math.min(sy, sz) / 2,                              // bar radius (matches built-in rotary)
            params: params || {},
        };
        const out = [];
        for (const row of spec) if (whenOk(row.when, params)) out.push(rowToStart(row, ctx));
        return out;
    };
}

/**
 * The per-pass preview-start markers for an op: a registered custom op uses its DECLARED provider; a built-in uses the
 * MOVED static inference; everything else returns null (the caller falls back to a single inferStart). The returned
 * array's length is the pass count (one draggable ①②③④ marker per pass) — it MUST mirror the macro's reposition() calls.
 */
export function opSimStarts(opType, params, stock) {
    const u = USER_STARTS.get(opType);
    if (u) return u(params || {}, stock || {});
    const b = BUILT_IN[opType];
    return b ? b(params || {}, stock || {}) : null;
}
