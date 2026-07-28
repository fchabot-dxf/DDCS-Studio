/**
 * wizards/lathe/odProbe.js — THE OD PROBE (t1299): touch the outside of the bar, set the X datum so the DRO reads
 * the TRUE diameter.
 *
 * ── WHAT MAKES THIS DIFFERENT FROM EVERY MILL PROBE ──────────────────────────────────────────────────────────────
 * A mill edge probe sets the datum so the touched surface reads ZERO. A lathe X datum is not like that: X is a
 * RADIUS from the centreline, and the number a turner needs the DRO to show is the DIAMETER of the bar in the
 * chuck — the one they just measured with a pair of calipers. So the operator types that measurement in, and the
 * datum lands so the touched surface reads its true radius. Nothing else on the machine can tell you what the bar's
 * diameter is; the calipers can, and this is how that measurement gets in.
 *
 * ── THE ARITHMETIC, hand-derivable and stated once ───────────────────────────────────────────────────────────────
 * Probing inward from +X, the stylus stops with its CENTRE one tip-radius outside the surface:
 *      surface   = trigger − tip                      (machine radius)
 *      X origin  = surface − caliperDiameter / 2      (so the surface reads the true RADIUS)
 * and the DRO — which doubles X on a lathe — then reads the true DIAMETER.
 *
 * THE DIAMETER STAYS A DIAMETER until the controller halves it. The field is a diameter, the #var holds a diameter,
 * and `[#51/2]` in the emit is the only halving — the same rule OD turning follows, and the reason it exists is that
 * a diameter quietly bound into a radius socket makes every part exactly half-size, with nothing on screen wrong.
 */
import { PROBE_VARS, PROBE_AXIS, LATHE_PROBE_DEFAULTS, latheProbeHeader, latheProbeTouch, latheProbeTail } from './latheProbe.js';

export const OD_PROBE_VARS = PROBE_VARS;

export const OD_PROBE_DEFAULTS = {
    caliperDiameter: 20,                       // what the calipers said — a DIAMETER, all the way to the controller
    tipRadius: LATHE_PROBE_DEFAULTS.tipRadius,
    maxDist: LATHE_PROBE_DEFAULTS.maxDist,
    retract: LATHE_PROBE_DEFAULTS.retract,
    feedFast: LATHE_PROBE_DEFAULTS.feedFast,
    feedSlow: LATHE_PROBE_DEFAULTS.feedSlow,
    port: LATHE_PROBE_DEFAULTS.port,
    wcs: 'active',
    barDiameter: 20, stickOut: 60, allowance: 1,
};

const wcsArg = (w) => (w === 'active' || !w ? '#578' : String(parseInt(String(w).replace('G', ''), 10) - 53));
const wcsLabel = (w) => (w === 'active' || !w ? 'Active WCS' : w);

/**
 * The OD probe as a block stack. Like the face probe it makes NO positioning move: the operator jogs the stylus
 * outside the bar at whatever Z suits them — clear of the chuck, on the round — and presses Enter.
 */
export function odProbeStack(params = {}) {
    const V = PROBE_VARS, A = PROBE_AXIS.X;
    const v = { ...OD_PROBE_DEFAULTS, ...params };
    const dia = Math.max(0, Number(v.caliperDiameter) || 0);
    const wcs = v.wcs || 'active';

    const s = [];
    s.push({ type: 'progstart', params: { rpm: 0, clearance: 0, skim: true } });
    s.push({ type: 'comment', params: { text: 'OD PROBE — touch the outside of the bar and set X so the DRO reads the true diameter.' } });
    s.push(...latheProbeHeader(v));
    // …a DIAMETER in the header, because that is what the operator measured. The controller halves it below.
    s.push({ type: 'assign', params: { var: V.caliper, value: String(dia), note: 'measured bar DIAMETER — what the calipers said' } });
    s.push({ type: 'assign', params: { var: V.datum, value: '0', note: 'the work X origin, machine coords' } });
    s.push({ type: 'wcsbaseinto', params: { wcs, base: '#70' } });

    s.push(...latheProbeTouch({
        axis: 'X', dir: '-',
        prompt: 'Jog the stylus just outside the bar, clear of the chuck, then press Enter — ESC=cancel',
        comment: 'Probe the outside diameter — seeking inward in −X',
    }));

    // THE DATUM: the surface must read the true RADIUS, so the origin sits half the measured diameter below it.
    s.push({ type: 'assign', params: { var: V.datum, value: `[${V.surface}-[${V.caliper}/2]]`, note: 'work X origin — the bar then reads its measured diameter' } });
    s.push({ type: 'wcswrite', params: { axis: 'X', wcs: wcsArg(wcs), offset: A.wcsOffset, value: V.datum, note: `Set ${wcsLabel(wcs)} X so the bar reads its measured diameter`, direct: true } });

    s.push(...latheProbeTail('Bar found — work X set to the measured diameter'));
    s.push({ type: 'progend', params: { retract: false } });
    return s;
}
