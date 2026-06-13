/**
 * wizards/ops/concentric.js — CONCENTRIC FILL (Ops): clear a rectangular region with inward offset rings.
 *
 * The 'spiral' clearing strategy — the sibling of ZigZag (see zigzag.js). Reuses clearing.js' analytic
 * concentricRect kernel (plunge once at the outer corner, step inward by `stepover` each ring), depth-stepped
 * by `stepdown`. Same region params as ZigZag so a wizard can offer the two strategies interchangeably.
 * Circle regions: clearing.js already has concentricCircle — add a shape select next to this atom later.
 */
import { num, r3 } from './util.js';
import { concentricRect, depthLevels } from '../clearing.js';

/** Multi-depth concentric clear of the rectangle (x,y)–(x+w,y+h). Returns plain G0/G1 lines. */
export function concentricFill(p, dx = 0, dy = 0) {
    const x0 = num(p.x, 0) + dx, y0 = num(p.y, 0) + dy, w = num(p.w, 50), h = num(p.h, 30);
    const step = Math.max(0.1, num(p.stepover, 4)), depth = num(p.depth, 2), sd = Math.max(0.05, num(p.stepdown, depth));
    const clr = num(p.clearance, 5), feed = num(p.feed, 600), plunge = num(p.plunge, 200);
    const L = [`( concentric fill ${r3(w)}x${r3(h)} @ ${r3(x0)},${r3(y0)} )`];
    for (const z of depthLevels(depth, sd)) {
        L.push(...concentricRect(x0, y0, x0 + w, y0 + h, step, { z: -z, clr, feed, plunge }));
        L.push(`G0 Z${r3(clr)}   ( retract )`);
    }
    return L;
}

export const concentricBlock = {
    type: 'concentric', label: 'Concentric Fill', kind: 'leaf', category: 'Ops',
    defaults: { x: 0, y: 0, w: 50, h: 30, stepover: 4, depth: 2, stepdown: 1, feed: 600, plunge: 200, clearance: 5 },
    fields: ['x', 'y', 'w', 'h', 'stepover', 'depth', 'stepdown', 'feed', 'plunge', 'clearance'],
    emit: (p, dx = 0, dy = 0) => concentricFill(p, dx, dy),
};
