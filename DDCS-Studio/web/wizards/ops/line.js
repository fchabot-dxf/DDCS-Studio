/**
 * wizards/ops/line.js — LINE primitive (straight groove A→B, zig-zag step-down).
 *
 * The line analogue of bore — same shape (rapid in, step down, retract). The one leaf op that
 * didn't already exist inside a wizard.
 */
import { num, r3 } from './util.js';

/** Straight cut from (x0,y0) to (x1,y1): zig-zag down in `stepdown` passes, plunging at each turn. */
export function lineCut(p) {
    const x0 = num(p.x0, 0), y0 = num(p.y0, 0), x1 = num(p.x1, 50), y1 = num(p.y1, 0);
    const clr = num(p.clearance, 5), depth = num(p.depth, 3), feed = num(p.feed, 2000);
    const step = Math.max(0.05, num(p.stepdown, depth));
    const ends = [[r3(x0), r3(y0)], [r3(x1), r3(y1)]];
    const L = [`G0 X${ends[0][0]} Y${ends[0][1]}   ( line start )`, `G0 Z${clr}`];
    let z = 0, cur = 0;
    while (z < depth - 1e-6) {
        z = Math.min(z + step, depth);
        L.push(`G1 Z${r3(-z)} F${feed}   ( step down )`);
        cur = 1 - cur;                                 // cut to the other end
        L.push(`G1 X${ends[cur][0]} Y${ends[cur][1]} F${feed}`);
    }
    L.push(`G0 Z${clr}   ( retract )`);
    return L;
}

export const lineBlock = {
    type: 'line', label: 'Line', kind: 'leaf', category: 'Toolpaths',
    defaults: { x0: 0, y0: 0, x1: 50, y1: 0, depth: 3, stepdown: 1, feed: 2000, clearance: 5 },
    fields: ['x0', 'y0', 'x1', 'y1', 'depth', 'stepdown', 'feed', 'clearance'],
    emit: (p, dx = 0, dy = 0) => lineCut({
        ...p,
        x0: num(p.x0, 0) + dx, y0: num(p.y0, 0) + dy,
        x1: num(p.x1, 50) + dx, y1: num(p.y1, 0) + dy,
    }),
};
