/**
 * wizards/ops/bore.js — BORE primitive (ring-step a hole Ø ≥ tool, planar G3 arcs).
 *
 * Confirmed on the Expert/4.1 dumps: no helical-arc / canned-cycle assumption. Kernel shared
 * with the STUDIO drill preset; block definition drives the Blocks tab.
 */
import { num, r3 } from './util.js';

/** Bore a hole (Ø ≥ tool): plunge `pitch`, full circle, repeat, then a finishing pass.
 *  If hole Ø ≤ tool Ø it falls back to a straight plunge. */
export function helicalBore(pt, p) {
    const clr = num(p.clearance, 5), depth = num(p.depth, 5), feed = num(p.feed, 100);
    const r = (num(p.holeDia, 12) - num(p.toolDia, 6)) / 2, pitch = Math.max(0.05, num(p.pitch, 0.5));
    const cx = pt.x, cy = pt.y;
    if (r <= 0.01) return [`G0 X${cx} Y${cy}`, `G0 Z${clr}`, `G1 Z${r3(-depth)} F${feed}`, `G0 Z${clr}`];  // hole ≤ tool → plunge
    const L = [`G0 X${r3(cx + r)} Y${cy}   ( bore radius )`, `G0 Z${clr}`];
    const arc = `G3 X${r3(cx + r)} Y${cy} I${r3(-r)} J0`;   // full CCW circle back to start
    let z = 0;
    while (z < depth - 1e-6) {
        z = Math.min(z + pitch, depth);
        L.push(`G1 Z${r3(-z)} F${feed}`, `${arc} F${feed}   ( full circle )`);
    }
    L.push(`${arc}   ( finish pass )`, `G0 Z${clr}`);
    return L;
}

export const boreBlock = {
    type: 'bore', label: 'Bore', kind: 'leaf', category: 'Ops',
    defaults: { x: 0, y: 0, holeDia: 12, toolDia: 6, depth: 5, pitch: 0.5, feed: 120, clearance: 5 },
    fields: ['x', 'y', 'holeDia', 'toolDia', 'depth', 'pitch', 'feed', 'clearance'],
    emit: (p, dx = 0, dy = 0) => helicalBore({ x: r3(num(p.x, 0) + dx), y: r3(num(p.y, 0) + dy) }, p),
};
