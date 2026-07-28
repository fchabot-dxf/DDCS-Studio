/**
 * wizards/lathe/faceProbe.js — THE FACE PROBE (t1299): touch the end of the bar, set the work Z datum.
 *
 * It is the first thing a turner does after chucking a bar, and the whole job hangs off it: every Z in every program
 * afterwards is measured from the number this op writes.
 *
 * ── IT READS THE MODEL ───────────────────────────────────────────────────────────────────────────────────────────
 * The vars, the touch, the spindle rule and the WCS write all come from latheProbe.js. Nothing here re-derives them.
 *
 * ── THE ONE THING THIS OP HAS TO DECIDE: WHICH FACE IS ZERO ──────────────────────────────────────────────────────
 * The family's frame says Z0 is the FINISHED face. The face you can touch on a freshly chucked bar is the RAW one —
 * the sawn end, with material still on it. Those are the same face only when you are not going to face it off.
 *
 * So the op asks, in one field: how far ahead of Z0 is the face I am touching? Zero — the default — means "the face
 * I touched IS zero", the ordinary quick touch-off. Type the facing allowance instead and the datum lands on the
 * FINISHED face, so Z0 stays Z0 after facing and the raw end reads a positive number, which is what it is.
 *
 * Getting this wrong is not a rounding error: it is every subsequent Z out by the allowance, in the direction that
 * cuts deeper. It is a field rather than an assumption for exactly that reason.
 */
import { PROBE_VARS, PROBE_AXIS, LATHE_PROBE_DEFAULTS, latheProbeHeader, latheProbeTouch, latheProbeTail } from './latheProbe.js';

export const FACE_PROBE_VARS = PROBE_VARS;

export const FACE_PROBE_DEFAULTS = {
    ahead: 0,                                  // the touched face is this far ahead of Z0 (0 = it IS Z0)
    tipRadius: LATHE_PROBE_DEFAULTS.tipRadius,
    maxDist: LATHE_PROBE_DEFAULTS.maxDist,
    retract: LATHE_PROBE_DEFAULTS.retract,
    feedFast: LATHE_PROBE_DEFAULTS.feedFast,
    feedSlow: LATHE_PROBE_DEFAULTS.feedSlow,
    port: LATHE_PROBE_DEFAULTS.port,
    wcs: 'active',
    barDiameter: 20, stickOut: 60, allowance: 1,   // the bar the picture and the 3D scene show
};

const wcsArg = (w) => (w === 'active' || !w ? '#578' : String(parseInt(String(w).replace('G', ''), 10) - 53));
const wcsLabel = (w) => (w === 'active' || !w ? 'Active WCS' : w);

/**
 * The face probe as a block stack.
 *
 * NO POSITIONING MOVE, deliberately (iron rule 2): the operator jogs the stylus to within seek distance of the face
 * and presses Enter. An "approach the face" rapid would have to be aimed in the work frame — using the very datum
 * this op exists to establish.
 */
export function faceProbeStack(params = {}) {
    const V = PROBE_VARS, A = PROBE_AXIS.Z;
    const v = { ...FACE_PROBE_DEFAULTS, ...params };
    const ahead = Number.isFinite(Number(v.ahead)) ? Number(v.ahead) : 0;
    const wcs = v.wcs || 'active';

    const s = [];
    // skim: no opening `G0 Z<clearance>` — that is an absolute move, and this op has no absolute frame to trust yet.
    s.push({ type: 'progstart', params: { rpm: 0, clearance: 0, skim: true } });
    s.push({ type: 'comment', params: { text: 'FACE PROBE — touch the end of the bar and set the work Z datum. Jog the stylus clear of the face first.' } });
    s.push(...latheProbeHeader(v));
    s.push({ type: 'assign', params: { var: V.ahead, value: String(ahead), note: 'the touched face is this far AHEAD of Z0' } });
    s.push({ type: 'assign', params: { var: V.datum, value: '0', note: 'the work Z origin, machine coords' } });
    s.push({ type: 'wcsbaseinto', params: { wcs, base: '#70' } });

    s.push(...latheProbeTouch({
        axis: 'Z', dir: '-',
        prompt: 'Jog the stylus just clear of the face, then press Enter — ESC=cancel',
        comment: 'Probe the face — seeking in −Z',
    }));

    // THE DATUM. The touched surface is `ahead` in front of Z0, so the origin sits that far behind it. With the
    // default of zero this is the surface itself, and the expression says so without a special case.
    s.push({ type: 'assign', params: { var: V.datum, value: `[${V.surface}-${V.ahead}]`, note: 'work Z origin — the FINISHED face reads zero' } });
    s.push({ type: 'wcswrite', params: { axis: 'Z', wcs: wcsArg(wcs), offset: A.wcsOffset, value: V.datum, note: `Set ${wcsLabel(wcs)} Z to the finished face`, direct: true } });

    s.push(...latheProbeTail('Face found — work Z set'));
    s.push({ type: 'progend', params: { retract: false } });
    return s;
}
