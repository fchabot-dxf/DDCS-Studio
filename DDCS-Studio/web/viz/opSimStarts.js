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
import { barRadius } from '../engine/probeGeometry.js';   // SPATIAL-MODEL inc2: the declared bar radius (stock.diameter ?? min(cross)/2)
import { whenOk } from '../blocks/whenGuard.js';   // the ONE guard evaluator (shared with the emit-side prune) — declare-never-infer
import { projectWorkpiece } from '../engine/workpiece.js';   // t385 — a middle probe's CENTRE start = the workpiece pocket centre (its physical pos), so it starts INSIDE an OFF-CENTRE cavity

const n = (v, d) => num(v, d);

// t385 (human) — the INSIDE feature (pocket/bore) physical CENTRE, or null (a boss / no inside feature → the caller uses the
// stock centre). A middle probe finds a pocket, so its sim START must sit AT the pocket centre — the probe-stop only fires from
// INSIDE the cavity, so an OFF-CENTRE pocket needs the start to follow its pos (else the probe starts outside → never stops).
const insideCentre = (stock) => { try { const wp = projectWorkpiece(stock); const f = (wp.features || []).find((x) => x && x.side === 'inside' && x.pos); return f ? { x: +f.pos.x, y: +f.pos.y } : null; } catch (_) { return null; } };

// ── BUILT-IN per-pass start inference (MOVED verbatim from the wizards; pure (params, stock) → [{x,y,z}, …]) ───────────
const BUILT_IN = {
    // MIDDLE — boss/pocket centre. Pocket = 1 pass (centre). Boss: in-axis manual → each wall its own pass; the trans
    // pass (auto or manual) adds the secondary marker(s). The pass count MUST mirror the macro's reposition() calls.
    middle(params, stock) {
        const sx = n(stock && stock.x, 100), sy = n(stock && stock.y, 80), sz = n(stock && stock.z, 20);
        // t385 — a POCKET's centre = the workpiece feature's physical pos (follows an off-centre pocket); a boss / no inside
        // feature → the stock centre (unchanged). The centre pass + the boss perpendicular both use cx/cy.
        const ic = insideCentre(stock), cx = ic ? ic.x : sx / 2, cy = ic ? ic.y : sy / 2, probeZ = -Math.min(5, sz * 0.5);
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

        // probe-Z-first: DECLARE the Z-surface probe as its OWN leading pass — over the stock top (z ABOVE the surface,
        // probing DOWN), so the sim renders Z-pass → reposition → XY-passes. Mirrors the macro's Z block + reposition().
        const lead = params.probeZ ? [{ x: cx, y: cy, z: Math.min(5, sz * 0.5) }] : [];

        if (!boss) return [...lead, centre];                         // pocket: [Z?] then one pass from the centre
        const prim = inAxisManual ? [outside(axis, dir1Plus), outside(axis, !dir1Plus)] : [outside(axis, dir1Plus)];
        if (!twoAxis) return [...lead, ...prim];                     // single-axis: in-axis manual → 2 walls, auto → 1 (+ Z?)
        const sec = inAxisManual ? [outside(second, dir2Plus), outside(second, !dir2Plus)] : [outside(second, dir2Plus)];
        return [...lead, ...prim, ...sec];                           // [Z?] + primary + the trans pass (auto or manual) secondary
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
    // degenerate: pass 0 = over the TOP at centreline (probe down Z); pass 1/2 = the flanks (probe in Y).
    // The start SIDE must match the macro's probe DIRECTION so the touch moves INTO the bar (t141): macro P2 probes +Y
    // → start the −Y side (probe toward the bar, hit the −Y OD); P3 probes −Y → start the +Y side. (Was swapped → the
    // probe ran AWAY from the bar → a miss → degenerate fit. With the real DRO + correct sides → R≈R_true, centre right.)
    rotary_center(params, stock) {
        const sx = n(stock && stock.x, 150), sy = n(stock && stock.y, 76), sz = n(stock && stock.z, 76);
        const cx = sx / 2, cy = sy / 2;
        const R = barRadius(stock, sy, sz);             // SPATIAL-MODEL inc2: declared stock.diameter wins, else min(cross)/2 (the bar)
        const retract = n(params && params.retract, 2);
        const tipR = n(params && params.radius, 2);                // stylus tip radius (#6)
        const safeZ = Math.round(n(params && params.safeZ, 15));   // the macro's #17 = Math.round(safeZ)
        const top = { x: cx, y: cy, z: Math.min(5, sz * 0.5) };   // above the top, ready to probe down
        const method = (params && params.method) === 'fit' ? 'fit' : 'known';
        if (method !== 'fit') return [top];
        // Flank START = R + retract + tipR off the axis, matching the known macro's #11 ("the tool CENTRE clears the OD by
        // retract — the tip sticks out r"). That keeps the start OUTSIDE the grown collision OD (R + tipR) by `retract`, so the
        // probe approaches from outside → a normal near-wall touch even probing dead through the bar axis (no on-surface start
        // = no collision edge case; the shared cylinder collision is untouched). Z is lifted safeZ above the centreline: the
        // macro's reposition drops −#17 (safeZ) AFTER the engine resets pos=0, so the touch lands at the EQUATOR (−R, widest).
        const flankOff = R + retract + tipR;
        const flankZ = -R + safeZ;
        return [
            top,
            { x: cx, y: cy - flankOff, z: flankZ },  // P2 — macro probes +Y → start the −Y side, clear of the OD, probe in
            { x: cx, y: cy + flankOff, z: flankZ },  // P3 — macro probes −Y → start the +Y side
        ];
    },
    // ROTARY_CLOCK — a SINGLE start: the clock datums off a FLAT on a rectangular part (NOT a round bar), doing 2 Z-down
    // touches a SPAN apart. Start above the flat near the top, offset to POINT A (−Y half the span); the macro probes A,
    // steps +Y by the span, probes B. One pass (the 2nd touch is a step, not a repositioned start). Mirrors inferStart.
    rotary_clock(params, stock) {
        const sx = n(stock && stock.x, 150), sy = n(stock && stock.y, 76), sz = n(stock && stock.z, 76);
        const span = n(params && params.span, 20);
        return [{ x: sx / 2, y: sy / 2 - span / 2, z: Math.min(5, sz * 0.5) }];
    },
};

// ── USER_* layer: a custom op DECLARES its per-pass sim-starts and registers a provider here (the wizard-maker seam) ───
// A provider is `(params, stock) => [{x,y,z}, …]`. The DECLARED-spec → provider wiring (read def.sim) is the follow-up;
// for now userOps can register a provider directly. Mirrors opSimContext's USER_INTENT / setUserSimIntent.
const USER_STARTS = new Map();
// The DECLARED rows behind each provider (with stable `id`s + `when` gates) — kept so resolveRelToIndex can map a
// binding's SEMANTIC relTo ({row:'wall1'}) to the pass's index among the SURVIVING when-filtered rows (② B4 step 4a).
const USER_START_ROWS = new Map();

/** Register (or clear with provider=null) a custom op's per-pass sim-start provider + its declared rows. Called by
 *  userOps on register/delete so a user_* op gets per-pass markers from its DECLARED intent, never inferred from motion. */
export function setUserSimStarts(opType, provider, rows) {
    if (typeof provider === 'function') { USER_STARTS.set(opType, provider); USER_START_ROWS.set(opType, Array.isArray(rows) ? rows : []); }
    else { USER_STARTS.delete(opType); USER_START_ROWS.delete(opType); }
}

// ── USER_* sim-STOCK layer (t417 E3) — a custom op DECLARES a DERIVED preview stock (e.g. the rotary round bar projected
// from #57) so its sim renders it WITHOUT mutating the global settings.stock. A provider is `(params, stock) => stock`.
// In-memory (a LIVE fn, dropped on persistence, re-attached from the seed like the sim-starts provider). Read per render.
const USER_SIM_STOCK = new Map();
export function setUserSimStock(opType, fn) { if (typeof fn === 'function') USER_SIM_STOCK.set(opType, fn); else USER_SIM_STOCK.delete(opType); }
export function getUserSimStock(opType) { return USER_SIM_STOCK.get(opType) || null; }

/** Resolve a binding's `relTo` to an index into the WHEN-FILTERED sim-starts for this op + params (② B4 step 4a — the
 *  semantic anchor). A NUMBER passes through (back-compat: it already meant a filtered index). A SEMANTIC {row:'wall1'}
 *  resolves to the row's position among the SURVIVING rows — the SAME whenOk filter opSimStarts + the engine `_pass`
 *  use — so the drag handle anchors to the right pass in EITHER probeZFirst state (off: wall1=0; on: zsurf=0, wall1=1).
 *  Returns null when the named row is absent in this state (the caller then leaves the anchor at the origin). */
export function resolveRelToIndex(opType, params, relTo) {
    if (relTo == null) return null;
    if (typeof relTo === 'number') return relTo;
    const rows = USER_START_ROWS.get(opType);
    if (!rows || !relTo.row) return null;
    let idx = -1;
    for (const row of rows) if (whenOk(row.when, params || {})) { idx++; if (row.id === relTo.row) return idx; }
    return null;
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
    const { sx, sy, cx, cy, pcx, pcy } = ctx;
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
            return { x: pcx != null ? pcx : cx, y: pcy != null ? pcy : cy, z };   // t385 — the pocket CENTRE (an off-centre feature) for a middle probe; a boss / no-inside → the stock centre
    }
};

// whenOk moved to blocks/whenGuard.js — the ONE guard evaluator shared by the sim (here) + the emit (instantiate prune).

/** A DECLARED `def.sim.starts` rows spec → a per-pass provider (params, stock) ⇒ [{x,y,z}…]. Register via setUserSimStarts. */
export function makeProvider(rows) {
    const spec = Array.isArray(rows) ? rows : [];
    return (params, stock) => {
        const sx = n(stock && stock.x, 100), sy = n(stock && stock.y, 80), sz = n(stock && stock.z, 20);
        const dist = n(params && params.dist, 20);
        const ic = insideCentre(stock);   // t385 — the pocket CENTRE feeds the 'centre' anchor ONLY (a middle probe); 'edge'/'radial' keep the STOCK centre (edge/corner probe the OUTER)
        const ctx = {
            sx, sy, sz, cx: sx / 2, cy: sy / 2, pcx: ic ? ic.x : sx / 2, pcy: ic ? ic.y : sy / 2,
            outset: Math.max(6, Math.min(dist * 0.6, 15)),        // the standard stand-off (matches built-in middle)
            R: barRadius(stock, sy, sz),                          // bar radius — declared stock.diameter ?? min(cross)/2 (matches built-in rotary)
            params: params || {},
        };
        const out = [];
        // sim-marker-distinguish (t69): tag each surviving pass with `emits` — does dragging its marker WRITE to the emitted
        // program (a reposition destination, e.g. corner #21-#24) → the SOLID marker shape, vs a sim-only jog preview → HOLLOW.
        // The FIRST surviving pass is ALWAYS the operator's manual start (never program-written), so `emits` only takes effect
        // from pass 2 on. SIM-ONLY by default (a row with no `emits`; the built-in providers above return no emits → unchanged).
        let pass = -1;
        for (const row of spec) {
            if (!whenOk(row.when, params)) continue;
            pass++;
            out.push({ ...rowToStart(row, ctx), emits: pass > 0 && !!row.emits });
        }
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
