/**
 * wizards/ops/tap.js — TAP primitive: thread a hole with a pitch-locked cycle.
 *
 * FLOATING-HOLDER (default, works on every DDCS post): M3 S<low> + a stabilize dwell, feed to depth at the PITCH-LOCKED
 * feed, M4 (reverse) + feed out at the same feed, M5. The tension/compression holder absorbs the small sync error. The
 * feed is DERIVED here (F = RPM × pitch), never a stored param — valid-by-construction, so the form's F can't drift.
 *
 * RIGID (G84-style, opt-in): a canned cycle — gated UPSTREAM on a declared encoder/servo spindle (spindle.tapCapable) AND
 * the Expert post (the only dump-evidenced firmware).
 *
 * ⭐ t2117 — THE RIGID SURFACE IS NO LONGER GUESSWORK. foinnc's own `G83_G84钻孔攻丝指令说明/G84测试.txt` is five lines
 * and we differed on four of them:
 *     M180            切换到伺服主轴   - switch to the SERVO spindle
 *     M29 S2000       刚性攻丝模式     - enter rigid-tapping mode (this, not M3, carries the speed)
 *     G00 X10 Y0 Z2
 *     G98 G84 X10 Y0 Z-10 R2 F2000    - 螺距1mm = S2000/F2000
 *     M30
 * ⛔ WITHOUT `M29` THE SPINDLE IS NOT SYNCHRONISED TO Z. We were emitting `M3 S<rpm>` + `G84`, i.e. a tapping cycle
 *    against a free-running analog spindle — the failure mode is a snapped tap, not a bad finish.
 * ⚠ The FEED was already right: `F = rpm x pitch` is exactly the vendor's `S2000/F2000` for a 1 mm pitch.
 * ⚠ M180/M181 switch spindle MODE and need an output port assigned for it (vendor setup doc, alongside Pr080 spindle
 *   mapping axis and Pr006/Pr007 pulses-per-rev). That is machine-side; the upstream tapCapable gate is what attests it.
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
            `( rigid tap ${pitch}mm pitch - vendor G84 sequence; VERIFY the servo-spindle build on your controller )`,
            `M180   ( switch to the SERVO spindle - rigid tapping needs it )`,
            `M29 S${rpm}   ( rigid-tapping mode: synchronise the spindle to Z. WITHOUT THIS THE TAP IS NOT SYNCED )`,
            `G0 X${r3(pt.x)} Y${r3(pt.y)}`,
            `G0 Z${r3(clr)}`,
            // ⚠ X/Y ride IN the G84 block, as the vendor writes it. G98 is explicit: the retract plane must not be
            //    inherited from whatever modal happens to be live when this fragment is composed after another op.
            `G98 G84 X${r3(pt.x)} Y${r3(pt.y)} Z${r3(-depth)} R${r3(clr)} F${feed}   ( rigid tap to depth, pitch-synced )`,
            // ⚠ WE KEEP G80; the vendor's sample does not have it because it ends at M30, which resets modals for it.
            //    This is a FRAGMENT that gets composed with following ops, so leaving G84 modal would re-trigger the
            //    cycle on the next Z move. Deliberate divergence, not an oversight.
            `G80   ( cancel cycle )`,
            `M5   ( spindle off )`,
            `M181   ( back to the analog spindle - leave the machine as we found it )`,
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
