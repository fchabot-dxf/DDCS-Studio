/**
 * wizards/lathe/latheProbe.js — THE LATHE PROBE MODEL (t1299), declared before either op exists.
 *
 * The five turning ops each moved metal. These two move a NUMBER: they touch the work with a stylus and write the
 * result into the WCS table, which is the datum every later program is measured from. A turning op that is wrong by
 * a tenth cuts a part a tenth undersize; a probe that is wrong by a tenth makes every part after it wrong, silently.
 * So the model comes first and the ops read it — the same order the pilot and the five turning ops were built in.
 *
 * ── IT REUSES THE MILL'S PROBE MACHINERY, IT DOES NOT PARALLEL IT ────────────────────────────────────────────────
 * `probeSurfaceStack` (wizards/ops/probeSurface.js) is the declared touch: guard → fast G31 → check → retract → slow
 * G31 → check → radius-comp → retract, per post. `wcsbaseinto`/`wcswrite` are the declared WCS write. Both are used
 * here unchanged. The scratch numbering below is the MILL PROBE NUMBERING for the same reason: an operator who has
 * read an edge-probe macro can read this one, and #6 means the stylus radius in both.
 *
 * ── THE FRAME, restated where it is used ─────────────────────────────────────────────────────────────────────────
 * X is a RADIUS from the centreline (the controller has no diameter mode), Z0 is the FINISHED FACE. The operator
 * speaks DIAMETER — they read one off a pair of calipers — so a diameter goes into the header as a diameter and the
 * CONTROLLER halves it, exactly as OD turning does. Nothing here converts a diameter in JavaScript.
 *
 * ── THE TWO IRON RULES ───────────────────────────────────────────────────────────────────────────────────────────
 * 1. THE SPINDLE IS OFF BEFORE ANY G31. A spinning chuck against a touch probe is a broken stylus, and possibly a
 *    broken wrist. It is not a field, not a default, not a checkbox: `latheProbeTouch` emits the stop itself, so no
 *    parameter a user can reach can un-say it. `spindleOffBeforeEveryProbe()` re-checks it STRUCTURALLY over the
 *    emitted text — every G31 in the program, whatever produced it.
 * 2. A PROBE NEVER READS THE WCS. The WCS is this op's OUTPUT. Reading a datum to decide where to touch would mean
 *    trusting the number being measured — and on a fresh setup that number describes a DIFFERENT job. So both ops
 *    are entirely INCREMENTAL from wherever the operator jogged to: there is no absolute positioning move to get
 *    wrong. `wcsNeverReadForMotion()` states the hazard precisely (below) rather than banning the whole address
 *    machinery, which would be an over-broad proxy that fails on the write itself.
 */
import { probeSurfaceStack } from '../ops/probeSurface.js';

/**
 * THE DECLARED SCRATCH VARS — the mill probe numbering, deliberately unchanged, plus the two this family adds.
 * Named here so the emit, the bindings and the tests all read one table.
 */
export const PROBE_VARS = {
    maxDist: '#1',       // how far to seek before calling it a miss
    retract: '#2',       // back-off between the fast and slow touches
    feedFast: '#3',
    feedSlow: '#4',
    port: '#5',
    tip: '#6',           // the stylus RADIUS — the same #6 every mill probe uses
    negDist: '#7', posDist: '#8', negRetract: '#9', posRetract: '#10',
    surface: '#50',      // the touched surface in MACHINE coords, stylus radius already taken off
    caliper: '#51',      // OD probe: the operator's caliper-measured bar DIAMETER
    datum: '#52',        // what gets written into the WCS table
    ahead: '#53',        // face probe: how far the touched face is AHEAD of Z0 (what facing will remove)
};

/** The G31 registers per axis, from the official DDCS variable list (status 2 = SUCCESS). */
export const PROBE_AXIS = {
    X: { status: '#1920', trigger: '#1925', stop: '#1905', limit: '#1915', wcsOffset: 0 },
    Z: { status: '#1922', trigger: '#1927', stop: '#1907', limit: '#1917', wcsOffset: 2 },
};

/**
 * THE FAMILY'S DEFAULTS. A touch probe on a lathe is a slower, gentler thing than an insert: the feeds are the mill
 * probe's, not a turning feed, and the seek distance is short because the operator has already jogged close.
 */
export const LATHE_PROBE_DEFAULTS = {
    tipRadius: 2,        // stylus radius; the ONE number that separates the trigger from the surface
    maxDist: 15,
    retract: 2,
    feedFast: 200,
    feedSlow: 50,
    port: 3,
    level: 0,
};

export const PROBE_FAIL_LABEL = 1;
export const PROBE_END_LABEL = 2;

/**
 * THE CONFIG HEADER both ops share — every number the operator might change, once, at the top where they can find
 * it, in the same #var form the turning ops use. Shared rather than copied: two headers that drift are two macros
 * that behave differently for the same typed number.
 */
export function latheProbeHeader(v = {}) {
    const V = PROBE_VARS;
    const n = (x, d) => (Number.isFinite(Number(x)) ? Number(x) : d);
    const D = LATHE_PROBE_DEFAULTS;
    return [
        { type: 'comment', params: { text: 'Probe settings — every size below is a #var the operator can edit' } },
        { type: 'assign', params: { var: V.maxDist, value: String(n(v.maxDist, D.maxDist)), note: 'max seek before it is a miss' } },
        { type: 'assign', params: { var: V.retract, value: String(n(v.retract, D.retract)), note: 'back-off between touches' } },
        { type: 'assign', params: { var: V.feedFast, value: String(n(v.feedFast, D.feedFast)), note: 'fast find' } },
        { type: 'assign', params: { var: V.feedSlow, value: String(n(v.feedSlow, D.feedSlow)), note: 'slow, accurate touch' } },
        { type: 'assign', params: { var: V.port, value: String(n(v.port, D.port)), note: 'probe input port' } },
        { type: 'assign', params: { var: V.tip, value: String(n(v.tipRadius, D.tipRadius)), note: 'stylus RADIUS' } },
        { type: 'comment', params: { text: 'Pre-calculated motion values' } },
        { type: 'assign', params: { var: V.negDist, value: `[0-${V.maxDist}]`, note: 'seek in −' } },
        { type: 'assign', params: { var: V.posDist, value: V.maxDist, note: 'seek in +' } },
        { type: 'assign', params: { var: V.negRetract, value: `[0-${V.retract}]` } },
        { type: 'assign', params: { var: V.posRetract, value: V.retract } },
        { type: 'assign', params: { var: V.surface, value: '0', note: 'the touched surface — machine coords' } },
    ];
}

/**
 * ONE TOUCH, with the spindle rule built in.
 *
 * The stop is emitted HERE, above the guard and the G31, because that is what makes it structural: an op cannot
 * forget it, a parameter cannot disable it, and a future op that composes this gets it without knowing it exists.
 * It is emitted per touch rather than once per program on purpose — M5 is modal and harmless to repeat, and a rule
 * that holds locally survives being reordered, copied into another op, or pruned by a twin's instantiate().
 *
 * The whole sequence is INCREMENTAL (rule 2): the operator jogs the stylus to within seek distance of the surface
 * and presses Enter; nothing here knows or asks where that is in the work frame.
 *
 * @param {object} o
 * @param {'X'|'Z'} o.axis
 * @param {'+'|'-'} o.dir       which way the stylus travels to find the surface
 * @param {string} o.prompt     what the operator is being asked to have jogged to
 * @param {string} o.comment    the comment above the touch
 */
export function latheProbeTouch(o = {}) {
    const V = PROBE_VARS;
    const axis = o.axis === 'X' ? 'X' : 'Z';
    const A = PROBE_AXIS[axis];
    const plus = o.dir === '+';
    return [
        // ── IRON RULE 1, by construction ───────────────────────────────────────────────────────────────────────
        { type: 'spindle', params: { rpm: 0, dir: 'cw' } },   // rpm 0 → M5. A spinning chuck against a stylus breaks it.
        { type: 'comment', params: { text: 'spindle STOPPED — never probe against a turning chuck' } },
        { type: 'hmiconfirm', params: { value: '1', note: o.prompt || 'Press Enter to probe — ESC=cancel', cancel: PROBE_END_LABEL } },
        { type: 'distmode', params: { dist: 'inc' } },        // …everything below is relative to where they jogged
        ...probeSurfaceStack({
            axis, dir: plus ? '+' : '-', comment: o.comment || `Probe ${axis}`,
            stopVar: A.stop, limitVar: A.limit, limitVal: plus ? '2' : '1',
            probeVar: plus ? V.posDist : V.negDist,
            retractVar: plus ? V.negRetract : V.posRetract,   // retract AWAY from the surface just touched
            feedFast: V.feedFast, feedSlow: V.feedSlow, port: V.port, level: LATHE_PROBE_DEFAULTS.level,
            twoPass: true,
            raw: A.trigger, rawAxis: axis, result: V.surface, radius: V.tip, compEnable: true,
            compNote: 'surface = trigger −/+ stylus radius',
            failGoto: PROBE_FAIL_LABEL,
        }),
        { type: 'distmode', params: { dist: 'abs' } },
    ];
}

/** The tail every probe op shares: report, then the failure arm the G31 checks branch to. */
export function latheProbeTail(foundNote) {
    return [
        { type: 'hmiline', params: { value: '-5000', note: foundNote || 'Probe complete' } },
        { type: 'goto', params: { n: PROBE_END_LABEL } },
        { type: 'label', params: { n: PROBE_FAIL_LABEL } },
        { type: 'distmode', params: { dist: 'abs' } },
        { type: 'hmiline', params: { value: '1', note: 'Probe failed — no contact. Nothing was written.' } },
        { type: 'label', params: { n: PROBE_END_LABEL } },
    ];
}

// ── THE RULES, AS CHECKERS ──────────────────────────────────────────────────────────────────────────────────────
// Declared here, beside the rules they enforce, so the specs call them instead of each re-implementing a scan (and
// so a future probe op is checkable the day it is written). They read the EMITTED TEXT, never the stack that
// produced it — a checker that reads the same structure the builder wrote would only prove the builder agrees with
// itself.

const stripComment = (line) => String(line).replace(/\([^)]*\)/g, '');

/**
 * IRON RULE 1, structurally: every G31 in this program has the spindle stopped above it, with nothing starting it
 * again in between. No digits, no knowledge of which op wrote what — it walks the program the way the controller
 * will and reports the line number of any G31 that is reached with the spindle running.
 * @returns {{ok:boolean, violations:Array<{line:number, text:string, why:string}>}}
 */
export function spindleOffBeforeEveryProbe(nc) {
    const lines = String(nc || '').split('\n');
    const violations = [];
    let running = false, everStopped = false;
    lines.forEach((raw, i) => {
        const L = stripComment(raw);
        if (/\bM0?3\b|\bM0?4\b/.test(L)) running = true;
        if (/\bM0?5\b/.test(L)) { running = false; everStopped = true; }
        if (/\bG31\b/.test(L)) {
            if (running) violations.push({ line: i + 1, text: raw.trim(), why: 'the spindle was started above this G31 and never stopped' });
            else if (!everStopped) violations.push({ line: i + 1, text: raw.trim(), why: 'this G31 is reached without the spindle ever being stopped' });
        }
    });
    return { ok: violations.length === 0, violations };
}

/**
 * IRON RULE 2, structurally — AND STATED PRECISELY, because the obvious over-broad version ("no WCS register may
 * appear anywhere") fails on the op's own WCS WRITE, which is the whole point of the op.
 *
 * THE HAZARD is a probe whose MOTION or whose measured RESULT depends on a datum VALUE: it would be measuring from
 * the number it is trying to establish. So:
 *   • a motion line (G0/G1/G31/G53) may not read a WCS table value;
 *   • the right-hand side of any assignment may not read one either — that is where a result would be contaminated;
 *   • writing one (a WCS register on the LEFT of `=`) is exactly what a probe is for, and is not flagged;
 *   • computing the table ADDRESS from which WCS is active (#578 → #70) is an address, not a datum value, and is
 *     the shared write path's own machinery.
 * @returns {{ok:boolean, violations:Array<{line:number, text:string, why:string}>}}
 */
export function wcsNeverReadForMotion(nc) {
    const lines = String(nc || '').split('\n');
    const violations = [];
    // an INDIRECT read through the table base (#[#70…]) or a direct fixture-offset register (#52xx / #54xx-#59xx)
    const READS_DATUM = /#\[\s*#7[0-9]|#5[2-9][0-9]{2}\b/;
    lines.forEach((raw, i) => {
        const L = stripComment(raw);
        const eq = L.indexOf('=');
        if (eq >= 0) {
            const rhs = L.slice(eq + 1);
            if (READS_DATUM.test(rhs)) violations.push({ line: i + 1, text: raw.trim(), why: 'a datum VALUE feeds this computation — the probe would measure from the number it is establishing' });
            return;                                        // an assignment is not also a motion line
        }
        if (/\bG(?:0|1|31|53)\b/.test(L) && READS_DATUM.test(L)) {
            violations.push({ line: i + 1, text: raw.trim(), why: 'this move is aimed using a datum value the probe has not established yet' });
        }
    });
    return { ok: violations.length === 0, violations };
}
