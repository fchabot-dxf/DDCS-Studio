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
export function circleTrace(rg, z, clr, feed, plunge) {
    const x = r3(rg.cx + rg.r), y = r3(rg.cy);
    return [`G0 Z${r3(clr)}`, `G0 X${x} Y${y}`, `G1 Z${r3(z)} F${plunge}`, `G3 X${x} Y${y} I${r3(-rg.r)} J0 F${feed}   ( contour )`];
}

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
