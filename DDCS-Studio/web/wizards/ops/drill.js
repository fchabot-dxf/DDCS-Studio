/**
 * wizards/ops/drill.js — DRILL primitive (peck plunge). Hole Ø = tool Ø.
 *
 * A primitive op-block: the kernel (peckDrill) is shared with the STUDIO drill preset; the
 * block definition (defaults/fields/emit) drives the Blocks-tab palette and the emit engine.
 */
import { num, r3 } from './util.js';

/** Peck drill at a point: plunge in `peck` steps, full retract to clearance each step (G83-style). */
export function peckDrill(pt, p) {
    const clr = num(p.clearance, 5), depth = num(p.depth, 5), feed = num(p.feed, 100);
    const q = Math.max(0.1, num(p.peck, depth));
    const L = [`G0 X${pt.x} Y${pt.y}`];
    let d = 0;
    while (d < depth - 1e-6) {
        d = Math.min(d + q, depth);
        L.push(`G1 Z${r3(-d)} F${feed}`);
        L.push(`G0 Z${clr}`);
    }
    return L;
}

/** Self-describing block (the Blocks-tab palette + emit engine read this). */
export const drillBlock = {
    type: 'drill', label: 'Drill', kind: 'leaf', category: 'Ops',
    defaults: { x: 0, y: 0, depth: 5, peck: 5, feed: 100, clearance: 5 },
    fields: ['x', 'y', 'depth', 'peck', 'feed', 'clearance'],
    emit: (p, dx = 0, dy = 0) => peckDrill({ x: r3(num(p.x, 0) + dx), y: r3(num(p.y, 0) + dy) }, p),
};
