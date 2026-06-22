/**
 * wizards/ops/wall.js — WALL / CONTOUR: a pass around a region's boundary at the current cut Z (kind:'leaf',
 * category:'Ops').
 *
 * Traces the Region's contour at the scope Z (set by an enclosing StepDown). `side` offsets the toolpath by the
 * tool RADIUS (software cutter-comp, since DDCS G41/G42 is unreliable): `on` = tool centre on the boundary (a
 * pocket-wall finish, the default); `outside` / `inside` = the profile/contour cut so the FINISHED edge matches
 * the boundary. So Pocket's finish = Wall(on); a Contour/profile = Wall(outside|inside) wrapped in a StepDown for
 * depth. A CIRCLE region finishes with a true G3 arc; rect/polygon/ellipse trace the (offset) polygon contour.
 */
import { num, r3 } from './util.js';
import { contourLevel, circleContour, polygonContour, ellipseContour, rectContour } from '../clearing.js';
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

/** Signed offset (tool-radius) for a side: outside = +r, inside = −r, on = 0. */
export const sideOffset = (side, toolR) => (side === 'inside' ? -toolR : side === 'on' ? 0 : toolR);

/** The actual toolpath region after applying the side offset — used by emit + the 2D layout so they agree. */
export function wallRegion(p) {
    return offsetRegion(coerceRegion(p.region), sideOffset(p.side || 'on', num(p.tool, 6) / 2));
}

/** Crisp circular wall/contour: rapid to the rim, plunge, one full G3 circle, retract. */
function circleWall(rg, z, clr, feed, plunge) {
    const x = r3(rg.cx + rg.r), y = r3(rg.cy);
    return [`G0 Z${r3(clr)}`, `G0 X${x} Y${y}`, `G1 Z${r3(z)} F${plunge}`, `G3 X${x} Y${y} I${r3(-rg.r)} J0 F${feed}   ( wall )`];
}

export const wallBlock = {
    type: 'wall', label: 'Wall', kind: 'leaf', category: 'Ops',
    defaults: { region: null, side: 'on', tool: 6, z: 'z', feed: 400, plunge: 200, clearance: 5 },
    fields: ['region', 'side', 'tool', 'z', 'feed', 'plunge', 'clearance'],   // side: on (finish) / outside / inside (profile); tool = Ø for the offset
    sockets: { region: 'region' },
    emit: (p) => {
        const rg = wallRegion(p);
        const z = num(p.z, 0), clr = num(p.clearance, 5), feed = num(p.feed, 400), plunge = num(p.plunge, 200);
        return rg.kind === 'circle'
            ? circleWall(rg, z, clr, feed, plunge)
            : contourLevel(rg.contour, { z, clr, feed, plunge });   // rg.contour is already [[points]] (array of contours)
    },
};
