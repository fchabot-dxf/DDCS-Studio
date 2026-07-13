/**
 * wizards/ops/stepover.js — STEP OVER: the reusable lateral-pass primitive (kind:'fill', category:'Modify').
 *
 * Lays clearing passes across a `region` at a single depth (the cut Z comes from the enclosing StepDown via
 * scope `z`, like Count exposes `i`). `strategy` = parallel rows (scanline) | concentric rings; `direction` =
 * both-ways (boustrophedon, links passes) | one-way (climb, lift+return) | other-way (conventional). Reused by
 * Pocket / Surfacing / Slot — the body is what to do on each pass (default: cut it). Wraps clearing.js kernels.
 */
import { num, r3 } from './util.js';
import { scanlineFill, fillLevelMoves, concentricRect, concentricCircle, entryOrPlunge } from '../clearing.js';
import { concentricContour, regionInradius } from './contour.js';   // t802 concentric polygon/ellipse; t804 regionInradius (helix clamp)
import { coerceRegion, regionDesc } from './region.js';

/** The region to clear: a plugged Region reporter (StepOver) OR, when none is plugged, built from the block's OWN flat
 *  shape/x/y/w/h params (SurfaceFill). Byte-identical for StepOver. */
export const fillRegion = (p) => (p.region ? coerceRegion(p.region) : regionDesc(p));

/** One-direction passes (climb/conventional): every pass cut the same way, lift + rapid back between rows. */
function onewayMoves(rows, ctx, reverse) {
    const { z, clr, feed, plunge } = ctx;
    const L = [];
    let started = false;
    for (const row of rows) {
        for (const [xlo, xhi] of row.spans) {
            const xs = reverse ? xhi : xlo, xe = reverse ? xlo : xhi;
            if (!started) { L.push(...entryOrPlunge(ctx, xs, row.y, [`G0 X${r3(xs)} Y${r3(row.y)}`, `G1 Z${r3(z)} F${plunge}`])); started = true; }
            else L.push(`G0 Z${r3(clr)}`, `G0 X${r3(xs)} Y${r3(row.y)}`, `G1 Z${r3(z)} F${plunge}`);
            L.push(`G1 X${r3(xe)} Y${r3(row.y)} F${feed}`);
        }
    }
    return L;
}

/** Full clearing toolpath for the region at depth z (auto-cut: StepOver with an empty body). */
export function fillStrategy(p, z) {
    const rg = fillRegion(p), step = Math.max(0.1, num(p.stepover, 4));
    const ctx = { z, clr: num(p.clearance, 5), feed: num(p.feed, 600), plunge: num(p.plunge, 200) };
    // t804 — DEPTH ENTRY context: the per-level descent (ramp/helix) the kernels apply at their first plunge. prevZ = the
    // previous cleared floor (this level's z + the StepDown step `by`); centre + a tool-clamped helix radius from the region.
    ctx.entry = p.entry || 'plunge';
    if (ctx.entry !== 'plunge') {
        ctx.prevZ = z + num(p.by, Math.abs(z));   // by from the enclosing StepDown scope; standalone → the whole depth
        ctx.cx = rg.cx != null ? rg.cx : (rg.x + rg.w / 2);
        ctx.cy = rg.cy != null ? rg.cy : (rg.y + rg.h / 2);
        ctx.rampAngle = num(p.rampAngle, 3);
        const toolR = Math.max(0.1, num(p.toolDia, 6)) / 2, wantR = num(p.helixDia, 0) > 0 ? num(p.helixDia, 0) / 2 : toolR;
        ctx.helixR = Math.max(0.2, Math.min(wantR, regionInradius(rg) - 0.01));   // clamp so the helix + tool stays inside the pocket
        ctx.helixPitch = num(p.helixPitch, 1);
    }
    // Concentric rings: circle + rect keep their analytic kernels (byte-identity); polygon + ellipse now clear via
    // concentricContour — inward OFFSET RINGS over the same offsetRegion the wall uses (t802: replaces the old silent
    // raster FALLBACK, which existed only because concentricRect-on-NaN hung on a centred shape — concentricContour terminates).
    if (p.strategy === 'concentric' && rg.kind === 'circle') return concentricCircle(rg.cx, rg.cy, rg.r, step, ctx);
    if (p.strategy === 'concentric' && rg.kind === 'rect') return concentricRect(rg.x, rg.y, rg.x + rg.w, rg.y + rg.h, step, ctx);
    if (p.strategy === 'concentric') return concentricContour(rg, step, ctx);   // polygon / ellipse
    const rows = scanlineFill(rg.contour, step);
    if (p.direction === 'oneway') return onewayMoves(rows, ctx, false);
    if (p.direction === 'otherway') return onewayMoves(rows, ctx, true);
    return fillLevelMoves(rows, ctx);   // both-ways (default)
}

/** Each pass as a segment {x0,y0,x1,y1} (parallel strategy) — exposed to a StepOver body that customises passes. */
export function fillSegments(p) {
    const rg = fillRegion(p), step = Math.max(0.1, num(p.stepover, 4));
    const rows = scanlineFill(rg.contour, step), oneWay = p.direction === 'oneway' || p.direction === 'otherway';
    const rev = p.direction === 'otherway';
    const segs = [];
    let dir = rev ? -1 : 1;
    for (const row of rows) {
        const spans = dir > 0 ? row.spans : row.spans.slice().reverse();
        for (const [xlo, xhi] of spans) { const [x0, x1] = dir > 0 ? [xlo, xhi] : [xhi, xlo]; segs.push({ x0: r3(x0), y0: r3(row.y), x1: r3(x1), y1: r3(row.y) }); }
        if (!oneWay) dir = -dir;
    }
    return segs;
}

export const stepoverBlock = {
    type: 'stepover', label: 'Step Over', kind: 'fill', category: 'Transforms',
    defaults: { region: null, stepover: 4, strategy: 'parallel', direction: 'bothways', z: 'z', feed: 600, plunge: 200, clearance: 5 },
    fields: ['region', 'stepover', 'strategy', 'direction', 'z', 'feed', 'plunge', 'clearance'],   // region = a Region socket; z follows the StepDown
    sockets: { region: 'region' },
    lines: (p, z) => fillStrategy(p, z),       // auto-cut (empty body)
    segments: (p) => fillSegments(p),          // per-pass body: {x0,y0,x1,y1} in scope
};
