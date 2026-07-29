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
export const RASTER_SCRATCH = [[34, 49]];

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

    // THE STRATEGY DECIDES THE WALK, under the SAME header and the SAME depth loop — the loop that counts levels
    // does not care what happens inside it, which is why adding a strategy is a new walk and not a new emitter.
    const stepBaked = tool * pct / 100;   // the stepover AT BUILD VALUES — what the baked ramp geometry is computed for
    const opts = { x0, y0, zTop, w, h, feed, plunge, clr, r3, entry: p.entry || 'plunge', rampAngle: num(p.rampAngle, 3),
        helixDia: num(p.helixDia, 0), helixPitch: num(p.helixPitch, 1), toolDia: tool, stepBaked };
    const walk = (p.strategy === 'concentric') ? ringWalk(opts) : rowWalk(opts);

    return [
        '( ---- SURFACING, parametric. Every var below speaks; change one and the loops re-derive. ---- )',
        `${V.w}=${r3(w)}   ( area X — the tool-CENTRE sweep, so the tool overhangs the edge )`,
        `${V.h}=${r3(h)}   ( area Y )`,
        `${V.depth}=${r3(depth)}   ( total depth to face off )`,
        `${V.stepdown}=${r3(stepdown)}   ( bite per level )`,
        `${V.step}=[${r3(tool)} * ${r3(pct)} / 100]   ( stepover mm = tool Ø ${r3(tool)} x ${r3(pct)}% — the CAM derives it the same way )`,
        `IF ${V.step} LE 0 GOTO 91   ( a zero stepover divides by zero below; refuse cleanly instead of looping forever )`,
        `IF ${V.stepdown} LE 0 GOTO 91`,
        ...walk.count,
        '',
        `${V.z}=0   ( the level being cut )`,
        `G0 Z${r3(z0 + clr)}   ( clear before the first plunge )`,
        `WHILE [${V.z} LT ${V.depth}] DO1   ( depth: one pass per level, the last bite clamped to the total )`,
        `  ${V.z}=[${V.z} + ${V.stepdown}]`,
        `  IF ${V.z} GT ${V.depth} THEN ${V.z}=${V.depth}`,
        ...walk.body,
        `  G0 Z${r3(z0 + clr)}   ( clear of the work before the next level )`,
        // t1335 — CONFIRM EVERY N LEVELS. The pause word is M00 with the operator sentence the literal path already
        // uses, matched rather than modernised: the machine's own convention is not something to improve in passing.
        // It fires after every Nth level EXCEPT the last — a pause after the final pass would stop the program on a
        // finished part. `#48` is free here: the row/ring index is spent by the time the level ends.
        ...(confirmEvery > 0 ? [
            `  ${V.i}=[${V.z} / ${V.stepdown}]   ( which level just finished )`,
            `  IF ${V.z} GE ${V.depth} GOTO 31   ( the last pass needs no pause — the part is done )`,
            `  IF [${V.i} / ${r3(confirmEvery)} - FIX[${V.i} / ${r3(confirmEvery)}]] GT 0.001 GOTO 31   ( not an Nth level )`,
            '  M00   ( pause - press Cycle Start to resume )',
            '  N31',
        ] : []),
        'END1',
        'GOTO 92',
        'N91',
        '#1505=1   ;ERROR: stepover / stepdown must be greater than zero',
        'N92',
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
function rowWalk({ x0, y0, zTop, w, h, feed, plunge, clr, r3, entry, rampAngle, helixDia, helixPitch, toolDia, stepBaked }) {
    void clr;
    // t1339 — THE LEVEL'S DESCENT. Plunge is the straight drop; RAMP walks toward the area centre at the declared
    // angle and comes back. See rampLines for why toC and 1/tan are BAKED and what that costs.
    const descent = (entry === 'ramp')
        ? rampLines({ x0, y0, zTop, w, h, feed, plunge, rampAngle, stepBaked, r3 })
        : (entry === 'helix')
            ? helixLines({ x0, y0, zTop, w, h, feed, plunge, helixDia, helixPitch, toolDia, stepBaked, r3 })
            : [`    G1 Z[${zTop} - ${V.z}] F${r3(plunge)}   ( the ONE plunge of this level )`];
    const count = [
        // THE ROW COUNT — not h/step rounded up. Rows sit at step/2 + i·step, so the count is how many of THOSE land
        // inside the area. The two formulas agree at 150/7.2 and 40/5 and disagree at 60/7.2 (8 rows, not 9), where
        // rounding up puts a row at 61.2 — off the far edge of a 60mm face, cutting air.
        `${V.n}=[FIX[[${V.h} - ${V.step} / 2] / ${V.step}] + 1]   ( rows that FIT: the last lands inside the area, not past it )`,
        `IF ${V.n} LT 1 THEN ${V.n}=1   ( a face narrower than one stepover is still one row )`,
    ];
    const rowY = `    ${V.y}=[${r3(y0)} + ${V.step} / 2 + ${V.i} * ${V.step}]`;
    return { count, body: [
        `  ${V.i}=0`,
        // EVERY LEVEL STARTS AT THE NEAR CORNER, going +X. Carrying the direction over from the previous level looked
        // tidier and is not what the machine does — with an odd row count level 2 would start at the far end and run
        // backwards. The equivalence bridge caught it at move 42 of 84.
        `  ${V.dir}=1   ( the raster restarts at the near corner for each level )`,
        `  WHILE [${V.i} LT ${V.n}] DO2   ( rows: counted above, so the area and the stepover decide how many )`,
        rowY,
        `    IF ${V.i} GT 0 GOTO 13   ( already down: step over at depth rather than lifting between rows )`,
        // WHICH END TO START AT — asked as a BRANCH, not as a comparison inside an expression. `[#49 LT 0]` looked
        // like it would evaluate 0/1 and the tracer read it as a plain 1, putting the first plunge off the corner.
        `    IF ${V.dir} LT 0 GOTO 17`,
        `    G0 X${r3(x0)} Y${V.y}`,
        '    GOTO 18',
        '    N17',
        `    G0 X[${r3(x0)} + ${V.w}] Y${V.y}`,
        '    N18',
        ...descent,
        '    GOTO 14',
        '    N13',
        `    G1 Y${V.y} F${r3(feed)}   ( step over at depth — the tool does not lift between rows )`,
        '    N14',
        `    IF ${V.dir} LT 0 GOTO 15`,
        `    G1 X[${r3(x0)} + ${V.w}] F${r3(feed)}`,
        '    GOTO 16',
        '    N15',
        `    G1 X${r3(x0)} F${r3(feed)}`,
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
function rampLines({ x0, y0, zTop, w, h, feed, plunge, rampAngle, stepBaked, r3 }) {
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
        `    IF ${V.run} GT ${r3(toC)} GOTO 41   ( ramp needs more run than the ${r3(toC)}mm to centre -> plunge )`,
        `    G0 Z[${zTop} - ${V.z} + ${V.stepdown}]   ( down to the floor this level starts from )`,
        `    G1 X[${r3(sx)} + ${V.run} * ${u6(ux)}] Y[${r3(sy)} + ${V.run} * ${u6(uy)}] Z[${zTop} - ${V.z}] F${r3(feed)}   ( ramp )`,
        `    G1 X${r3(sx)} Y${r3(sy)} F${r3(feed)}   ( back to the row start, now at depth )`,
        '    GOTO 42',
        '    N41',
        `    G1 Z[${zTop} - ${V.z}] F${r3(plunge)}   ( the ramp did not fit — straight plunge )`,
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
function helixLines({ x0, y0, zTop, w, h, feed, plunge, helixDia, helixPitch, toolDia, stepBaked, r3 }) {
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
        `    IF ${HX.segs} LT ${SEG} THEN ${HX.segs}=${SEG}   ( never less than one revolution )`,
        `    G0 X${r3(cx + R)} Y${r3(cy)}   ( the helix starts on its own radius, at the area centre )`,
        `    G0 Z[${zTop} - ${V.z} + ${V.stepdown}]   ( the floor this level starts from )`,
        `    ${HX.vx}=${r3(R)}   ( the rotating vector, re-seeded every revolution so the drift cannot accumulate )`,
        `    ${HX.vy}=0`,
        `    ${HX.k}=0`,
        `    ${HX.rev}=0`,
        `    WHILE [${HX.k} LT ${HX.segs}] DO3   ( one straight segment per step — a polyline helix, as the literal is )`,
        `      ${HX.k}=[${HX.k} + 1]`,
        `      ${HX.rev}=[${HX.rev} + 1]`,
        // RE-SEED: at the top of each new revolution the vector returns to its exact starting value, so the
        // compounding above can never run past 24 steps however deep the descent goes.
        `      IF ${HX.rev} LE ${SEG} GOTO 51`,
        `      ${HX.rev}=1`,
        `      ${HX.vx}=${r3(R)}   ( re-seed )`,
        `      ${HX.vy}=0`,
        '      N51',
        `      ${HX.tmp}=[${HX.vx} * ${c} - ${HX.vy} * ${sn}]   ( rotate by ${r3(360 / SEG)}deg: 4 multiplies, 2 adds, no trig )`,
        `      ${HX.vy}=[${HX.vx} * ${sn} + ${HX.vy} * ${c}]`,
        `      ${HX.vx}=${HX.tmp}`,
        `      G1 X[${r3(cx)} + ${HX.vx}] Y[${r3(cy)} + ${HX.vy}] Z[${zTop} - ${V.z} + ${V.stepdown} - ${V.stepdown} * ${HX.k} / ${HX.segs}] F${r3(feed)}`,
        '    END3',
        `    G1 X${r3(sx)} Y${r3(sy)} Z[${zTop} - ${V.z}] F${r3(feed)}   ( helix — out to the row start, now at depth )`,
        `    IF ${V.z} GT 0 GOTO 52`,
        `    G1 Z[${zTop} - ${V.z}] F${r3(plunge)}`,
        '    N52',
    ];
}

/**
 * THE CONCENTRIC WALK — inset rectangles, inward. Pure arithmetic, as the literal kernel is: each ring is the area
 * shrunk by `inset` on every side, and the walk stops when a ring would collapse. The tool steps to the next ring on
 * a DIAGONAL CUTTING move and never lifts within a level — one plunge, like the both-ways raster.
 */
function ringWalk({ x0, y0, zTop, w, h, feed, plunge, clr, r3 }) {
    void clr;
    const inX = `[${r3(x0)} + ${RING_INSET}]`;
    const inY = `[${r3(y0)} + ${RING_INSET}]`;
    const outX = `[${r3(x0)} + ${V.w} - ${RING_INSET}]`;
    const outY = `[${r3(y0)} + ${V.h} - ${RING_INSET}]`;
    return {
        count: [
            // THE RING COUNT — how many insets fit before the SHORTER side closes. The shorter side is resolved here
            // rather than in the macro because it is a fact about the AREA, not a dial the operator turns. The
            // −0.001 is the collapse BOUNDARY, not a fudge: at h exactly 2·k·step the k-th ring has zero height, and
            // the literal kernel does not walk it either (its `bx-ax < 1e-6` break is the same test).
            `${V.n}=[FIX[[${r3(Math.min(w, h))} - 0.001] / [2 * ${V.step}]] + 1]   ( rings that FIT before the middle closes )`,
            `IF ${V.n} LT 1 THEN ${V.n}=1`,
        ],
        body: [
            `  ${RING_INSET}=0   ( how far in this ring sits )`,
            `  ${V.i}=0`,
            `  WHILE [${V.i} LT ${V.n}] DO2   ( rings, inward )`,
            `    IF ${V.i} GT 0 GOTO 21`,
            `    G0 X${inX} Y${inY}`,
            `    G1 Z[${zTop} - ${V.z}] F${r3(plunge)}   ( the ONE plunge of this level )`,
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
    // SKIM IS THE ONE REMAINING NAME, and it is named rather than assumed: a skim op is whole-op G91, which is not a
    // rewrite of this body but a different one (or the same one over a runtime frame — FINDINGS / V14_wcs_pos.nc).
    // Every `false` here is a feature that would VANISH the day the old path dies, so it stays false until its bridge.
    return String(p.zMode || '') !== 'skim';
}

/** Why a config is outside the envelope, in the words a reader needs — never a bare false. */
export function surfaceRasterGap(p = {}) {
    if (String(p.zMode || '') === 'skim') {
        return 'Skim Z-mode is a whole-op RELATIVE (G91) program, and a loop\'s deltas are runtime values — so it is a '
            + 'natively-relative body to write, not a transform of this one. Until that body exists (or the controller '
            + 'is proven to expose the live WCS position, which would let this body run over a runtime frame), a skim '
            + 'surfacing op must keep the literal emitter.';
    }
    return '';
}

export const surfaceRasterBlock = {
    type: 'surfaceraster', label: 'Surface Raster (parametric)', kind: 'leaf', category: 'Transforms',
    // t1351 — z0 joins x/y: the block's declared FRAME. And the five that `lines()` already reads were missing from
    // this declaration entirely (entry/rampAngle/helixDia/helixPitch/confirmEvery) — a declaration that disagrees with
    // its own emitter is a feature DROP waiting for the day this atom round-trips through the canvas, so it is closed
    // here rather than left for the switch to discover. Defaults match the emitter's own num() fallbacks exactly.
    defaults: { x: 0, y: 0, z0: 0, w: 100, h: 80, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5, strategy: 'parallel', direction: 'bothways', entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1, confirmEvery: 0 },
    fields: ['x', 'y', 'z0', 'w', 'h', 'depth', 'stepdown', 'toolDia', 'stepoverPct', 'feed', 'plunge', 'clearance', 'strategy', 'direction', 'entry', 'rampAngle', 'helixDia', 'helixPitch', 'confirmEvery'],
    scratch: RASTER_SCRATCH,   // read by universalScratch.opBands() — the band is data, not a comment
    lines: (p) => surfaceRasterLines(p),
};
