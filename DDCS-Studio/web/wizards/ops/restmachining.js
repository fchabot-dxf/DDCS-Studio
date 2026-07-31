/**
 * wizards/ops/restmachining.js — REST MACHINING for pockets (t871, backlog item 9, Option A as ruled).
 *
 * A second SMALLER tool clears the corner material the first (bigger) tool couldn't reach. A round tool of radius r
 * leaves a fillet of radius r at each INTERIOR pocket corner; a smaller tool r2 leaves a smaller fillet r2. The REST
 * material = the corner slivers between the r1 and r2 fillets = (pocket cleared by r2) MINUS (pocket cleared by r1).
 *
 * Option A (the advisor's ruling, restructure-not-abstraction): an ANALYTIC cleared-region-ring builder (the design
 * boundary with each interior corner ROUNDED to a fillet arc of radius r — rect + polygon only; smooth circle/ellipse
 * have no corners → no rest) + the EXISTING scanlineFill non-zero-winding raster of [r2-ring (outer), r1-ring (reversed
 * inner hole)] = the corner slivers. NO new boolean/offset engine. The tool-centre spans are CLIPPED to the inset-r2
 * region (offsetRegion, analytic) so the small tool never gouges the wall at a fillet tangent. fillLevelMoves lifts to
 * clearance between the disconnected corner slivers (the safe-height retract between corners).
 */
import { num, r3 } from './util.js';
import { trueRegionFromFlat } from './pocketfill.js';
import { offsetRegion } from './contour.js';
import { polygonContour, scanlineFill, fillLevelMoves, depthLevels } from '../clearing.js';

const V = (x, y) => ({ x, y });
const sub = (a, b) => V(a.x - b.x, a.y - b.y);
const add = (a, b) => V(a.x + b.x, a.y + b.y);
const scl = (a, s) => V(a.x * s, a.y * s);
const nrm = (a) => { const l = Math.hypot(a.x, a.y) || 1; return V(a.x / l, a.y / l); };

/** The MAIN tool radius (mm) and the REST tool radius (mm). */
export const mainToolR = (p) => Math.max(0.1, num(p.toolDia, 6)) / 2;
export const restToolR = (p) => Math.max(0.01, num(p.restDia, 0)) / 2;

/** Rest is valid ONLY when a smaller rest tool is declared on a CORNERED shape (rect/polygon). */
export function restValid(p) {
    const shape = p.shape || 'rect';
    if (shape !== 'rect' && shape !== 'polygon') return false;
    return num(p.restDia, 0) > 0 && restToolR(p) < mainToolR(p) - 0.01;
}
/** The honest grey-out reason when a rest tool IS declared but can't clear rest (empty = valid / not declared). */
export function restGreyReason(p) {
    if (num(p.restDia, 0) <= 0) return '';   // not declared → nothing to grey
    const shape = p.shape || 'rect';
    if (shape !== 'rect' && shape !== 'polygon') return 'Smooth walls (circle / ellipse) leave no corner material — no rest to clear.';
    if (restToolR(p) >= mainToolR(p) - 0.01) return 'The rest tool must be SMALLER than the main tool to reach the corners it left.';
    return '';
}

/** Tessellate an arc (centre c, radius r) from angle a0 to a1 the SHORT way, inclusive, into `seg` steps. */
function arcPts(c, r, a0, a1, seg) {
    let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    const out = [];
    for (let i = 0; i <= seg; i++) { const a = a0 + d * (i / seg); out.push(V(c.x + r * Math.cos(a), c.y + r * Math.sin(a))); }
    return out;
}

/** The CLEARED-REGION ring for a round tool of radius r in a RECT pocket: a rounded rectangle (each corner a quarter
 *  fillet of radius r), CCW. r is clamped so opposite fillets don't cross. */
function roundedRectRing(x0, y0, x1, y1, r, seg = 10) {
    r = Math.max(0, Math.min(r, (x1 - x0) / 2 - 1e-4, (y1 - y0) / 2 - 1e-4));
    if (r <= 1e-4) return [V(x0, y0), V(x1, y0), V(x1, y1), V(x0, y1)];
    const out = [];
    out.push(...arcPts(V(x1 - r, y0 + r), r, -Math.PI / 2, 0, seg));       // bottom-right
    out.push(...arcPts(V(x1 - r, y1 - r), r, 0, Math.PI / 2, seg));        // top-right
    out.push(...arcPts(V(x0 + r, y1 - r), r, Math.PI / 2, Math.PI, seg));  // top-left
    out.push(...arcPts(V(x0 + r, y0 + r), r, Math.PI, 3 * Math.PI / 2, seg)); // bottom-left
    return out;
}

/** The CLEARED-REGION ring for a round tool of radius r in a convex POLYGON pocket: each vertex replaced by a fillet
 *  arc of radius r tangent to both edges (CCW). Interior half-angle → tangent distance r/tan(θ/2), centre on the
 *  bisector at r/sin(θ/2). */
function roundedPolyRing(verts, r, seg = 8) {
    const n = verts.length, out = [];
    for (let i = 0; i < n; i++) {
        const v = verts[i], vp = verts[(i - 1 + n) % n], vn = verts[(i + 1) % n];
        const toPrev = nrm(sub(vp, v)), toNext = nrm(sub(vn, v));
        let cosI = toPrev.x * toNext.x + toPrev.y * toNext.y; cosI = Math.max(-1, Math.min(1, cosI));
        const half = Math.acos(cosI) / 2;                        // half the interior angle
        const rr = Math.max(0, Math.min(r, /* keep the fillet inside the edges */ (Math.min(Math.hypot(vp.x - v.x, vp.y - v.y), Math.hypot(vn.x - v.x, vn.y - v.y)) / 2) * Math.tan(half)));
        const tanDist = rr / Math.tan(half);
        const tp = add(v, scl(toPrev, tanDist)), tn = add(v, scl(toNext, tanDist));
        const bis = nrm(add(toPrev, toNext));
        const c = add(v, scl(bis, rr / Math.sin(half)));
        const a0 = Math.atan2(tp.y - c.y, tp.x - c.x), a1 = Math.atan2(tn.y - c.y, tn.x - c.x);
        out.push(...arcPts(c, rr, a0, a1, seg));                 // tangent-prev → arc → tangent-next (straight edges implicit)
    }
    return out;
}

/** The design-region cleared-boundary ring (rounded corners of radius r); null for smooth shapes. `rg` = the region. */
export function clearedRegionRing(rg, r) {
    if (rg.kind === 'rect') return roundedRectRing(rg.x, rg.y, rg.x + rg.w, rg.y + rg.h, r);
    if (rg.kind === 'polygon') return polyRingFor(rg, r);
    return null;   // circle / ellipse — no corners
}
function polyRingFor(rg, r) { return roundedPolyRing(polygonContour(rg.cx, rg.cy, rg.r, rg.sides)[0], r); }

/** The effective pocket boundary (design + the signed wallOffset). */
function wallRegion(p) { return offsetRegion(trueRegionFromFlat(p), num(p.wallOffset, 0)); }

/** THE REST REGION — the corner slivers as scanline contours [r2-ring (outer, CCW), r1-ring (reversed → inner hole)].
 *  Non-zero winding fills between them; the coincident straight edges cancel, so only the corners carry area. Plus the
 *  count of corners + the per-corner sliver AREA (fillet-radius class) for the assert. null when there is no rest. */
export function restRegion(p) {
    if (!restValid(p)) return null;
    const wall = wallRegion(p);
    const r1 = mainToolR(p), r2 = restToolR(p);
    const ring2 = clearedRegionRing(wall, r2), ring1 = clearedRegionRing(wall, r1);
    if (!ring2 || !ring1) return null;
    const corners = wall.kind === 'rect' ? 4 : Math.max(3, Math.round(wall.sides || 6));
    // per-corner sliver area = (corner-square minus quarter-disc) difference between the r1 and r2 fillets. For a right
    // angle it is exactly (1 − π/4)(r1² − r2²); a general interior angle θ scales the "square" wedge by tan(θ/2)/1 → we
    // report the RIGHT-ANGLE class value (the assert keys off corner-count × this fillet class, not sub-µm exactness).
    const sliverAreaRightAngle = (1 - Math.PI / 4) * (r1 * r1 - r2 * r2);
    return { contours: [ring2, ring1.slice().reverse()], ring2, ring1, corners, r1, r2, sliverAreaRightAngle };
}

/** The rest stepover (mm) — restStepover % of the rest tool Ø (mirrors the main stepoverPct). */
export const restStepMm = (p) => Math.max(0.15, num(p.restDia, 0) * Math.max(1, num(p.restStepover, 40)) / 100);

/**
 * ── t1431 — WHY THE REST WALK STAYS LITERAL, DECLARED AS DATA ─────────────────────────────────────────────────────
 *
 * The parametric family reached this atom and STOPPED HERE, and the boundary is written down rather than left to be
 * rediscovered — the same reason `SURFACE_RASTER_BAKES` is a table: the next act (and pocketfill's own domain behind
 * it) must know which walks may become runtime loops from a declaration, not by reading three kernels.
 *
 * ── THE OBSTRUCTION IS SQRT, AND IT IS MEASURED RATHER THAN ESTIMATED ─────────────────────────────────────────────
 * `maskToCorners` keeps only the part of each scanline span within radius R of a pocket CORNER, and the boundary of a
 * circle crossed by a horizontal line is `dx = sqrt(R² − dy²)` — one square root per (row, corner) pair in range. On an
 * 80×60 rect cleared Ø6 then Ø3, ONE depth level takes **8 of them**; the count is itself derived from the row count,
 * which a live stepover moves. And the region those spans are clipped to is bounded by FILLET ARCS (the r1/r2
 * cleared-region rings, 44 tessellated points each here), whose scanline crossings are the same square root again.
 *
 * SQRT IS UNVERIFIED ON THIS CONTROLLER. That is t1339's standing finding, unchanged: the linter's word list is an
 * ALLOW-LIST, not evidence, and ATAN shipping in the alignment probe proves only itself. It is the same evidence that
 * keeps the raster atom's ramp baking its distance-to-centre — so this is not a new limit, it is the SAME limit
 * reaching a second walk, and one turn lifts both.
 *
 * ⚠ AND THE CHEAP DODGE IS NOT AVAILABLE, which is worth recording so nobody re-proposes it. Masking to a SQUARE
 * around each corner (|dx| ≤ R and |dy| ≤ R) needs no square root — and it is a DIFFERENT CUT: a larger corner region,
 * with the small tool re-cutting air along the diagonals. That is a geometry change to a shipped feature wearing a
 * port's clothes, which this project refuses on principle (t1425 reverted a strictly-more-correct skim×inset fold for
 * exactly this reason). Rest stays literal, whole, and correct until the evidence changes.
 *
 * WHAT LIFTS IT: V13_trig.nc settling SQRT on the machine — the same decider named in the ramp's row. Nothing else.
 */
export const REST_PARAMETRIC_GAP = 'the rest walk clips each scanline span to a CIRCLE around every pocket corner, and '
    + 'a horizontal line crossing a circle needs sqrt(R^2 - dy^2) — once per row per corner, plus the same root again at '
    + 'the fillet arcs that bound the cleared-region rings. SQRT is unverified on this controller (t1339; V13_trig.nc is '
    + 'the decider), which is the evidence that already keeps the raster ramp baking its distance-to-centre. Masking to a '
    + 'square instead would need no root and would cut a different part, so rest stays literal until the evidence changes';

/**
 * Why THIS pocket's rest pass cannot be a runtime macro loop — or '' when there is no rest pass to port at all.
 *
 * It is keyed on `restValid` and NOT on the numbers: the obstruction lives in the walk, not in any particular pocket's
 * dimensions, so a caller cannot dial its way past it. `tests/rest-parametric-boundary-1431.spec.js` MEASURES the claim
 * (it counts the real square roots on the real walk) rather than asserting the sentence — so the day the walk stops
 * needing them the spec goes red and this declaration has to come out, exactly as the cam-row-honesty lock works.
 */
export function restParametricGap(p = {}) { return restValid(p) ? REST_PARAMETRIC_GAP : ''; }

/** THE REST leaf (kind:'leaf') — loops its OWN depth levels (depth/by) and rasters the corner slivers with the rest tool
 *  at each. A leaf (not a stepdown-fill) so the pocket keeps ITS single StepDown (a 2nd one would collide the depth
 *  binding). Carries the flat geometry + toolDia (r1) + restDia (r2) + restStepover + depth/by. */
export const pocketRestBlock = {
    type: 'pocketrest', label: 'Pocket Rest', kind: 'leaf', category: 'Toolpaths',
    defaults: { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, dia: 50, sides: 6, wallOffset: 0, toolDia: 6, restDia: 0, restStepover: 40, depth: 4, by: 1.5, feed: 600, plunge: 150, clearance: 5 },
    fields: ['shape', 'originX', 'originY', 'w', 'h', 'dia', 'sides', 'wallOffset', 'toolDia', 'restDia', 'restStepover', 'depth', 'by', 'feed', 'plunge', 'clearance'],
    emit: (p) => {
        if (!restValid(p)) return [];
        const clr = num(p.clearance, 5), feed = num(p.feed, 600), plunge = num(p.plunge, 150);
        const L = [];
        for (const d of depthLevels(num(p.depth, 4), num(p.by, 1.5))) L.push(...restLevelMoves(p, { z: -d, clr, feed, plunge }));   // cut Z below the surface at each level
        return L;
    },
    segments: () => [],   // the 2D layout draws the rest REGION via the twin's previewGeometry (fc-rest); the 3D sim reads the emitted lines
};

/** The pocket's design CORNERS (where the fillets — and so the rest — live). rect → 4, polygon → N. */
function pocketVertices(rg) {
    if (rg.kind === 'rect') return [V(rg.x, rg.y), V(rg.x + rg.w, rg.y), V(rg.x + rg.w, rg.y + rg.h), V(rg.x, rg.y + rg.h)];
    if (rg.kind === 'polygon') return polygonContour(rg.cx, rg.cy, rg.r, rg.sides)[0];
    return [];
}

/** Keep only the parts of each scanline span within radius R of a pocket CORNER — so the rest pass clears the CORNERS,
 *  not a full wall band (the small tool re-tracing the straight walls would be a finish pass, not rest). */
function maskToCorners(rows, verts, R) {
    const out = [];
    for (const row of rows) {
        const segs = [];
        for (const [xlo, xhi] of row.spans) {
            for (const v of verts) {
                const dy = Math.abs(row.y - v.y); if (dy >= R) continue;
                const dx = Math.sqrt(R * R - dy * dy);
                const lo = Math.max(xlo, v.x - dx), hi = Math.min(xhi, v.x + dx);
                if (hi - lo > 1e-3) segs.push([lo, hi]);
            }
        }
        segs.sort((a, b) => a[0] - b[0]);
        const merged = [];
        for (const s of segs) { const last = merged[merged.length - 1]; if (last && s[0] <= last[1] + 1e-6) last[1] = Math.max(last[1], s[1]); else merged.push([s[0], s[1]]); }
        if (merged.length) out.push({ y: row.y, spans: merged });
    }
    return out;
}

/** THE REST TOOLPATH at cut depth `z`: raster the r2 tool-CENTRE frame (inset-r2 MINUS inset-r1 — the band the small tool
 *  can reach that the big one couldn't), MASKED to the corners, with fillLevelMoves lifting to clearance between the
 *  disconnected corners (the safe-height retract between corners). ctx carries z/clr/feed/plunge (+ the t804 entry).
 *  Empty when there's no rest. The tool centre stays inside inset-r2 → the small tool never gouges the wall. */
export function restLevelMoves(p, ctx) {
    if (!restValid(p)) return [];
    const wall = wallRegion(p), r1 = mainToolR(p), r2 = restToolR(p);
    const insetR2 = offsetRegion(wall, -r2), insetR1 = offsetRegion(wall, -r1);
    const c2 = insetR2 && insetR2.contour && insetR2.contour[0];
    const c1 = insetR1 && insetR1.contour && insetR1.contour[0];
    if (!c2 || !c1) return [];
    const rows = scanlineFill([c2, c1.slice().reverse()], restStepMm(p));   // the inset-r2 − inset-r1 frame (tool centre)
    if (!rows.length) return [];
    const masked = maskToCorners(rows, pocketVertices(wall), 1.15 * r1);    // corner-only: within ~1.15·r1 of a vertex
    if (!masked.length) return [];
    return fillLevelMoves(masked, ctx);
}
