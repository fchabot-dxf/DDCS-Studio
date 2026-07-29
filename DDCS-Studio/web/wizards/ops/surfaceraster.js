/**
 * wizards/ops/surfaceraster.js — SURFACING, EMITTED PARAMETRIC (t1329 pilot · t1333 coverage).
 *
 * THE PILOT'S POINT: today a surfacing op unrolls its whole raster in JavaScript — every row, at every depth, as a
 * literal G1. A 200×150 face at a 0.4 stepdown is thousands of lines that all say the same thing, and none of them
 * says WHY. This emits the INTENT instead: a header of named #vars, a depth loop, and inner loops that count
 * themselves from the area and the stepover. Change the tool Ø on the pendant and the raster re-derives at the machine.
 *
 * WHY A NEW ATOM RATHER THAN CHANGING `stepdown` + `surfacefill`: those two are SHARED — pocket, slot and contour
 * emit through them. Making them parametric would re-emit every one of those ops in the same breath as the pilot,
 * which is exactly what a pilot exists to avoid ([[corner-gated-pilot]]: prove each mechanism ONCE, on one op, and
 * let the family inherit it deliberately). This atom owns the loops for the surfacing case and touches nothing else.
 *
 * ── THE SCRATCH IT WRITES, DECLARED (t1325's lesson) ─────────────────────────────────────────────────────────────
 * A hand-picked var is how the CAM stepover derivation got silently overwritten by rasterClear's row count: clean
 * G-code that cut a different part. So the band is DECLARED on the block (`scratch`), the way universalScratch.js
 * already reads every atom's own declaration, and the spec asserts each header var is assigned exactly once.
 *
 * ── THE FRAME ────────────────────────────────────────────────────────────────────────────────────────────────────
 * The area is the TOOL-CENTRE sweep (no radius inset — the tool overhangs the edge and faces the whole top), which
 * is what the literal emitter has always done; the equivalence bridge proves that has not changed.
 *
 * ── THE COMPARATORS ARE SYMBOLS, AND THAT IS AN EVIDENCE DECISION (t1355) ────────────────────────────────────────
 * This body used the WORD forms (LT/GT/LE/GE). Swept against the factory macro corpus — the v4.1 firmware's
 * macroMillCylinder/macroMillRect, dm500's slib, the Expert's slib-g/slib-m — the counts are:
 *     SYMBOLS:  ==  190 · >  50 · <  20 · <=  12 · >=  6      ← every comparator this body needs, demonstrated
 *     WORDS:    NE  25  ← and NOTHING else. No LT, no GT, no LE, no GE, no EQ anywhere in factory code.
 * So all four were swapped, not the two that were flagged: LE and GE sat in exactly the same undemonstrated class as
 * LT and GT, and leaving them would have kept the risk while looking like it had been dealt with.
 *
 * THE BRACKETED, SPACED SHAPE IS DEMONSTRATED TOO — the factory writes both `WHILE #1<=#108 DO2` and
 * `WHILE [#2 <= #1301] DO1`, so the readable form this body already used needs no compromise to sit on the evidence.
 *
 * (Our own shipped CAM slots still emit the spaced WORD forms — `IF #22 LE 0 GOTO`, `IF #71 EQ 0 THEN` — and those
 * are proven a different way: the user runs them live. They are NOT changed here; this is the pre-consumer emitter,
 * and rewriting working live macros to chase a stronger tier would be risk taken for tidiness.)
 */
import { num } from './util.js';

/**
 * THE BAND. #40–#49: clear of the mill kit's #20–#33 (camMacroKit's caller/kit split), clear of the probe temps at
 * #50–#61, and clear of the dialect/atom injections universalScratch aggregates in the low teens. Declared here as
 * data so the collision guard reads it instead of re-deriving it from the emitted text.
 */
// t1343 — EXTENDED DOWN to #34 for the helix recurrence, which needs a rotating vector (2), a temp for the rotate
// (1) and its own segment counter (1) on top of the header. #34–#39 is the gap between camMacroKit's kit band
// (#27–#33) and this atom's original #40–#49 — still clear of the probe temps at #50–#61.
// t1355 — THE SKIM FRAME's three registers, declared as part of the same band data. #62-#64 sits in the gap between
// the probe temps (#50-#61) and camMacroKit's WCS pair (#70-#71) — unclaimed by any band in camScratch.js. They are
// plain LOCALS: far below the #1153+ persistent range the priming freeze concerns, so reading a system register into
// one carries none of that hazard (CORE_TRUTH 4).
export const RASTER_SCRATCH = [[34, 49], [62, 64]];

/**
 * THE LIVE WORK POSITION, read at the top of a SKIM program. #790/#791/#792 are the active-WCS X/Y/Z
 * ([COMMUNITY-ATTESTED]; the factory's own gotozero.nc proves #792 with `IF #569<#792 GOTO1`).
 *
 * WHY THE WCS FRAME AND NOT THE MACHINE FRAME (#880-#882) — the sieve, recorded because it looks like the safer
 * option and is not. Taking machine coordinates would force EVERY cutting move into G53, and G53 is proven here only
 * as `G53 <axis>#var`: one axis, a variable, a rapid, in a program footer (V3a/V3b on machine 2026-06-19).
 * Literal-coordinate G53 is INCONCLUSIVE — V3c/V3d aborted at a guard and were deliberately not pursued because
 * "the dialect emits #var, never bare literals" — and a raster is full of literal coordinates and G1 feed moves.
 * Meanwhile #880-#882 is NOT V7-proven: V7 is still in the verify HANDOFF's "Left to do" table, its values only
 * "seen incidentally".
 *
 * So the choice is not attested-vs-proven, it is WHERE the unproven part sits. The WCS frame puts it on a register
 * READ, at the top, before any motion — where a sentinel can catch it and refuse. The machine frame would put it in
 * the G-code FORM of every cutting move, where a controller that mis-executes it does so with the tool down.
 * A bad read is detectable; a mis-executed cutting form is not. Gate 1 (safety) decides, and it decides for the WCS.
 */
const SKIM_FRAME = { x: '#62', y: '#63', z: '#64' };
const FRAME_SRC = { x: '#790', y: '#791', z: '#792' };
const FRAME_SENTINEL = '-99999';

const V = {
    w: '#40',        // area X (tool-centre sweep)
    h: '#41',        // area Y
    depth: '#42',    // total depth to remove
    stepdown: '#43', // per-level bite
    step: '#44',     // stepover in mm — DERIVED below, never typed twice
    n: '#45',        // how many rows (raster) or rings (concentric) — counted, not written out
    z: '#46',        // the level currently being cut
    y: '#47',        // the row's Y
    i: '#48',        // row / ring index
    dir: '#49',      // +1 / −1 — which way this row runs (both-ways raster only)
};
// t1339 — the ramp's run length. It shares the direction slot: a ramp happens at the FIRST row of a level, before
// any direction flip has been read, so the two never overlap.
V.run = '#49';
// The ring walk reuses one of the same slots for its inset: a ring and a row are never walked at the same time, so
// a separate var would be a second name for one register.
const RING_INSET = V.y;
// t1343 — the helix recurrence's own registers, in the extended band.
const HX = { vx: '#34', vy: '#35', tmp: '#36', k: '#37', segs: '#38', rev: '#39' };

/**
 * The parametric body for a whole surfacing op: header, depth loop, and the strategy's own inner walk.
 * @param {object} p  w,h,depth,stepdown,toolDia,stepoverPct (or stepover mm),feed,plunge,clearance,x,y,strategy,direction
 */
export function surfaceRasterLines(p = {}) {
    const w = num(p.w, 100), h = num(p.h, 80);
    const depth = num(p.depth, 0.5), stepdown = Math.max(0.01, num(p.stepdown, 0.5));
    const tool = Math.max(0.1, num(p.toolDia, 12));
    // ONE DERIVATION, shared with the CAM slot: stepover is tool Ø × %. When a caller still carries a flat mm (the
    // data-op twin does), the pct is recovered from it against the tool it will run — the same recovery opCamMap
    // does, so the two paths cannot disagree about what a stored millimetre meant.
    const pct = (p.stepoverPct != null && p.stepoverPct !== '')
        ? num(p.stepoverPct, 60)
        : (num(p.stepover, 0) > 0 ? Math.round((num(p.stepover, 0) / tool) * 1000) / 10 : 60);
    const feed = num(p.feed, 2000), plunge = num(p.plunge, 200), clr = num(p.clearance, 5);
    // t1351 — THE ATOM CARRIES ITS OWN FRAME. x0/y0 were always here; z0 is new, and it is what makes the frame
    // COMPLETE: the surface the depths are measured down from. Together they are the placement shift, absorbed as
    // PARAMS instead of applied to the emitted text afterwards (t1349 measured what the text rewrite does to
    // expressions and registers — a half-shifted move and a corrupted comment). At the zero frame every expression
    // below collapses to exactly what it emitted before, which the bridge asserts byte-for-byte.
    const x0 = num(p.x, 0), y0 = num(p.y, 0), z0 = num(p.z0, 0);
    const confirmEvery = Math.max(0, Math.round(num(p.confirmEvery, 0)));
    const r3 = (n) => Math.round(n * 1000) / 1000;
    const zTop = r3(z0);   // the surface this op faces from — 0 in the op's own frame, the placement's offZ when placed

    /**
     * t1355 — ONE BODY, TWO FRAMES. Every coordinate below is "the op's origin PLUS an offset". What changes between
     * the placed body and the SKIM body is only what the origin IS: a build-time number, or a register the machine
     * fills in at run time from wherever the operator jogged to.
     *
     * `ax(rel)` folds the sum at build time when the origin is a number — so a placed op emits `X3.6`, byte-for-byte
     * what it emitted before this existed. When the origin is a REGISTER the sum cannot be folded, so it stays an
     * expression the controller evaluates: `X[#35 + 3.6]`. `axE()` is the same idea for an offset that is itself a
     * runtime term (`#40`, `#44`), which is why the placed body already wrote `X[0 + #40]`.
     *
     * All the build-time GEOMETRY is frame-independent and needs no version: a distance-to-centre, a unit vector, a
     * ring inset and the rotation constants are the same numbers wherever the origin sits. That is what makes this a
     * substitution rather than a second emitter.
     */
    const skim = String(p.zMode || '') === 'skim';
    const F = skim ? { ...SKIM_FRAME, live: true } : { x: String(r3(x0)), y: String(r3(y0)), z: String(zTop), live: false };
    const ax = (rel = 0) => (F.live ? (rel ? `[${F.x} + ${r3(rel)}]` : `${F.x}`) : `${r3(x0 + rel)}`);
    const ay = (rel = 0) => (F.live ? (rel ? `[${F.y} + ${r3(rel)}]` : `${F.y}`) : `${r3(y0 + rel)}`);
    const az = (rel = 0) => (F.live ? (rel ? `[${F.z} + ${r3(rel)}]` : `${F.z}`) : `${r3(z0 + rel)}`);
    // origin + a build-time offset + a RUNTIME term. The offset folds into the origin when the origin is a number,
    // so a placed body keeps writing `[103.6 + #49 * 0.8]` rather than growing a `0 +` nobody asked for.
    const axE = (rel, expr) => (F.live ? (rel ? `[${F.x} + ${r3(rel)} + ${expr}]` : `[${F.x} + ${expr}]`) : `[${r3(x0 + rel)} + ${expr}]`);
    const ayE = (rel, expr) => (F.live ? (rel ? `[${F.y} + ${r3(rel)} + ${expr}]` : `[${F.y} + ${expr}]`) : `[${r3(y0 + rel)} + ${expr}]`);
    const azE = (expr) => `[${F.z} ${expr}]`;        // expr carries its own sign, e.g. '- #46'

    // THE STRATEGY DECIDES THE WALK, under the SAME header and the SAME depth loop — the loop that counts levels
    // does not care what happens inside it, which is why adding a strategy is a new walk and not a new emitter.
    const stepBaked = tool * pct / 100;   // the stepover AT BUILD VALUES — what the baked ramp geometry is computed for
    const opts = { x0, y0, zTop, w, h, feed, plunge, clr, r3, F, ax, ay, az, axE, ayE, azE, entry: p.entry || 'plunge', rampAngle: num(p.rampAngle, 3),
        helixDia: num(p.helixDia, 0), helixPitch: num(p.helixPitch, 1), toolDia: tool, stepBaked };
    const walk = (p.strategy === 'concentric') ? ringWalk(opts) : rowWalk(opts);

    // THE SKIM PREAMBLE. Seed an impossible value, read the frame, then REFUSE if it did not arrive — before any
    // motion at all. A position of 0 is perfectly legal (the operator may jog to the WCS origin), so the sentinel is
    // a value no axis can hold rather than a falsy test: the thing being detected is "the read did not happen".
    const preamble = !skim ? [] : [
        '( ---- SKIM: the frame is READ from the machine, never assumed ---- )',
        `${SKIM_FRAME.x}=${FRAME_SENTINEL}   ( sentinel: no axis can be here, so an unread frame is visible )`,
        `${SKIM_FRAME.y}=${FRAME_SENTINEL}`,
        `${SKIM_FRAME.z}=${FRAME_SENTINEL}`,
        `${SKIM_FRAME.x}=${FRAME_SRC.x}   ( live work X — wherever the operator jogged to )`,
        `${SKIM_FRAME.y}=${FRAME_SRC.y}   ( live work Y )`,
        `${SKIM_FRAME.z}=${FRAME_SRC.z}   ( live work Z — the touched surface )`,
        `IF ${SKIM_FRAME.x} == ${FRAME_SENTINEL} GOTO 93   ( no frame -> refuse, with the tool still up )`,
        `IF ${SKIM_FRAME.y} == ${FRAME_SENTINEL} GOTO 93`,
        `IF ${SKIM_FRAME.z} == ${FRAME_SENTINEL} GOTO 93`,
        '',
    ];
    const refusal = !skim ? [] : [
        'GOTO 94',
        'N93',
        '#1505=1   ;ERROR: could not read the live position - skim needs the jog frame',
        'N94',
    ];

    return [
        ...preamble,
        '( ---- SURFACING, parametric. Every var below speaks; change one and the loops re-derive. ---- )',
        `${V.w}=${r3(w)}   ( area X — the tool-CENTRE sweep, so the tool overhangs the edge )`,
        `${V.h}=${r3(h)}   ( area Y )`,
        `${V.depth}=${r3(depth)}   ( total depth to face off )`,
        `${V.stepdown}=${r3(stepdown)}   ( bite per level )`,
        `${V.step}=[${r3(tool)} * ${r3(pct)} / 100]   ( stepover mm = tool Ø ${r3(tool)} x ${r3(pct)}% — the CAM derives it the same way )`,
        `IF ${V.step} <= 0 GOTO 91   ( a zero stepover divides by zero below; refuse cleanly instead of looping forever )`,
        `IF ${V.stepdown} <= 0 GOTO 91`,
        ...walk.count,
        '',
        `${V.z}=0   ( the level being cut )`,
        `G0 Z${az(clr)}   ( clear before the first plunge )`,
        `WHILE [${V.z} < ${V.depth}] DO1   ( depth: one pass per level, the last bite clamped to the total )`,
        `  ${V.z}=[${V.z} + ${V.stepdown}]`,
        `  IF ${V.z} > ${V.depth} THEN ${V.z}=${V.depth}`,
        ...walk.body,
        `  G0 Z${az(clr)}   ( clear of the work before the next level )`,
        // t1335 — CONFIRM EVERY N LEVELS. The pause word is M00 with the operator sentence the literal path already
        // uses, matched rather than modernised: the machine's own convention is not something to improve in passing.
        // It fires after every Nth level EXCEPT the last — a pause after the final pass would stop the program on a
        // finished part. `#48` is free here: the row/ring index is spent by the time the level ends.
        ...(confirmEvery > 0 ? [
            `  ${V.i}=[${V.z} / ${V.stepdown}]   ( which level just finished )`,
            `  IF ${V.z} >= ${V.depth} GOTO 31   ( the last pass needs no pause — the part is done )`,
            `  IF [${V.i} / ${r3(confirmEvery)} - FIX[${V.i} / ${r3(confirmEvery)}]] > 0.001 GOTO 31   ( not an Nth level )`,
            '  M00   ( pause - press Cycle Start to resume )',
            '  N31',
        ] : []),
        'END1',
        'GOTO 92',
        'N91',
        '#1505=1   ;ERROR: stepover / stepdown must be greater than zero',
        'N92',
        ...refusal,
    ];
}

/**
 * THE PARALLEL RASTER — rows across the area.
 *
 * It keeps the tool DOWN: cut across, step over AT DEPTH, come back — one plunge per level.
 *
 * THERE IS NO ONE-WAY VARIANT HERE, and that is a correction to my own earlier finding rather than an omission.
 * t1331 listed `direction: 'oneway'` as an uncovered gap, measured from a test that passed the param straight to
 * both emitters. It is not a gap: `surfacingStack` hard-codes `direction: 'bothways'` on the fill block (the twin's
 * own comment says so too), so a surfacing op CANNOT emit a one-way raster and no user config reaches it. A
 * parametric one-way walk was written and then deleted — machinery for a case this op does not have.
 */
function rowWalk({ x0, y0, zTop, w, h, feed, plunge, clr, r3, F, ax, ay, az, axE, ayE, azE, entry, rampAngle, helixDia, helixPitch, toolDia, stepBaked }) {
    void clr;
    // t1339 — THE LEVEL'S DESCENT. Plunge is the straight drop; RAMP walks toward the area centre at the declared
    // angle and comes back. See rampLines for why toC and 1/tan are BAKED and what that costs.
    const descent = (entry === 'ramp')
        ? rampLines({ x0, y0, zTop, w, h, feed, plunge, rampAngle, stepBaked, r3, F, ax, ay, az, axE, ayE, azE })
        : (entry === 'helix')
            ? helixLines({ x0, y0, zTop, w, h, feed, plunge, helixDia, helixPitch, toolDia, stepBaked, r3, F, ax, ay, az, axE, ayE, azE })
            : [`    G1 Z${azE('- ' + V.z)} F${r3(plunge)}   ( the ONE plunge of this level )`];
    const count = [
        // THE ROW COUNT — not h/step rounded up. Rows sit at step/2 + i·step, so the count is how many of THOSE land
        // inside the area. The two formulas agree at 150/7.2 and 40/5 and disagree at 60/7.2 (8 rows, not 9), where
        // rounding up puts a row at 61.2 — off the far edge of a 60mm face, cutting air.
        `${V.n}=[FIX[[${V.h} - ${V.step} / 2] / ${V.step}] + 1]   ( rows that FIT: the last lands inside the area, not past it )`,
        `IF ${V.n} < 1 THEN ${V.n}=1   ( a face narrower than one stepover is still one row )`,
    ];
    const rowY = `    ${V.y}=${ayE(0, `${V.step} / 2 + ${V.i} * ${V.step}`)}`;
    return { count, body: [
        `  ${V.i}=0`,
        // EVERY LEVEL STARTS AT THE NEAR CORNER, going +X. Carrying the direction over from the previous level looked
        // tidier and is not what the machine does — with an odd row count level 2 would start at the far end and run
        // backwards. The equivalence bridge caught it at move 42 of 84.
        `  ${V.dir}=1   ( the raster restarts at the near corner for each level )`,
        `  WHILE [${V.i} < ${V.n}] DO2   ( rows: counted above, so the area and the stepover decide how many )`,
        rowY,
        `    IF ${V.i} > 0 GOTO 13   ( already down: step over at depth rather than lifting between rows )`,
        // WHICH END TO START AT — asked as a BRANCH, not as a comparison inside an expression. `[#49 < 0]` looked
        // like it would evaluate 0/1 and the tracer read it as a plain 1, putting the first plunge off the corner.
        `    IF ${V.dir} < 0 GOTO 17`,
        `    G0 X${ax()} Y${V.y}`,
        '    GOTO 18',
        '    N17',
        `    G0 X${axE(0, V.w)} Y${V.y}`,
        '    N18',
        ...descent,
        '    GOTO 14',
        '    N13',
        `    G1 Y${V.y} F${r3(feed)}   ( step over at depth — the tool does not lift between rows )`,
        '    N14',
        `    IF ${V.dir} < 0 GOTO 15`,
        `    G1 X${axE(0, V.w)} F${r3(feed)}`,
        '    GOTO 16',
        '    N15',
        `    G1 X${ax()} F${r3(feed)}`,
        '    N16',
        `    ${V.dir}=[0 - ${V.dir}]`,
        `    ${V.i}=[${V.i} + 1]`,
        '  END2',
    ] };
}

/**
 * THE RAMP DESCENT — toward the area centre, at the declared angle, then back to the start.
 *
 * WHAT IS BAKED AND WHY (the t1339 ruling, with its reasoning so the next reader does not have to reconstruct it):
 * the run needed is `drop / tan(angle)` and the midpoint is `start + (run / toC) · (centre − start)`. `tan(angle)`
 * is a build-time number — the angle is a form field, not a pendant knob — so `1/tan` is baked. `toC`, the distance
 * from the ramp start to the centre, is ALSO baked, and that one has a cost worth naming: the ramp start sits at
 * `y0 + step/2`, and `step` is the DERIVED stepover a pendant can change. Computing toC live would need SQRT, which
 * is UNVERIFIED on this controller (the linter's word list is an allow-list, not evidence; ATAN ships in the
 * alignment probe but proves only itself — V13_trig.nc is the decider).
 *
 * SO THE HAZARD IS REAL BUT BOUNDED: a baked toC under a pendant-edited stepover gives a kinked entry. It cannot
 * happen on the WIZARD path — that text is fixed at build values and consistent forever, which is what makes the
 * equivalence bridge true. It can only happen where a pendant edits the knob, i.e. a CAM SLOT — so the slot GATES
 * those knobs bake-only rather than this code guessing (see the entry gate in opCamMap).
 *
 * TODO (improvement turn, post-switch): pendant-TRUE entries — the +X declared run vector (no square root at all,
 * the literal kernel already supports it via runX/runY) or live-SQRT if V13 proves it; plus the true-arc helix with
 * start/end points, radius envelope and depth-per-revolution as the substitute criteria. That turn lifts the gate.
 */
function rampLines({ x0, y0, zTop, w, h, feed, plunge, rampAngle, stepBaked, r3, F, ax, ay, az, axE, ayE, azE }) {
    const ang = Math.min(45, Math.max(0.5, rampAngle));
    const invTan = 1 / Math.tan(ang * Math.PI / 180);
    // the ramp starts where the plunge would: the first row, at build values
    const sx = x0, sy = y0 + stepBaked / 2;
    const cx = x0 + w / 2, cy = y0 + h / 2;
    const toC = Math.hypot(cx - sx, cy - sy);
    const ux = toC > 1e-9 ? (cx - sx) / toC : 0, uy = toC > 1e-9 ? (cy - sy) / toC : 0;
    // A DIRECTION COSINE NEEDS MORE DIGITS THAN A COORDINATE. Rounded to 3 decimals like everything else, the ramp's
    // midpoint landed 0.01mm off the literal's — invisible in the text, caught by the bridge. A unit vector is
    // multiplied by the run, so its error is scaled: 6 decimals keeps the product inside the emit's own rounding.
    const u6 = (n) => Math.round(n * 1e6) / 1e6;
    return [
        `    ${V.run}=[${V.stepdown} * ${r3(invTan)}]   ( ramp run = bite / tan(${r3(ang)}deg) — the tangent is baked; the angle is a form field, not a knob )`,
        // THE HONEST DEGRADE, kept from the literal kernel: when the run to the centre is longer than the distance
        // available, a ramp cannot be cut and the tool plunges instead — with the reason in the program, not silently.
        `    IF ${V.run} > ${r3(toC)} GOTO 41   ( ramp needs more run than the ${r3(toC)}mm to centre -> plunge )`,
        `    G0 Z${azE(`- ${V.z} + ${V.stepdown}`)}   ( down to the floor this level starts from )`,
        `    G1 X${axE(sx - x0, `${V.run} * ${u6(ux)}`)} Y${ayE(sy - y0, `${V.run} * ${u6(uy)}`)} Z${azE(`- ${V.z}`)} F${r3(feed)}   ( ramp )`,
        `    G1 X${ax(sx - x0)} Y${ay(sy - y0)} F${r3(feed)}   ( back to the row start, now at depth )`,
        '    GOTO 42',
        '    N41',
        `    G1 Z${azE(`- ${V.z}`)} F${r3(plunge)}   ( the ramp did not fit — straight plunge )`,
        '    N42',
    ];
}

/**
 * THE HELIX DESCENT — a descending helix at the area centre, then a cut back to the row start at depth.
 *
 * IT IS A POLYLINE, NOT AN ARC, and that is deliberate for the MIGRATION: the literal kernel emits 24 straight G1
 * segments per revolution, so matching it move-for-move keeps the safety argument mechanical. Emitting true G2/G3
 * arcs is better G-code and the tracer handles variable-fed arcs (measured at t1335) — it is the improvement turn's
 * job, with its own criteria, not a rider on a migration.
 *
 * ── THE ROTATION RECURRENCE, AND WHY 9 DECIMALS ──────────────────────────────────────────────────────────────────
 * Trig is UNVERIFIED on this controller, so the macro cannot call COS/SIN. Instead Studio bakes cos/sin of ONE
 * segment angle and the loop rotates a vector: x' = x·c − y·s, y' = x·s + y·c — four multiplies and two adds.
 *
 * A rotation constant is multiplied EVERY segment, so its rounding error COMPOUNDS. Rounding c,s to d decimals
 * gives each entry an error ≤ 5·10^−(d+1); the radial error grows by roughly 2·ε·R per step, so over one revolution
 * (24 steps) the worst case is ≈ 48·ε·R. At R = 50mm — larger than any realistic surfacing helix:
 *     6 decimals → ≈ 1.2e−3 mm   AT the emit's own 0.001mm rounding: a coordinate can tip to the wrong 3rd decimal
 *     9 decimals → ≈ 1.2e−6 mm   three orders below what the emit can express
 * So 9 it is. And the vector is RE-SEEDED at the start of every revolution, which caps the compounding at 24 steps
 * no matter how deep the descent runs. THE TWO ARE SEPARATE REQUIREMENTS: re-seeding alone still leaves 1.2e−3 at
 * 6 decimals, and 9 decimals alone would drift without bound on a deep descent. The bound holds only with both.
 */
function helixLines({ x0, y0, zTop, w, h, feed, plunge, helixDia, helixPitch, toolDia, stepBaked, r3, F, ax, ay, az, axE, ayE, azE }) {
    const SEG = 24, theta = 2 * Math.PI / SEG;
    // NINE decimals — see the derivation above. r3 would be catastrophic here for exactly the reason t1339 found
    // one level down, and 6 is not enough either.
    const d9 = (n) => Number(n.toFixed(9));
    const c = d9(Math.cos(theta)), sn = d9(Math.sin(theta));
    const cx = x0 + w / 2, cy = y0 + h / 2;
    const sx = x0, sy = y0 + stepBaked / 2;             // the row start the descent returns to
    const inrad = Math.min(w, h) / 2;                   // rect inradius, the literal's own clamp source
    const wantR = helixDia > 0 ? helixDia / 2 : Math.max(0.1, toolDia) / 2;
    const R = Math.max(0.2, Math.min(wantR, inrad - 0.01));
    const pitch = Math.max(0.1, helixPitch);
    return [
        `    ${HX.segs}=[FUP[${V.stepdown} / ${r3(pitch)}] * ${SEG}]   ( segments: ${SEG} per rev, at ${r3(pitch)}mm per rev )`,
        `    IF ${HX.segs} < ${SEG} THEN ${HX.segs}=${SEG}   ( never less than one revolution )`,
        `    G0 X${ax(cx + R - x0)} Y${ay(cy - y0)}   ( the helix starts on its own radius, at the area centre )`,
        `    G0 Z${azE(`- ${V.z} + ${V.stepdown}`)}   ( the floor this level starts from )`,
        `    ${HX.vx}=${r3(R)}   ( the rotating vector, re-seeded every revolution so the drift cannot accumulate )`,
        `    ${HX.vy}=0`,
        `    ${HX.k}=0`,
        `    ${HX.rev}=0`,
        `    WHILE [${HX.k} < ${HX.segs}] DO3   ( one straight segment per step — a polyline helix, as the literal is )`,
        `      ${HX.k}=[${HX.k} + 1]`,
        `      ${HX.rev}=[${HX.rev} + 1]`,
        // RE-SEED: at the top of each new revolution the vector returns to its exact starting value, so the
        // compounding above can never run past 24 steps however deep the descent goes.
        `      IF ${HX.rev} <= ${SEG} GOTO 51`,
        `      ${HX.rev}=1`,
        `      ${HX.vx}=${r3(R)}   ( re-seed )`,
        `      ${HX.vy}=0`,
        '      N51',
        `      ${HX.tmp}=[${HX.vx} * ${c} - ${HX.vy} * ${sn}]   ( rotate by ${r3(360 / SEG)}deg: 4 multiplies, 2 adds, no trig )`,
        `      ${HX.vy}=[${HX.vx} * ${sn} + ${HX.vy} * ${c}]`,
        `      ${HX.vx}=${HX.tmp}`,
        `      G1 X${axE(cx - x0, HX.vx)} Y${ayE(cy - y0, HX.vy)} Z${azE(`- ${V.z} + ${V.stepdown} - ${V.stepdown} * ${HX.k} / ${HX.segs}`)} F${r3(feed)}`,
        '    END3',
        `    G1 X${ax(sx - x0)} Y${ay(sy - y0)} Z${azE(`- ${V.z}`)} F${r3(feed)}   ( helix — out to the row start, now at depth )`,
        `    IF ${V.z} > 0 GOTO 52`,
        `    G1 Z${azE(`- ${V.z}`)} F${r3(plunge)}`,
        '    N52',
    ];
}

/**
 * THE CONCENTRIC WALK — inset rectangles, inward. Pure arithmetic, as the literal kernel is: each ring is the area
 * shrunk by `inset` on every side, and the walk stops when a ring would collapse. The tool steps to the next ring on
 * a DIAGONAL CUTTING move and never lifts within a level — one plunge, like the both-ways raster.
 */
function ringWalk({ x0, y0, zTop, w, h, feed, plunge, clr, r3, F, ax, ay, az, axE, ayE, azE }) {
    void clr;
    const inX = axE(0, RING_INSET);
    const inY = ayE(0, RING_INSET);
    const outX = axE(0, `${V.w} - ${RING_INSET}`);
    const outY = ayE(0, `${V.h} - ${RING_INSET}`);
    return {
        count: [
            // THE RING COUNT — how many insets fit before the SHORTER side closes. The shorter side is resolved here
            // rather than in the macro because it is a fact about the AREA, not a dial the operator turns. The
            // −0.001 is the collapse BOUNDARY, not a fudge: at h exactly 2·k·step the k-th ring has zero height, and
            // the literal kernel does not walk it either (its `bx-ax < 1e-6` break is the same test).
            `${V.n}=[FIX[[${r3(Math.min(w, h))} - 0.001] / [2 * ${V.step}]] + 1]   ( rings that FIT before the middle closes )`,
            `IF ${V.n} < 1 THEN ${V.n}=1`,
        ],
        body: [
            `  ${RING_INSET}=0   ( how far in this ring sits )`,
            `  ${V.i}=0`,
            `  WHILE [${V.i} < ${V.n}] DO2   ( rings, inward )`,
            `    IF ${V.i} > 0 GOTO 21`,
            `    G0 X${inX} Y${inY}`,
            `    G1 Z${azE(`- ${V.z}`)} F${r3(plunge)}   ( the ONE plunge of this level )`,
            '    GOTO 22',
            '    N21',
            `    G1 X${inX} Y${inY} F${r3(feed)}   ( diagonal step in to the next ring, still cutting )`,
            '    N22',
            `    G1 X${outX} Y${inY} F${r3(feed)}`,
            `    G1 X${outX} Y${outY} F${r3(feed)}`,
            `    G1 X${inX} Y${outY} F${r3(feed)}`,
            `    G1 X${inX} Y${inY} F${r3(feed)}`,
            `    ${RING_INSET}=[${RING_INSET} + ${V.step}]`,
            `    ${V.i}=[${V.i} + 1]`,
            '  END2',
        ],
    };
}

/**
 * WHAT THIS ATOM COVERS — declared, because the switch-over depends on it and a silent gap here would DROP FEATURES.
 *
 * t1335: the confirm-every-N pause is in (M00 after every Nth level except the last, the literal path's own word).
 * What remains is the DESCENT alone — see the note on helix in the work log: the literal helix is a 24-segment G1
 * POLYLINE, not an arc, so "move-for-move" is the wrong criterion for it until we choose what it should emit.
 *
 * t1333: CONCENTRIC rings are now walked parametrically and proven move-for-move against the literal kernel. The
 * one-way raster turned out NOT to be a gap at all — surfacing hard-codes both-ways, so no config reaches it (see
 * rowWalk). What remains is genuinely two things: the DESCENT (ramp / helix) and the confirm-every-N pause.
 *
 * The boundary is a predicate rather than a comment: a caller asks whether a config is inside the proven envelope
 * instead of assuming it is. Retiring the literal emitter means closing what is left — every `false` below is a
 * feature that would otherwise vanish on the day the old path dies.
 */
export function surfaceRasterCovers(p = {}) {
    // t1345 — every strategy (parallel, concentric), every descent (plunge, ramp, helix) and the confirm cadence were
    // each closed by their own bridge, in their own turn, against hand-derived truths.
    // t1349 — the scope of that claim was the BODY, and saying so was the finding: every bridge frames this body BARE.
    // t1351 — SCOPE EXTENDED TO THE PLACED PROGRAM. The atom now carries its own frame (x0/y0/z0) instead of having a
    // placement applied to its text afterwards, and the placement bridges prove the absorbed frame equals the shipping
    // placed literal move for move. So a PLACED surfacing op is inside the envelope.
    //
    // t1355 — SKIM CLOSES, and it closed the way the last three did: by becoming the SAME body, not a second one.
    // The atom reads the jog frame into three registers at the top and its ordinary absolute body runs over them, so
    // every strategy and every descent came along for free rather than each needing its own G91 derivation. The
    // envelope is empty again, now at FULL-PROGRAM scope — body, placement AND Z-mode.
    return true;
}

/** Why a config is outside the envelope, in the words a reader needs — never a bare false. */
export function surfaceRasterGap() { return ''; }

export const surfaceRasterBlock = {
    type: 'surfaceraster', label: 'Surface Raster (parametric)', kind: 'leaf', category: 'Transforms',
    // t1351 — z0 joins x/y: the block's declared FRAME. And the five that `lines()` already reads were missing from
    // this declaration entirely (entry/rampAngle/helixDia/helixPitch/confirmEvery) — a declaration that disagrees with
    // its own emitter is a feature DROP waiting for the day this atom round-trips through the canvas, so it is closed
    // here rather than left for the switch to discover. Defaults match the emitter's own num() fallbacks exactly.
    defaults: { x: 0, y: 0, z0: 0, w: 100, h: 80, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5, strategy: 'parallel', direction: 'bothways', entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1, confirmEvery: 0 },
    fields: ['x', 'y', 'z0', 'w', 'h', 'depth', 'stepdown', 'toolDia', 'stepoverPct', 'feed', 'plunge', 'clearance', 'strategy', 'direction', 'entry', 'rampAngle', 'helixDia', 'helixPitch', 'confirmEvery'],
    scratch: RASTER_SCRATCH,   // read by universalScratch.opBands() — the band is data, not a comment
    // t1361 — THE DECLARED FOOTPRINT, and the ONE thing the collapse dropped. `surfacefill` declared an `extent` and
    // the place fold reads it (liveExtent) IN PREFERENCE to placeonstock's frozen bminX..bmaxX snapshot; folding
    // stepdown{surfacefill} into this atom left the declaration behind, so a placed op silently fell back to whatever
    // size the snapshot was frozen at. Measured, not inferred: a twin at w=150 on a 200 stock, cc-attach, placed its
    // face at X50 — the shift computed for the template's default 100 — against the built-in's X25. Every caller whose
    // live w/h can differ from the snapshot hits it (the data twin, whose template IS frozen at the defaults, and the
    // Blocks canvas, where editing w/h does not rewrite the parent's snapshot).
    // The rect is the tool-CENTRE sweep at the atom's own local frame, exactly the bbox surfacefill's region contour
    // gave for shape:'rect' — so the built-in is unmoved (its snapshot was already built from the same w/h).
    extent: (p) => ({ minX: num(p.x, 0), maxX: num(p.x, 0) + num(p.w, 100), minY: num(p.y, 0), maxY: num(p.y, 0) + num(p.h, 80) }),
    lines: (p) => surfaceRasterLines(p),
    // t1359 — THE LEAF CONTRACT. blockEmitter's default leaf path calls def.emit(p, dx, dy, dialect); `lines` above is
    // the pure body other readers use. dx/dy are the STAMP offsets a container (Array/Path) applies to a child — zero
    // for surfacing, which is never stamped, but folded into the frame rather than ignored so the atom stays correct
    // if it is ever placed under one.
    emit: (p, dx = 0, dy = 0) => surfaceRasterLines({ ...p, x: num(p.x, 0) + (Number(dx) || 0), y: num(p.y, 0) + (Number(dy) || 0) }),
    // t1359 — THE DECLARED PLACEMENT SEAM. This atom takes its frame as PARAMS; the place fold reads this and passes
    // x0/y0/z0 in instead of rewriting the emitted text (which cannot work on expressions — t1349 measured it).
    absorbsPlacement: true,
};
