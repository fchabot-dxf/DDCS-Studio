/**
 * wizards/ops/tap.js — TAP primitive: thread a hole with a pitch-locked cycle.
 *
 * FLOATING-HOLDER (default, works on every DDCS post): M3 S<low> + a stabilize dwell, feed to depth at the PITCH-LOCKED
 * feed, M4 (reverse) + feed out at the same feed, M5. The tension/compression holder absorbs the small sync error. The
 * feed is DERIVED here (F = RPM × pitch), never a stored param — valid-by-construction, so the form's F can't drift.
 *
 * RIGID (G84-style, opt-in): a canned cycle — gated on a declared encoder/servo spindle (spindle.tapCapable) AND
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
 *   mapping axis and Pr006/Pr007 pulses-per-rev). That is machine-side.
 *
 * ⛔⛔ t2118 (advisor review, own fault of the t2117 dispatch, corrected here) — THE t2117 FIX REMOVED THE ONLY
 * SPINDLE-START WORD (`M3`) AND REPLACED IT WITH `M29`, WHICH ON THIS CONTROLLER MEANS "sync an ALREADY-RUNNING
 * servo spindle to Z" — IT DOES NOT START ANYTHING. `rigidOk` only checked `p.rigid` + the Expert post; nothing
 * checked whether the machine's spindle is actually servo-wired. Fixed: `rigidOk` now ALSO reads the LIVE
 * `settings.spindle.tapCapable` attestation at EMIT TIME (not just the form's grey-out, which a Blocks-tab tick
 * or a stored value surviving a machine swap both bypass) — a `rigid:true` that is not currently attested folds
 * SAFELY to the floating-holder cycle below, regardless of how it got set.
 *
 * ⛔⛔ t2121 (advisor re-review, two corrections) — (1) `tapCapable` did NOT actually attest the port assignment
 * above: the checkbox only ever named the SPINDLE, never the port, so a truthful user with a genuinely
 * servo-wired spindle who had not done the port step still ticked it in good faith and got the original
 * hazard — `O10180` (`slib-m.nc:1775-1781`) is `IF #2==0 GOTO30` on `#1296` (the port-enable var), and that
 * GOTO skips BOTH the port write AND `#579=1`, so with no port assigned M180 silently no-ops and the spindle
 * stays analog. Fixed at the source: `settingsPanel.js`'s checkbox and `tapData.js`'s gate tip now both name
 * BOTH steps explicitly, so `tapCapable` genuinely attests what this file needs it to. (2) the advisor's own
 * earlier claim that the human's machine is provably analog (`Pr079 = 0`) was ITSELF overstated and is
 * withdrawn: `#579` is the LIVE mode M180 writes, not a fixed hardware fact — a servo machine at rest also
 * reads 0. Do not reason from `Pr079`/`Pr080` as hardware attestations anywhere in this codebase; the decisive
 * value is `#1296`, which Studio never reads and no captured dump decodes.
 */
import { num, r3 } from './util.js';

/** t2118 — the LIVE spindle attestation, read the same way userOpView.js's own form-time _rigidOk already does
 *  (window.ddcsGetSettings().spindle.tapCapable) — but HERE, so the emit path itself can never be bypassed by a
 *  stale stored param or a UI surface (Blocks) that never rendered the form's grey-out at all. Never throws in a
 *  headless/node context (falls through to false — the SAFE side: no attestation, no rigid cycle). */
function liveTapCapable() {
    try {
        const s = (typeof window !== 'undefined') && window.ddcsGetSettings && window.ddcsGetSettings();
        return !!(s && s.spindle && s.spindle.tapCapable);
    } catch (_) { return false; }
}

/** t2123 — EXPORTED so a caller other than tapCycle itself can ask "will the rigid cycle actually run" without
 *  duplicating the attestation + dialect check separately (a second, drift-prone copy — the exact shape this
 *  session keeps finding and fixing elsewhere). `tapData.js`'s statusHint uses this to decide when the
 *  non-reversible-spindle warning applies: it needs to fire whenever the FLOATING-HOLDER cycle actually runs
 *  (which emits M4), not merely whenever `p.rigid` is false — `p.rigid:true` on an unattested/wrong-post
 *  machine ALSO falls to the floating-holder cycle, and the warning was silent in exactly that case. */
export function rigidAttested(dialect) {
    return liveTapCapable() && !!dialect && String(dialect.id || '').startsWith('ddcs-expert');
}

/** t2121 — WHY a rigid REQUEST was refused (only ever called when p.rigid is true and rigidOk is false), so the
 *  fold to the floating-holder cycle below leaves a trace instead of looking byte-identical to a plain
 *  rigid:false request — the SAME honesty cnc.js's bore fold already uses. Matters most on the Blocks canvas,
 *  the one surface with no form-time messaging of its own at all. */
function rigidRefusalReason(dialect) {
    if (!liveTapCapable()) return 'no live tapCapable attestation (Settings → Machine → Spindle: "rigid-tap capable")';
    if (!dialect || !String(dialect.id || '').startsWith('ddcs-expert')) return 'rigid tapping needs the Expert post (the only dump-evidenced firmware)';
    return 'refused';   // unreachable when rigidAttested's own two checks are exhaustive; never a silent blank
}

/** The pitch-locked floating-holder tap cycle at a point. `dialect` supplies the dwell's P units (ms/s). */
export function tapCycle(pt, p, dialect) {
    const clr = num(p.clearance, 5), depth = num(p.depth, 10), rpm = Math.round(num(p.rpm, 400)), pitch = num(p.pitch, 1.0);
    const feed = r3(rpm * pitch);   // DERIVED: the pitch-locked feed (mm/min) = RPM × pitch(mm)
    const dwellLines = (dialect && dialect.dwell) ? dialect.dwell(num(p.dwell, 0.3)) : [`G4 P${num(p.dwell, 0.3)}`];
    // RIGID only on the Expert post (the only dump-evidenced rigid-tapping firmware) AND a LIVE tapCapable
    // attestation (t2118 — checked HERE, at emit time, not just at the form's grey gate; see liveTapCapable's
    // own docstring for why the form-time-only check was the actual defect). Any other combination HONESTLY
    // degrades to the floating-holder cycle below — never silently emits the no-spindle rigid sequence.
    const rigidOk = !!p.rigid && rigidAttested(dialect);   // t2123 — the shared predicate, not a second copy of it
    if (rigidOk) {
        return [
            `( rigid tap ${pitch}mm pitch - vendor G84 sequence; VERIFY the servo-spindle build on your controller )`,
            // ⚠ t2118 — NAMED, NOT FIXED: M180 writes a STORED controller parameter (Pr079/#579), not a transient
            // state. If the program stops here (E-stop / abort) before M181 runs, the controller stays in servo
            // mode until something explicitly sets it back — the next program's own M3 would then pulse/dir a
            // servo interface instead of starting an analog spindle. No in-band G-code fix exists for a genuine
            // abort (code cannot run after one, by definition); the real mitigation (hoist M180/M29/.../M181 to
            // bracket a whole PATTERN once instead of per-hole, shrinking the exposure window) needs a new hook
            // in the shared array/pattern composer (blockEmitter.js) and is deferred, not attempted this turn.
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
        // t2121 — a rigid REQUEST that got refused must not look byte-identical to a plain rigid:false ask.
        ...(p.rigid ? [`( rigid tap requested but REFUSED - ${rigidRefusalReason(dialect)}; using the floating-holder cycle instead )`] : []),
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
