/**
 * wizards/ops/contour.js — CONTOUR: a pass around a region's boundary at the current cut Z (kind:'leaf',
 * category:'Ops'). (Formerly "wall" — it's a contour trace; a pocket-wall finish is just Contour(on).)
 *
 * Traces the Region's contour at the scope Z (set by an enclosing StepDown). `side` offsets the toolpath by the
 * tool RADIUS (software cutter-comp, since DDCS G41/G42 is unreliable): `on` = tool centre on the boundary (a
 * pocket-wall finish, the default); `outside` / `inside` = the profile cut so the FINISHED edge matches the
 * boundary. So Pocket's finish = Contour(on) on its pre-inset region; the Contour wizard = Contour(outside|inside)
 * wrapped in a StepDown for depth. A CIRCLE region finishes with a true G3 arc; rect/polygon/ellipse trace the
 * (offset) polygon contour.
 */
import { num, r3 } from './util.js';
import { contourLevel, circleContour, polygonContour, ellipseContour, rectContour, entryOrPlunge } from '../clearing.js';
import { coerceRegion } from './region.js';

/** Offset a region descriptor OUTWARD (+) / INWARD (−) by `d` (the signed tool-radius), rebuilding its contour.
 *  rect grows/shrinks each side by d; circle/ellipse adjust the radii; a regular polygon offsets its EDGES by d
 *  (circumradius changes by d/cos(π/n)). d=0 traces the boundary itself. */
export function offsetRegion(rg, d) {
    if (!d) return rg;
    if (rg.kind === 'circle') { const r = Math.max(0.01, rg.r + d); return { kind: 'circle', cx: rg.cx, cy: rg.cy, r, contour: circleContour(rg.cx, rg.cy, r) }; }
    if (rg.kind === 'polygon') { const r = Math.max(0.01, rg.r + d / Math.cos(Math.PI / rg.sides)); return { kind: 'polygon', cx: rg.cx, cy: rg.cy, r, sides: rg.sides, contour: polygonContour(rg.cx, rg.cy, r, rg.sides) }; }
    if (rg.kind === 'ellipse') { const rx = Math.max(0.01, rg.rx + d), ry = Math.max(0.01, rg.ry + d); return { kind: 'ellipse', cx: rg.cx, cy: rg.cy, rx, ry, contour: ellipseContour(rg.cx, rg.cy, rx, ry) }; }
    const x0 = rg.x - d, y0 = rg.y - d, x1 = rg.x + rg.w + d, y1 = rg.y + rg.h + d;   // rect
    return { kind: 'rect', x: x0, y: y0, w: x1 - x0, h: y1 - y0, contour: rectContour(x0, y0, x1, y1) };
}

/** t802 — the region's perpendicular HALF-EXTENT (inradius): how much room is left to inset another full ring.
 *  polygon apothem = r·cos(π/n); ellipse = min(rx,ry); circle = r; rect = min(w,h)/2. */
export function regionInradius(rg) {
    if (rg.kind === 'ellipse') return Math.min(rg.rx, rg.ry);
    if (rg.kind === 'polygon') return rg.r * Math.cos(Math.PI / rg.sides);
    if (rg.kind === 'rect') return Math.min(rg.w, rg.h) / 2;
    return rg.r;   // circle
}

/** t802 — CONCENTRIC clearing for ANY shape via inward OFFSET RINGS (polygon + ellipse; circle/rect keep their analytic
 *  concentricCircle/concentricRect kernels for byte-identity). Start at the tool-inset boundary `rg`, trace it, inset by
 *  `step` (a TRUE perpendicular offset — offsetRegion adjusts the polygon circumradius by step/cos(π/n)), repeat until the
 *  region can't hold another ring, then a centre finish clears the core. ASSEMBLY over offsetRegion + a linked ring trace
 *  (no per-ring retract — step inward like concentricRect) — no new geometry, and it TERMINATES (regionInradius floor),
 *  unlike the old concentricRect-on-NaN hang that forced polygon/ellipse to silently raster. */
/** t802 — the SEQUENCE of inward offset ring contours (outermost first) that clear `rg` with a `step` perpendicular
 *  spacing. ONE SOURCE for BOTH the emit (concentricContour) and the 2D preview (pocketPreviewGeometry) so the drawn
 *  rings equal the cut rings by construction — the perimeter-grounding rule. Each entry is a closed point-array. */
export function concentricRings(rg, step) {
    const s = Math.max(0.1, step), rings = [];
    let region = rg, guard = 0;
    while (guard++ < 100000) {
        const ring = (region.contour || [])[0];
        if (!ring || ring.length < 2) break;
        rings.push(ring);
        if (regionInradius(region) <= s) break;   // no room for another full ring inward
        region = offsetRegion(region, -s);
    }
    return rings;
}

export function concentricContour(rg, step, ctx) {
    const { z, clr, feed, plunge } = ctx;
    const rings = concentricRings(rg, step);
    if (!rings.length) return [];
    const cx = rg.cx != null ? rg.cx : (rg.x + rg.w / 2), cy = rg.cy != null ? rg.cy : (rg.y + rg.h / 2);
    const L = [];
    let first = true;
    for (const ring of rings) {
        const p0 = ring[0];
        if (first) { L.push(...entryOrPlunge(ctx, p0.x, p0.y, [`G0 Z${r3(clr)}`, `G0 X${r3(p0.x)} Y${r3(p0.y)}`, `G1 Z${r3(z)} F${plunge}`])); first = false; }
        else L.push(`G1 X${r3(p0.x)} Y${r3(p0.y)} F${feed}`);   // step inward to the next ring (≤ one stepover)
        for (let i = 1; i < ring.length; i++) L.push(`G1 X${r3(ring[i].x)} Y${r3(ring[i].y)} F${feed}`);
        L.push(`G1 X${r3(p0.x)} Y${r3(p0.y)} F${feed}`);   // close the ring
    }
    L.push(`G1 X${r3(cx)} Y${r3(cy)} F${feed}`);   // centre finish — clear the remaining core (≤ one stepover, within tool reach)
    return L;
}

/** Signed offset (tool-radius) for a side: outside = +r, inside = −r, on = 0. */
export const sideOffset = (side, toolR) => (side === 'inside' ? -toolR : side === 'on' ? 0 : toolR);

/** The actual toolpath region after applying the side offset — used by emit + the 2D layout so they agree. */
export function contourRegion(p) {
    return offsetRegion(coerceRegion(p.region), sideOffset(p.side || 'on', num(p.tool, 6) / 2));
}

/** Crisp circular contour: rapid to the rim, plunge, one full G3 circle, retract. Exported so the FLAT twin atom
 *  (contourfill — the region-pill→flat reframe) reuses the EXACT circle emit → byte-identical to this region-socket atom. */
export function circleTrace(rg, z, clr, feed, plunge, entry, prevZ, rampAngle) {
    const x = r3(rg.cx + rg.r), y = r3(rg.cy);
    const L = [`G0 Z${r3(clr)}`, `G0 X${x} Y${y}`];
    const drop = (prevZ != null ? prevZ : 0) - z;
    if (entry === 'ramp' && rg.r > 1e-6 && drop > 1e-6) {
        // t842 — a circle profile has no straight "first segment": ramp = a HELICAL descent AROUND the circle (the standard
        // circular lead-in), revs sized so the per-rev descent stays ≤ the ramp angle, then a flat finishing pass.
        const ang = Math.min(45, Math.max(0.5, num(rampAngle, 3)));
        const perRev = 2 * Math.PI * rg.r * Math.tan(ang * Math.PI / 180);
        const revs = Math.max(1, Math.ceil(drop / perRev));
        L.push(`G0 Z${r3(prevZ)}`);
        for (let i = 1; i <= revs; i++) L.push(`G3 X${x} Y${y} I${r3(-rg.r)} J0 Z${r3(prevZ - drop * i / revs)} F${feed}   ( ramp )`);
        L.push(`G3 X${x} Y${y} I${r3(-rg.r)} J0 F${feed}   ( contour )`);
        return L;
    }
    L.push(`G1 Z${r3(z)} F${plunge}`, `G3 X${x} Y${y} I${r3(-rg.r)} J0 F${feed}   ( contour )`);
    return L;
}

/**
 * ── t1464 — CONTOUR IS DECLARED-LITERAL, BY DESIGN. The arc's day-one ruling, finally written down ────────────────
 *
 * The parametric arc converted surfacing, the drill family and the rect pocket; contour was ruled "never converts"
 * from the first act and that ruling has lived only in dispatch notes. It is a declaration now, in the family's own
 * source, in the shape every other boundary here uses (`REST_PARAMETRIC_GAP`, `SLOT_RASTER_GAP`, `POCKET_SHAPE_GAP`)
 * — so the next reader learns it from the code rather than from an act they would have to find.
 *
 * ── MEASURED, PER REGION KIND, on the real emit (Ø6 tool, side:'outside', one level) ─────────────────────────────
 *
 *     rect 80x60        7 lines ·   0 trig   ← analytic, and a 4-corner box: a macro loop over four points saves
 *                                              nothing. There is no parametric win here to go and get.
 *     circle Ø50        4 lines ·  1 G3 ARC  ← ALREADY the compact form. A true arc IS the parametric answer for a
 *                                              circle; converting it could only make it longer.
 *     polygon Ø50 x6    9 lines ·  13 trig   ← the vertices are trig-computed in JS.
 *     ellipse 80x60    99 lines · 192 trig   ← a 96-segment tessellated polyline. This is the transcript case.
 *
 * ── SO THE RULING IS RIGHT FOR THREE SEPARATE REASONS, AND ONLY ONE OF THEM IS TRIG ──────────────────────────────
 * A rect has nothing to gain; a circle is already an arc; and only polygon/ellipse are transcripts — whose vertices
 * need SIN/COS, which is unverified on this controller (t1339; `V13_trig.nc` is the decider, the same one the raster
 * ramp, the rest walk and the non-rect pocket fills wait on). Even proven, the ellipse's boundary is a POINT LIST
 * rather than a formula, exactly as `POCKET_SHAPE_GAP` records for the fills — the same shape, one layer out.
 *
 * ⚠ THIS IS A DESIGN STATEMENT, NOT A DEFERRAL. Contour emits literal transcripts because that is the correct output
 * for what it cuts, not because an act has not got to it yet. Nothing here is queued.
 */
export const CONTOUR_PARAMETRIC_GAP = 'a contour pass emits a literal transcript BY DESIGN, and for three separate '
    + 'reasons: a RECT boundary is four corners (a macro loop over four points saves nothing), a CIRCLE already emits '
    + 'a single true G3 arc (which IS the compact parametric form), and only POLYGON / ELLIPSE are transcripts — '
    + 'their vertices are trig-computed in JS (measured: 13 calls for a hexagon, 192 for an ellipse whose boundary is '
    + 'a 96-segment polyline), and trig is unverified on this controller (t1339; V13_trig.nc is the decider). Proving '
    + 'trig would not change it: a tessellated boundary is a POINT LIST, not a formula a macro can count itself into';

/** Why this contour stays literal — '' is never returned: the ruling covers every region kind, for the reasons above. */
export function contourParametricGap() { return CONTOUR_PARAMETRIC_GAP; }

export const contourBlock = {
    type: 'contour', label: 'Contour', kind: 'leaf', category: 'Toolpaths',
    defaults: { region: null, side: 'on', tool: 6, z: 'z', feed: 400, plunge: 200, clearance: 5 },
    fields: ['region', 'side', 'tool', 'z', 'feed', 'plunge', 'clearance'],   // side: on (finish) / outside / inside (profile); tool = Ø for the offset
    sockets: { region: 'region' },
    emit: (p) => {
        const rg = contourRegion(p);
        const z = num(p.z, 0), clr = num(p.clearance, 5), feed = num(p.feed, 400), plunge = num(p.plunge, 200);
        return rg.kind === 'circle'
            ? circleTrace(rg, z, clr, feed, plunge)
            : contourLevel(rg.contour, { z, clr, feed, plunge });   // rg.contour is already [[points]] (array of contours)
    },
};
