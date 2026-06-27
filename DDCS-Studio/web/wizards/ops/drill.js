/**
 * wizards/ops/drill.js — DRILL primitive (peck plunge). Hole Ø = tool Ø.
 *
 * A primitive op-block: the kernel (peckDrill) is shared with the STUDIO drill preset; the
 * block definition (defaults/fields/emit) drives the Blocks-tab palette and the emit engine.
 */
import { num, r3, shiftZ } from './util.js';

/** Peck drill at a point: G83 incremental stepdown. Each peck rapids down to just above the last depth, then
 *  FEEDS only the new `peck` increment, then full-retracts to clearance to clear chips — so the hole deepens a
 *  step at a time (not a full-depth feed re-cutting the whole hole every peck). `zOff` shifts every Z (path offset). */
export function peckDrill(pt, p) {
    const clr = num(p.clearance, 5), depth = num(p.depth, 5), feed = num(p.feed, 100);
    const q = Math.max(0.1, num(p.peck, depth));
    const reentry = 0.5;                              // rapid back to this far above the last peck before feeding on
    const L = [`G0 X${pt.x} Y${pt.y}`];
    let prev = 0, d = 0;
    while (d < depth - 1e-6) {
        d = Math.min(d + q, depth);
        if (prev > 0) L.push(`G0 Z${r3(-(prev - reentry))}`);   // rapid down to just above where we left off
        L.push(`G1 Z${r3(-d)} F${feed}`);                        // feed only the new increment
        L.push(`G0 Z${clr}`);                                    // full retract to clear chips
        prev = d;
    }
    return shiftZ(L, num(p.zOff, 0));
}

/** Self-describing block (the Blocks-tab palette + emit engine read this). */
export const drillBlock = {
    type: 'drill', label: 'Drill', kind: 'leaf', category: 'Toolpaths',
    defaults: { x: 0, y: 0, depth: 5, peck: 5, feed: 100, clearance: 5, zOff: 0 },
    fields: ['x', 'y', 'depth', 'peck', 'feed', 'clearance'],
    emit: (p, dx = 0, dy = 0) => peckDrill({ x: r3(num(p.x, 0) + dx), y: r3(num(p.y, 0) + dy) }, p),
    // Declared geometry extent (centre-based, like the rest of placement): a hole is a POINT at its local x,y. Lets a
    // container (Array) recompute the placement bbox LIVE from params instead of a frozen snapshot — see placeOnStock.
    extent: (p) => ({ minX: num(p.x, 0), maxX: num(p.x, 0), minY: num(p.y, 0), maxY: num(p.y, 0) }),
};
