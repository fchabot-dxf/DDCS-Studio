/**
 * wizards/ops/bore.js — BORE primitive (ring-step a hole Ø ≥ tool, planar G3 arcs).
 *
 * Confirmed on the Expert/4.1 dumps: no helical-arc / canned-cycle assumption. Kernel shared
 * with the STUDIO drill preset; block definition drives the Blocks tab.
 */
import { num, r3, shiftZ, val } from './util.js';

/** Bore a hole (Ø ≥ tool) by ring-stepping in Z, then a finishing pass. Two ramp modes:
 *    'step'  (default) — plunge `pitch`, flat full G3 circle, repeat. The proven Expert form.
 *    'helix'           — continuous descent, LINEARIZED to G1 X/Y/Z chords. The Expert has no proven
 *                        helical G2/G3 (its CAM posts linearize every arc), so we never emit G3-with-Z.
 *  If hole Ø ≤ tool Ø it falls back to a straight plunge. */
export function helicalBore(pt, p) {
    const clr = num(p.clearance, 5), depth = num(p.depth, 5), feed = val(p.feed, 100);   // t1091 — feed rides val() (pure F# interpolation) so a #var survives; depth/pitch/dia stay num() (loop bounds + cut-radius math)
    const r = (num(p.holeDia, 12) - num(p.toolDia, 6)) / 2, pitch = Math.max(0.05, num(p.pitch, 0.5));
    const ramp = p.ramp === 'helix' ? 'helix' : 'step';
    const zb = num(p.zOff, 0);
    const cx = pt.x, cy = pt.y;
    if (r <= 0.01) return shiftZ([`G0 X${cx} Y${cy}`, `G0 Z${clr}`, `G1 Z${r3(-depth)} F${feed}`, `G0 Z${clr}`], zb);  // hole ≤ tool → plunge
    // Runaway-pass guard (depth/pitch). A real bore is a few thousand passes at most. A pathological depth — e.g. the
    // value-glow perturbs `depth` to its ~1e6 sentinel to localize that token — would build tens of MILLIONS of lines in
    // the synchronous loop below and FREEZE the tab. The build hangs BEFORE the emitter's push-spread can throw, so the
    // localizer's try/catch (opGlow) can't catch it — it must be bounded HERE (cf. blockEmitter's Math.min(steps,100000)
    // runaway guard). Real bores never reach the cap, so emit stays byte-identical; an absurd one emits a clear placeholder.
    const linesPerPass = ramp === 'helix' ? 24 : 2, passes = Math.max(1, Math.ceil(depth / pitch));
    if (passes * linesPerPass > 100000)
        return shiftZ([`G0 X${cx} Y${cy}`, `G0 Z${clr}`, `( bore: ${ramp} too fine — ${passes} passes capped )`, `G0 Z${clr}`], zb);
    const L = [`G0 X${r3(cx + r)} Y${cy}   ( bore radius )`, `G0 Z${clr}`];
    const arc = `G3 X${r3(cx + r)} Y${cy} I${r3(-r)} J0`;   // full CCW flat circle back to start
    if (ramp === 'helix') {
        const segPerTurn = 24, turns = Math.max(1, Math.ceil(depth / pitch)), total = turns * segPerTurn;
        L.push(`G1 Z0 F${feed}   ( helix top )`);
        for (let s = 1; s <= total; s++) {
            const a = (s / segPerTurn) * 2 * Math.PI;
            L.push(`G1 X${r3(cx + r * Math.cos(a))} Y${r3(cy + r * Math.sin(a))} Z${r3(-(depth * s) / total)} F${feed}`);
        }
        L.push(`${arc} F${feed}   ( finish circle )`, `G0 Z${clr}`);
        return shiftZ(L, zb);
    }
    let z = 0;
    while (z < depth - 1e-6) {
        z = Math.min(z + pitch, depth);
        L.push(`G1 Z${r3(-z)} F${feed}`, `${arc} F${feed}   ( full circle )`);
    }
    L.push(`${arc}   ( finish pass )`, `G0 Z${clr}`);
    return shiftZ(L, zb);
}

export const boreBlock = {
    type: 'bore', label: 'Bore', kind: 'leaf', category: 'Toolpaths',
    defaults: { x: 0, y: 0, holeDia: 12, toolDia: 6, depth: 5, pitch: 0.5, ramp: 'step', feed: 120, clearance: 5, zOff: 0 },
    fields: ['x', 'y', 'holeDia', 'toolDia', 'depth', 'pitch', 'ramp', 'feed', 'clearance'],   // ramp: step / helix
    emit: (p, dx = 0, dy = 0) => helicalBore({ x: r3(num(p.x, 0) + dx), y: r3(num(p.y, 0) + dy) }, p),
    // Declared geometry extent (centre-based, like placement): a bored hole is a POINT at its local x,y. (See drill.js.)
    extent: (p) => ({ minX: num(p.x, 0), maxX: num(p.x, 0), minY: num(p.y, 0), maxY: num(p.y, 0) }),
};
