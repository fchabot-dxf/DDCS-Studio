/**
 * wizards/ops/zigzag.js — ZIGZAG FILL (Ops): clear a rectangular region with a boustrophedon scanline.
 *
 * The keystone area-clearing atom that Pocket / Surfacing / Text-fill all reduce to. Reuses the shared
 * clearing kernel (scanlineFill → fillLevelMoves) exactly as drill reuses peckDrill — so the geometry is
 * debugged once. Region = a rectangle at (x,y) sized w×h (tool-centre boundary); `stepover` = row spacing;
 * depth is stepped down by `stepdown`. Circle/polygon regions come next (clearing.js already has the kernels).
 */
import { num, r3 } from './util.js';
import { rectContour, scanlineFill, fillLevelMoves, depthLevels } from '../clearing.js';

/** Multi-depth zig-zag clear of the rectangle (x,y)–(x+w,y+h). Returns plain G0/G1 lines. */
export function zigzagFill(p, dx = 0, dy = 0) {
    const x0 = num(p.x, 0) + dx, y0 = num(p.y, 0) + dy, w = num(p.w, 50), h = num(p.h, 30);
    const step = Math.max(0.1, num(p.stepover, 4)), depth = num(p.depth, 2), sd = Math.max(0.05, num(p.stepdown, depth));
    const clr = num(p.clearance, 5), feed = num(p.feed, 600), plunge = num(p.plunge, 200);
    const rows = scanlineFill(rectContour(x0, y0, x0 + w, y0 + h), step);   // scan rows once; reused at every depth
    const L = [`( zigzag fill ${r3(w)}x${r3(h)} @ ${r3(x0)},${r3(y0)} )`];
    for (const z of depthLevels(depth, sd)) {
        L.push(...fillLevelMoves(rows, { z: -z, clr, feed, plunge }));
        L.push(`G0 Z${r3(clr)}   ( retract )`);
    }
    return L;
}

export const zigzagBlock = {
    type: 'zigzag', label: 'ZigZag Fill', kind: 'leaf', category: 'Ops',
    defaults: { x: 0, y: 0, w: 50, h: 30, stepover: 4, depth: 2, stepdown: 1, feed: 600, plunge: 200, clearance: 5 },
    fields: ['x', 'y', 'w', 'h', 'stepover', 'depth', 'stepdown', 'feed', 'plunge', 'clearance'],
    emit: (p, dx = 0, dy = 0) => zigzagFill(p, dx, dy),
};
