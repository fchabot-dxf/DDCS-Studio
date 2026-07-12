/**
 * wizards/ops/tap.js — TAP primitive: thread a hole with a pitch-locked cycle.
 *
 * FLOATING-HOLDER (default, works on every DDCS post): M3 S<low> + a stabilize dwell, feed to depth at the PITCH-LOCKED
 * feed, M4 (reverse) + feed out at the same feed, M5. The tension/compression holder absorbs the small sync error. The
 * feed is DERIVED here (F = RPM × pitch), never a stored param — valid-by-construction, so the form's F can't drift.
 *
 * RIGID (G84-style, opt-in): a canned cycle — gated UPSTREAM on a declared encoder/servo spindle (spindle.tapCapable) AND
 * the Expert post (the only dump-evidenced firmware). The exact G-code surface is UNVERIFIED on hardware (TAPPING-CAPABILITY.md),
 * so it carries a VERIFY comment.
 */
import { num, r3 } from './util.js';

/** The pitch-locked floating-holder tap cycle at a point. `dialect` supplies the dwell's P units (ms/s). */
export function tapCycle(pt, p, dialect) {
    const clr = num(p.clearance, 5), depth = num(p.depth, 10), rpm = Math.round(num(p.rpm, 400)), pitch = num(p.pitch, 1.0);
    const feed = r3(rpm * pitch);   // DERIVED: the pitch-locked feed (mm/min) = RPM × pitch(mm)
    const dwellLines = (dialect && dialect.dwell) ? dialect.dwell(num(p.dwell, 0.3)) : [`G4 P${num(p.dwell, 0.3)}`];
    // RIGID only on the Expert post (the only dump-evidenced rigid-tapping firmware); any other post HONESTLY degrades to
    // the floating-holder cycle (the tapCapable spindle attestation is enforced by the wizard's grey gate at set-time).
    const rigidOk = !!p.rigid && !!dialect && String(dialect.id || '').startsWith('ddcs-expert');
    if (rigidOk) {
        return [
            `( rigid tap ${pitch}mm pitch - G84-style; VERIFY the cycle + spindle-axis build on your controller )`,
            `G0 X${r3(pt.x)} Y${r3(pt.y)}`,
            `G0 Z${r3(clr)}`,
            `M3 S${rpm}`,
            `G84 Z${r3(-depth)} R${r3(clr)} F${feed}   ( rigid tap to depth, pitch-synced )`,
            `G80   ( cancel cycle )`,
            `M5   ( spindle off )`,
        ];
    }
    return [
        `( floating-holder tap - pitch ${pitch}mm, feed ${feed} mm/min at ${rpm} rpm )`,
        `G0 X${r3(pt.x)} Y${r3(pt.y)}`,
        `G0 Z${r3(clr)}`,
        `M3 S${rpm}   ( spindle CW - start the tap )`,
        ...dwellLines,
        `G1 Z${r3(-depth)} F${feed}   ( feed to depth, pitch-locked )`,
        `M4 S${rpm}   ( reverse )`,
        `G1 Z${r3(clr)} F${feed}   ( feed out at the same rate )`,
        `M5   ( spindle off )`,
    ];
}

/** Self-describing block (the Blocks-tab palette + the emit engine read this). Feed is DERIVED (not a field). */
export const tapBlock = {
    type: 'tap', label: 'Tap', kind: 'leaf', category: 'Toolpaths',
    defaults: { x: 0, y: 0, depth: 10, rpm: 400, pitch: 1.0, dwell: 0.3, clearance: 5, rigid: false },
    fields: ['x', 'y', 'depth', 'rpm', 'pitch', 'dwell', 'clearance', 'rigid'],
    emit: (p, dx = 0, dy = 0, dialect) => tapCycle({ x: num(p.x, 0) + dx, y: num(p.y, 0) + dy }, p, dialect),
    // A tapped hole is a POINT at its local x,y (centre-based extent, like drill) — lets a container recompute the placement bbox live.
    extent: (p) => ({ minX: num(p.x, 0), maxX: num(p.x, 0), minY: num(p.y, 0), maxY: num(p.y, 0) }),
};
