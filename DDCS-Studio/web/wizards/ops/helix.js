/**
 * wizards/ops/helix.js — HELIX modifier: a PATH container (kind:'path').
 *
 * Generates an ordered descending-helix of 3D points; the block model sweeps the child MOVE
 * primitive to each one (child.step(pt)). helix(probe) = a helical probe — the "stack" the helical
 * probe should have been all along, instead of a monolithic primitive.
 */
import { num, r3 } from './util.js';

/** Ordered descending helix points (x,y,z), work coords. */
export function helixPoints(p) {
    const cx = num(p.cx, 0), cy = num(p.cy, 0), R = num(p.radius, 10);
    const depth = num(p.depth, 10), pitch = Math.max(0.2, num(p.pitch, 2)), seg = Math.max(8, Math.round(num(p.seg, 24)));
    const a0 = num(p.startAngle, 0) * Math.PI / 180, n = Math.round(Math.max(1, depth / pitch) * seg), pts = [];
    for (let k = 1; k <= n; k++) {
        const a = a0 + k * 2 * Math.PI / seg;
        pts.push({ x: r3(cx + R * Math.cos(a)), y: r3(cy + R * Math.sin(a)), z: r3(-depth * k / n) });
    }
    return pts;
}

export const helixBlock = {
    type: 'helix', label: 'Helix', kind: 'path', category: 'Transforms',
    defaults: { cx: 0, cy: 0, radius: 10, depth: 10, pitch: 2, startAngle: 0, seg: 24, clearance: 5 },
    fields: ['cx', 'cy', 'radius', 'depth', 'pitch', 'startAngle', 'seg', 'clearance'],
    points: helixPoints,
};
