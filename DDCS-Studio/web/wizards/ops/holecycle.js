/**
 * wizards/ops/holecycle.js — THE DRILL FAMILY, EMITTED PARAMETRIC: a PATTERN of holes × a per-hole CYCLE (t1381).
 *
 * This is t1379's `holepeck` grown into the shape its own measurement forced. That turn landed the peck cycle and
 * measured the family; this one adds the two bore cycles and FOLDS THE PATTERN IN.
 *
 * ── WHY THE PATTERN HAD TO FOLD IN — a measurement, not a preference ──────────────────────────────────────────────
 * t1379 tried the obvious interim composition: leave `array` computing its points in JavaScript and stamp the
 * parametric cycle once per hole. ONLY THE FIRST HOLE DRILLS. The cause was isolated rather than assumed — two `DO1`
 * loops in one program are FINE (both holes drill), but two copies of the same `N`/`GOTO` labels are not: the second
 * copy's `GOTO` binds to the FIRST copy's label and execution never reaches the later holes. `uniquifySafeRetractLabels`
 * cannot reach it, because that mechanism uniquifies per BLOCK and a stamped block is ONE block emitted N times.
 *
 * So a flow-carrying body cannot be stamped, and the pattern cannot stay a build-time container. Folded in, the program
 * has ONE body with ONE label set and the collision cannot arise. (Two hole OPS in one program is a different question,
 * and it is answered by declaration — see `flowLabels` at the foot of this file.)
 *
 * ── WHAT IS LIVE AND WHAT IS BAKED, SAID PLAINLY ─────────────────────────────────────────────────────────────────
 * LIVE (a pendant can turn these on a running program): the CYCLE's knobs — total depth `#81` and the bite `#82`
 * (peck increment, or bore pitch). Those two are the whole point: `opToSlot.js` and `opCamMap.js` both record that the
 * universal CAM path "cannot expose depth/peck AT ALL, because drill.js peckDrill drives a JS while loop that unrolls
 * the peck sequence and bakes every Z literal at build time." This is what unblocks them.
 *
 * BAKED: the pattern's COUNT and any angle. The count is baked because the bolt circle's step angle is 2π/n and trig is
 * UNVERIFIED on this controller (so cos/sin of that angle must be computed at build time — see THE RECURRENCE below);
 * a live count would have nothing to rotate by. Baking the count is what t1379's digit derivation already assumed.
 * The pattern's continuous geometry (origin, spacing, radius, w/h) is baked into the point arithmetic for the same
 * reason: it is multiplied by baked trig. This is SCOPE, stated so nobody mistakes it for a gap.
 *
 * ── WHAT IT REPLACES, MEASURED (t1379's map) ──────────────────────────────────────────────────────────────────────
 *     per hole      peck d20/q2  30 lines | bore step d10/0.5  44 | bore HELIX d10/0.5  485
 *     bolt-24       drill 751 lines       | bore step 1087        | bore helix 11671  <- the app's largest unroll
 * The parametric body is a FIXED length whatever the depth and whatever the hole count. On a shallow single hole it is
 * LONGER than the literal (a loop has fixed overhead) — the same honest finding the surfacing pilot reported, and the
 * reason the win is stated as LIVE KNOBS rather than byte count.
 *
 * ── AND IT CANNOT RUN AWAY ────────────────────────────────────────────────────────────────────────────────────────
 * `bore.js` carries a runaway-pass guard because a pathological depth (the value-glow localizer perturbs a token to a
 * ~1e6 sentinel) would build tens of millions of lines in its synchronous loop and freeze the tab. A parametric body
 * cannot: the loop is emitted, not unrolled, so an absurd depth changes one number and nothing else. The glow-safety
 * cap is not needed here, which is a property worth asserting rather than a comment worth trusting.
 */
import { num, r3, val } from './util.js';
import { affineFrame } from './affineFrame.js';
import { patternPoints } from './array.js';
import { workMarker } from '../../engine/declaredWork.js';   // t1383 — this body DECLARES how much it executes; the tracer's cap reads it
import { toolFitRefusal, refusalLines } from './toolFit.js';   // t1444 — the ONE too-small boundary + the family's refusal form

/**
 * ── THE BAND ──────────────────────────────────────────────────────────────────────────────────────────────────────
 * #81–#89 · #75–#78 · #65–#69, and the FRAGMENTATION IS THE OCCUPANCY MAP, not a preference. `#1–#99` is the whole of
 * SCRATCH on this controller (varMap.js: `#100+` is the PERSISTENT uservar pool, which an atom must never squat), and
 * inside it the free runs are small. What is taken, and by whom:
 *
 *     #20–#33  the mill kit (millToSlot + camMacroKit's raster)      #50–#61  probeToSlot's results/temps
 *     #34–#49  surfaceraster                                        #62–#64  surfaceraster's FRAME ORIGIN (t1526:
 *                                                                           the skim read AND the hoisted live one)
 *     #70–#74  wcsBase / alignment span / writeAxis                 #79–#80  corner + alignment temps
 *     #90–#97  probeToSlot's signs and targets (camScratch)          #95  saferetract's saved machine Z (inside it)
 *     #99      the G53 staging var
 *
 * So this atom takes the three runs that are actually clear: #81–#89, #75–#78, #65–#69. Declared as DATA so
 * `universalScratch.opBands()` reads it rather than a comment re-deriving it.
 *
 * ⚠ #88 IS FREE, and t1379's band comment said it was taken. That claim was a misread of a STRING BUILD: the Expert
 * dialect writes `` `#88${slave}` `` to compose `#880`/`#881` (the dual-gantry machine registers), which greps as `#88`
 * and is not a variable at all. Checked before extending the band up onto it, because "the register next door is
 * taken" is exactly the kind of inherited claim that quietly costs a whole run.
 *
 * #66–#69 are declared but SPARE — headroom for the family's remaining cycles, on camScratch's own rule that it is
 * cheap to over-avoid and expensive to under-avoid.
 */
export const HOLE_SCRATCH = [[65, 69], [75, 78], [81, 89]];

/**
 * The registers, and the SHARING is justified by MUTUAL EXCLUSION — a body emits exactly ONE cycle, so the three
 * cycles' working registers overlay each other. That is surfaceraster's #34 precedent (the descent is exactly one of
 * plunge / ramp / helix, so the ramp's run and the helix's vector can never be live in the same program) rather than
 * the register-sharing t1375 had to UNDO, which shared two quantities that were both live at once.
 *
 * #81 and #82 keep t1379's exact meanings. That is deliberate: they are the two LIVE KNOBS an operator edits on the
 * pendant, so their numbers are the ones worth keeping stable across a rewrite. That inheritance made this atom and
 * `holepeck` declare an OVERLAPPING band for one turn, licensed only by both being pre-consumer; t1383 retired
 * `holepeck`, so this band now has a single claimant and the spec's exclusion is gone with it.
 */
const V = {
    depth: '#81',   // LIVE — total depth to drill / bore
    bite: '#82',    // LIVE — peck increment, or bore pitch per pass
    // the cycle's working registers, overlaid across the three cycles
    c1: '#83',      // peck: how deep we have got  | bore-step: same  | bore-helix: total segment count
    c2: '#84',      // peck: where the last peck stopped | bore-helix: the segment counter
    c3: '#85',      // bore-helix: the rotating vector's X
    c4: '#86',      // bore-helix: the rotating vector's Y
    c5: '#87',      // bore-helix: the rotate temp
    c6: '#88',      // bore-helix: the revolution counter (drives the re-seed)
    // the pattern's registers — live across the WHOLE loop, so they never overlay the cycle's
    k: '#89',       // the hole index, 0-based
    ox: '#75',      // this hole's X offset from the pattern origin
    oy: '#76',      // this hole's Y offset
    pa: '#77',      // circle: the rotating vector's X | grid: the column | rect: the edge index
    pb: '#78',      // circle: the rotating vector's Y | grid: the row    | rect: the side
    pt: '#65',      // circle: the rotate temp
};

/**
 * THE APPROACH MARGIN — the R plane, and it does two jobs with one number (t1381, ADOPTED BY RULING).
 *
 * Job one, the literal kernel's own: on peck 2..n, rapid back to this far above where the last peck stopped before
 * feeding on, so the tool never re-cuts material it has already cut.
 *
 * Job two, NEW and RULED: on the FIRST peck it is the reference plane the cycle rapids to before feeding — the
 * canonical G83 shape. The literal has no first-peck rapid at all, so it FEEDS from clearance through the air gap at
 * the drilling feed (7mm at 100mm/min on the default config — about four seconds per hole cutting nothing). t1379
 * reported that as a defect in the literal rather than reproducing it silently; the ruling is that it was an ARTIFACT
 * of the `prev > 0` guard and not intent, so the rapid becomes UNCONDITIONAL and the first cut starts here.
 *
 * ONE constant for both because it is one fact: how far above the last cut bottom the rapid stops — and on the first
 * peck the "last cut bottom" is the surface itself. Declared here rather than inlined so the ledger entry in the
 * bridge spec can name the number it sanctions.
 */
export const APPROACH = 0.5;

/** Segments per revolution of a helical bore — the literal kernel's own linearization, matched move for move. */
const SEG_PER_TURN = 24;

/** NINE decimals for anything a RECURRENCE feeds back through itself. Derived twice: t1343 for the surfacing helix,
 *  t1379 for the bolt circle. Six is NOT enough (2.4e-3 mm at just 24 holes on a 100mm radius — over two emit
 *  quanta). A one-shot mix needs only six, and that lives in affineFrame.js where the one-shot mixing lives. */
const d9 = (n) => Number(n.toFixed(9));

/** The declared cycles. `bore-step` and `bore-helix` are the literal `helicalBore`'s two ramp modes. */
export const CYCLES = ['peck', 'bore-step', 'bore-helix'];
/** The declared patterns — the five `holePatternPoints` actually walks, `single` (the default) included. t1520: the
 *  Blockly bridge used to reach for the ARRAY block's four-member `pattern` list, which has no `single`, so a one-hole
 *  drill came back from the canvas as a six-hole grid. Declared here, where the point generator defines them. */
export const PATTERNS = ['single', 'grid', 'line', 'circle', 'rect'];
export const cycleOf = (v) => (CYCLES.includes(v) ? v : 'peck');

/** The bore's cut RADIUS at build values — (hole Ø − tool Ø) / 2, the literal's own derivation. */
const boreRadius = (p) => (num(p.holeDia, 12) - num(p.toolDia, 6)) / 2;

/**
 * t1444 — the operator sentence for a BORE the tool cannot fit, or '' (peck is exempt — see `holeCycleLines`).
 * The span a bore offers is its hole Ø, so the boundary reads the same two numbers `boreRadius` does — which is what
 * keeps the refusal and the degenerate-plunge branch from ever disagreeing about where "equal" sits.
 */
export const holeCycleToolRefusal = (p = {}) => toolFitRefusal(num(p.holeDia, 12), num(p.toolDia, 6), 'hole');

/**
 * THE PATTERN, RESOLVED AT BUILD TIME — the count, and the points the runtime arithmetic must reproduce.
 *
 * `patternPoints` is the LITERAL's own point generator, imported rather than re-derived. That makes the extent, the
 * count and the bridge's truth agree with the shipping pattern BY CONSTRUCTION: if the two ever disagree it is this
 * atom's arithmetic that is wrong, and the bridge says so by comparing against this list.
 */
export function holePatternPoints(p = {}) {
    return patternPoints({ ...p, cx: num(p.x0, 0), cy: num(p.y0, 0) });
}

/** The 1-based hole indices the operator asked to skip — the emitter container's own parse, reproduced exactly.
 *  t2042 — EXPORTED: this is the ONE declared parse the real emit's IF/GOTO skip actually gates on; drillData.js's
 *  preview (drillPatternGeometry, shared by drill_data AND bore_data) drew every hole regardless of skip — a
 *  phantom hole the machine will never cut — and drillView.js's own classic view had an independent, byte-identical
 *  re-derivation (parseSkip) instead of importing this. Both now call this one function. */
export const skipSet = (p) => new Set(String(p.skip || '').split(/[ ,]+/).map((s) => parseInt(s, 10)).filter((n) => n > 0));

/**
 * ── THE PATTERN'S POINT ARITHMETIC, PER PATTERN ───────────────────────────────────────────────────────────────────
 * Each returns { seed, step } — lines that run ONCE before the loop, and lines that compute `ox`/`oy` for hole `k`
 * inside it. `advance` is for a pattern that carries state between holes (only the circle does).
 *
 * ONE LOOP, FIVE FORMULAS. The alternative — nested loops for the grid, a separate walk per pattern — was rejected
 * because it makes the loop shape depend on the pattern, and then `skip`, the cycle body and the label set all have to
 * be written more than once. With one loop over `k` the cycle body is emitted exactly once whatever the pattern is.
 */
/**
 * `coef` vs `r3` — THE SAME DISTINCTION t1339 DREW ONE LEVEL DOWN, and getting it wrong here is a real error I made
 * and measured before it shipped. A number the machine EMITS as a coordinate takes the emit's own 0.001mm quantum. A
 * number the machine MULTIPLIES by a runtime term is a COEFFICIENT, and rounding it to three decimals pushes the error
 * into the product: a line pattern's `spacing × cos(angle)` rounded to 0.001 and multiplied by hole index 10 is 5e-3 mm
 * out — FIVE emit quanta. Coefficients therefore carry nine decimals (`coef`), coordinates three (`r3`).
 */
function patternLines(pattern, p, coef) {
    const x0 = 0, y0 = 0;   // the pattern's origin is folded into the affine frame; these offsets are FROM it
    const seed = [], advance = [];
    let step = [];
    const n = holePatternPoints(p).length;

    if (pattern === 'circle') {
        // ── THE BOLT CIRCLE IS A RECURRENCE, and that is why it needs nine decimals (t1379's derivation) ──────────
        // The step angle is 2π/n, and trig is UNVERIFIED on this controller, so the macro cannot call COS/SIN. Studio
        // bakes cos/sin of ONE step and the loop rotates a vector: four multiplies, two adds, no trig. A rotation
        // constant multiplied EVERY hole means its rounding error COMPOUNDS — roughly 2·n·ε·R over the revolution —
        // so at 9 decimals a 200-hole circle on a 500mm radius stays ~1e-6 mm, three orders inside the emit's own
        // 0.001mm quantum. AND RE-SEEDING CANNOT HELP HERE, unlike the surfacing helix: a bolt circle makes exactly
        // ONE revolution, so there is nothing to re-seed to.
        const R = num(p.dia, 50) / 2;
        const a0 = num(p.startAngle, 0) * Math.PI / 180;
        const th = 2 * Math.PI / Math.max(1, n);
        const c = d9(Math.cos(th)), s = d9(Math.sin(th));
        // The SEED feeds the recurrence, so it is a coefficient's kind of number, not a coordinate's.
        seed.push(
            `${V.pa}=${coef(R * Math.cos(a0))}   ( the rotating vector — seeded at the start angle )`,
            `${V.pb}=${coef(R * Math.sin(a0))}`,
        );
        step = [`${V.ox}=${V.pa}`, `${V.oy}=${V.pb}`];
        // ROTATED AT THE FOOT of the body, so hole k uses the vector seeded for k and no branch is needed to skip the
        // first rotation. One extra rotate happens after the last hole, which costs three lines of arithmetic and no motion.
        advance.push(
            `${V.pt}=[${V.pa} * ${c} - ${V.pb} * ${s}]   ( rotate to the next hole: ${r3(360 / Math.max(1, n))}deg, no trig )`,
            `${V.pb}=[${V.pa} * ${s} + ${V.pb} * ${c}]`,
            `${V.pa}=${V.pt}`,
        );
    } else if (pattern === 'line') {
        // A LINE IS NOT A RECURRENCE — the offset is k times ONE baked constant, so nothing compounds and the
        // coefficient can carry its digits once. `spacing × cos(angle)` folds into a single number per axis.
        const s = num(p.spacing, 20), a = num(p.angle, 0) * Math.PI / 180;
        step = [
            `${V.ox}=[${V.k} * ${coef(s * Math.cos(a))}]`,
            `${V.oy}=[${V.k} * ${coef(s * Math.sin(a))}]`,
        ];
    } else if (pattern === 'rect') {
        // ── THE PERIMETER DEDUP IS A RANGE, NOT A HASH — and that is the finding this pattern turned up ──────────
        // The literal walks all four edges and drops repeats with a JS `Set`. t1379 flagged that as the awkward one,
        // because a hash does not translate to a macro walk. It does not need to: the ONLY repeats are the four
        // corners, which the vertical edges revisit at their first and last steps. So the dedup is exactly "walk the
        // verticals from 1 to ny−2 instead of 0 to ny−1" — reproduced by CONSTRUCTION, with no Set and no test.
        const w = num(p.w, 100), h = num(p.h, 80);
        const nx = Math.max(2, Math.round(num(p.nx, 2))), ny = Math.max(2, Math.round(num(p.ny, 2)));
        const A = 2 * nx;                       // the two horizontal edges, two points per column
        step = [
            `${V.pa}=FIX[${V.k} / 2]   ( which step along the edge )`,
            `${V.pb}=[${V.k} - ${V.pa} * 2]   ( which of the pair )`,
            `IF ${V.k} < ${A} GOTO@H   ( the horizontal edges come first, as the literal walks them )`,
            `${V.pa}=FIX[[${V.k} - ${A}] / 2]`,
            `${V.pb}=[${V.k} - ${A} - ${V.pa} * 2]`,
            `${V.ox}=[${V.pb} * ${coef(w)}]   ( vertical edge: left or right )`,
            `${V.oy}=[[${V.pa} + 1] * ${coef(h / (ny - 1))}]   ( rows 1..ny-2 — the corners are already drilled )`,
            'GOTO@V',
            'N@H',
            `${V.ox}=[${V.pa} * ${coef(w / (nx - 1))}]   ( horizontal edge: along the column )`,
            `${V.oy}=[${V.pb} * ${coef(h)}]   ( near side or far side )`,
            'N@V',
        ];
    } else if (pattern === 'single') {
        step = [`${V.ox}=0`, `${V.oy}=0`];
    } else {   // grid
        // cols/rows from ONE index: the literal pushes rows outer and columns inner, so k = row·cols + col. `FIX` is
        // integer truncation and is demonstrated in the shipped surfacing body (its row count and its Nth-level test).
        const cols = Math.max(1, Math.round(num(p.cols, 3)));
        const dx = num(p.dx, 20), dy = num(p.dy, 20);
        step = [
            `${V.pb}=FIX[${V.k} / ${cols}]   ( the row )`,
            `${V.pa}=[${V.k} - ${V.pb} * ${cols}]   ( the column )`,
            `${V.ox}=[${V.pa} * ${coef(dx)}]`,
            `${V.oy}=[${V.pb} * ${coef(dy)}]`,
        ];
    }
    return { n, seed, step, advance, x0, y0 };
}

/**
 * ── THE THREE CYCLES ──────────────────────────────────────────────────────────────────────────────────────────────
 * Each emits the body for ONE hole, positioned at the pattern offset the loop has just computed. They share the
 * header's `#81` depth and `#82` bite and differ only in what they do with them — which is exactly `surfaceraster`'s
 * shape (one header, one outer loop, a per-strategy inner walk) and the reason this is one atom and not three.
 */
function peckCycle({ feed, clr, A, azE, az }) {
    return [
        `  ${V.c1}=0   ( how deep we have got )`,
        `  ${V.c2}=0   ( where the previous peck stopped )`,
        `  G0 ${A}`,
        `  WHILE [${V.c1} < ${V.depth}] DO2   ( one peck per bite, the last clamped to the total )`,
        `    ${V.c2}=${V.c1}`,
        `    ${V.c1}=[${V.c1} + ${V.bite}]`,
        `    IF ${V.c1} > ${V.depth} THEN ${V.c1}=${V.depth}`,
        // THE R-PLANE RAPID, UNCONDITIONAL (ruled t1381). On peck 2..n `c2` is where the last one stopped; on the
        // FIRST peck it is still 0, so this resolves to the surface plus the margin — the plane a canonical G83
        // rapids to before it cuts. The branch this replaces is what used to make the body un-stampable.
        `    G0 Z${azE(`- ${V.c2} + ${APPROACH}`)}   ( R plane: just above the last cut — the surface, on peck 1 )`,
        `    G1 Z${azE(`- ${V.c1}`)} F${feed}   ( feed only the new increment )`,
        `    G0 Z${az(clr)}   ( full retract — clear the chips )`,
        '  END2',
    ];
}

function boreStepCycle({ feed, clr, r, ENTRY, IJ, azE, az }) {
    return [
        `  G0 ${ENTRY}   ( bore radius )`,
        `  G0 Z${az(clr)}`,
        `  ${V.c1}=0`,
        `  WHILE [${V.c1} < ${V.depth}] DO2   ( plunge one pitch, then a full flat circle )`,
        `    ${V.c1}=[${V.c1} + ${V.bite}]`,
        `    IF ${V.c1} > ${V.depth} THEN ${V.c1}=${V.depth}`,
        `    G1 Z${azE(`- ${V.c1}`)} F${feed}`,
        `    G3 ${ENTRY} ${IJ} F${feed}   ( full circle )`,
        '  END2',
        `  G3 ${ENTRY} ${IJ}   ( finish pass )`,
        `  G0 Z${az(clr)}`,
    ];
}

function boreHelixCycle({ feed, clr, r, ENTRY, IJ, HELIX, azE, az }) {
    const th = 2 * Math.PI / SEG_PER_TURN;
    const c = d9(Math.cos(th)), s = d9(Math.sin(th));
    return [
        `  ${V.c1}=[FUP[${V.depth} / ${V.bite}] * ${SEG_PER_TURN}]   ( segments: ${SEG_PER_TURN} per rev )`,
        `  IF ${V.c1} < ${SEG_PER_TURN} THEN ${V.c1}=${SEG_PER_TURN}   ( never less than one revolution )`,
        `  G0 ${ENTRY}   ( bore radius )`,
        `  G0 Z${az(clr)}`,
        `  G1 Z${az(0)} F${feed}   ( helix top )`,
        `  ${V.c3}=${r3(r)}   ( the rotating vector, re-seeded every revolution so the drift cannot accumulate )`,
        `  ${V.c4}=0`,
        `  ${V.c2}=0`,
        `  ${V.c6}=0`,
        `  WHILE [${V.c2} < ${V.c1}] DO2   ( one straight segment per step — a polyline helix, as the literal is )`,
        `    ${V.c2}=[${V.c2} + 1]`,
        `    ${V.c6}=[${V.c6} + 1]`,
        // RE-SEED at the top of each new revolution, so the compounding can never run past one revolution however
        // deep the bore goes. The bolt circle CANNOT do this (it is one revolution); a helix can and must.
        `    IF ${V.c6} <= ${SEG_PER_TURN} GOTO@R`,
        `    ${V.c6}=1`,
        `    ${V.c3}=${r3(r)}   ( re-seed )`,
        `    ${V.c4}=0`,
        '    N@R',
        `    ${V.c5}=[${V.c3} * ${c} - ${V.c4} * ${s}]   ( rotate by ${r3(360 / SEG_PER_TURN)}deg: 4 multiplies, 2 adds, no trig )`,
        `    ${V.c4}=[${V.c3} * ${s} + ${V.c4} * ${c}]`,
        `    ${V.c3}=${V.c5}`,
        `    G1 ${HELIX} Z${azE(`- ${V.depth} * ${V.c2} / ${V.c1}`)} F${feed}`,
        '  END2',
        `  G3 ${ENTRY} ${IJ} F${feed}   ( finish circle )`,
        `  G0 Z${az(clr)}`,
    ];
}

/**
 * ── HOW MUCH THIS BODY EXECUTES, DECLARED (t1383, ruled) ──────────────────────────────────────────────────────────
 *
 * The tracer's runaway guard used to be sized by program TEXT LENGTH, which is the one quantity a parametric body
 * destroys: the 43-line body emitting a bolt-24 helix got the 5000-step floor and its preview truncated at a twelfth of
 * the path (t1381 measured it; `stats.capped` said so and nothing read it). The fix is a DECLARATION, because this atom
 * already computes every count involved — holes, passes, segments per revolution. It says so; the tracer reads it.
 *
 * THE UNITS ARE EXECUTED PROGRAM LINES, which is what the engine counts as a step (a comment line is a step too — the
 * engine keeps a 1:1 line image for editor highlighting). Each cycle's `fixed`/`perTrip` are its OWN line counts, read
 * off the bodies below; `trips` is its inner loop's trip count. The estimate is deliberately structural rather than
 * exact — `WORK_MARGIN` absorbs the slack — but it is calibrated, not guessed: against t1381's two independent
 * measurements it lands within ~1.3% (bolt-24 helix d20/p0.25: 461k declared vs 467k measured) and ~2% (the d10/p0.5
 * case: 115k vs 117061). A declaration that drifts far from the truth now shows up as a preview that SAYS it truncated,
 * which is the failure mode the ruling asked for instead of a silently short toolpath.
 */
export function holeCycleWorkSteps(p = {}) {
    /**
     * ── IT DECLARES ONLY WHEN IT CAN BE TRUE — returns null otherwise (t1389, ruled) ──────────────────────────────
     *
     * The trade is TAKEN and it is worth naming plainly: **the preview stops declaring its work the moment a knob goes
     * live.** Expected execution size is computed here from depth and bite at BUILD time; once either is a `#var` the
     * operator sets at the pendant, the real count does not exist yet and any number written here would be a guess
     * dressed as a declaration. t1383's own principle decides it — never declare wrong — and the fallback is already
     * built and already measured: an undeclared program that carries flow gets the FLOW-AWARE FLOOR, sized to cover the
     * worst realistic job (a bolt-24 helix at 467k steps).
     *
     * What is actually given up is narrow: a program with a live depth loses a cap tailored to ITS work and takes the
     * generic one. If it exceeds even that, the preview SAYS it truncated — the honesty landed in t1383 covers exactly
     * this case, which is why taking the trade is safe rather than merely acceptable.
     */
    const live = (v) => /^(#|\[)/.test(String(v == null ? '' : v).trim());
    if (live(p.depth) || live(p.peck) || live(p.pitch)) return null;
    const cycle = cycleOf(p.cycle);
    const depth = num(p.depth, 5);
    const bite = cycle === 'peck' ? Math.max(0.1, num(p.peck, depth)) : Math.max(0.05, num(p.pitch, 0.5));
    const n = holePatternPoints(p).length;
    const passes = Math.max(1, Math.ceil(depth / Math.max(1e-6, bite)));
    const W = cycle === 'peck' ? { fixed: 4, trips: passes, perTrip: 8 }
        : cycle === 'bore-step' ? { fixed: 6, trips: passes, perTrip: 6 }
            : { fixed: 12, trips: Math.max(SEG_PER_TURN, passes * SEG_PER_TURN), perTrip: 10 };
    const PER_HOLE_OUTSIDE = 8;   // the pattern's step arithmetic, the skip tests, the advance, k++, END1, the WHILE re-eval
    const PREAMBLE = 12;          // the header, the two live knobs, the zero-bite guard, the seed, k=0, and the refusal tail
    return PREAMBLE + n * (PER_HOLE_OUTSIDE + W.fixed + W.trips * W.perTrip);
}

/**
 * The parametric body for a whole patterned drilling / boring op.
 *
 * @param {object} p  pattern + geometry + cycle params, the absorbed frame (x/y/z0) and rotation (rotAngle/rotPivotX/Y)
 */
export function holeCycleLines(p = {}) {
    const cycle = cycleOf(p.cycle);
    const pattern = String(p.pattern || 'single');
    /**
     * t1444 — A HOLE STRICTLY NARROWER THAN ITS TOOL REFUSES, ON EVERY CYCLE. Same boundary as the slot and the
     * pocket, asked of the one predicate rather than re-compared here.
     *
     * ⚠ THE PECK CYCLE IS NOT EXEMPT, and I had exempted it — the user's ruling extended the law to be universal and
     * overruled that, in their own example: *"a 12mm drill cannot make a 6mm hole"*. My reasoning was that `holeDia`
     * never reaches the peck BODY (only `boreRadius` reads it), so there was no arithmetic to get wrong. That is true
     * of the emitter and beside the point for the operator: the op still states a 6mm hole, the machine still makes a
     * 12mm one, and "the number is unused downstream" is not a reason the hole comes out right. The comparison exists
     * the moment the op carries both numbers, so it is asked here for every cycle.
     */
    const fitRefusal = holeCycleToolRefusal(p);
    if (fitRefusal) return refusalLines(fitRefusal);
    const feed = val(p.feed, 100);            // a #var feed survives — the literal reads it the same way
    const clr = num(p.clearance, 5);
    const depth = num(p.depth, 5);
    // The bite: the peck increment, or the bore pitch. Each keeps its OWN literal default and its own floor, because
    // they are different quantities that happen to share a register.
    const bite = cycle === 'peck'
        ? Math.max(0.1, num(p.peck, depth))
        : Math.max(0.05, num(p.pitch, 0.5));

    /**
     * ── THE TWO LIVE KNOBS BECOME REAL KNOBS (t1389, ruled) ───────────────────────────────────────────────────────
     *
     * `#81` and `#82` have always been described as LIVE — an operator turns them on the pendant mid-program — and that
     * was true of the REGISTERS: the loop reads them, so re-seeding them changes the cut. What was NOT true is that a
     * knob could reach them from Studio: both seeds went out through `r3(num(...))`, which turns a `#var` into NaN and
     * then into the default. The CAM path could therefore never hand this body a live depth, which is exactly what
     * `opToSlot`/`opCamMap` recorded as impossible. `val()` is the whole fix — it prints a `#var`/`[expr]` verbatim and
     * rounds a literal, so the seed becomes `#81=#2601` and every consumer downstream is unchanged (they read `#81`).
     *
     * THE BUILD-TIME FLOOR DOES NOT APPLY TO A LIVE BITE, and that is a real semantic point rather than an omission.
     * `Math.max(0.1, …)` protects a BAKED zero from emitting a loop that never advances. A live bite cannot be clamped at
     * build time — its value does not exist yet — and it does not need to be: the body already opens with
     * `IF #82 <= 0 GOTO@E`, which refuses at RUN time with the reason in the program. That guard was written for exactly
     * this case (an operator zeroing a live knob), so the live path is covered by the mechanism already there, not by a
     * clamp that would have to invent a number.
     */
    const liveWord = (v) => { const s = String(v == null ? '' : v).trim(); return /^(#|\[)/.test(s) ? s : null; };
    const depthSeed = liveWord(p.depth) || r3(depth);
    const biteSeed = (cycle === 'peck'
        // peck's own default IS the depth, so a live depth with no peck set means "one peck, the whole depth" — carry the
        // depth word through rather than silently baking 5mm underneath a live depth.
        ? (liveWord(p.peck) || (p.peck == null || p.peck === '' ? liveWord(p.depth) : null))
        : liveWord(p.pitch)) || r3(bite);
    const r = boreRadius(p);
    const coef = (n) => d9(n);                // multiplied by a runtime term → keeps its digits (see patternLines)

    // THE FRAME. The pattern's own origin folds into it at build time, so `x0`/`y0` cost no register and a placed
    // pattern emits the same shape an unplaced one does. `x`/`y`/`z0` are the placement shift, absorbed as params.
    const originX = num(p.x, 0) + num(p.x0, 0);
    const originY = num(p.y, 0) + num(p.y0, 0);
    const z0 = num(p.z0, 0);
    const { az, azE, AX, TM, mv } = affineFrame({
        x0: originX, y0: originY, zTop: r3(z0),
        rotAngle: num(p.rotAngle, 0), rotPivotX: num(p.rotPivotX, 0), rotPivotY: num(p.rotPivotY, 0),
        absorbs: holeCycleAbsorbsRotation(p) === true,
    });

    const pat = patternLines(pattern, p, coef);
    const skips = [...skipSet(p)].filter((s) => s >= 1 && s <= pat.n).sort((a, b) => a - b);

    // ── THE THREE MOVES A CYCLE NEEDS, each declared in BOTH frames so a rotation can mix them ────────────────────
    // `A`     the hole itself                          → origin + (ox, oy)
    // `ENTRY` the bore's start, out on +X by the radius → origin + (ox + r, oy)
    // `HELIX` a helix segment                          → origin + (ox + vx, oy + vy)
    // Every one passes BOTH axes' affine forms even where only one word is emitted today, because a straight move in
    // this body's frame is a diagonal in a rotated one (affineFrame.js explains why).
    const A = mv(AX(`[${r3(originX)} + ${V.ox}]`, originX, [TM(V.ox)]), AX(`[${r3(originY)} + ${V.oy}]`, originY, [TM(V.oy)]));
    const ENTRY = mv(AX(`[${r3(originX + r)} + ${V.ox}]`, originX + r, [TM(V.ox)]), AX(`[${r3(originY)} + ${V.oy}]`, originY, [TM(V.oy)]));
    const HELIX = mv(
        AX(`[${r3(originX)} + ${V.ox} + ${V.c3}]`, originX, [TM(V.ox), TM(V.c3)]),
        AX(`[${r3(originY)} + ${V.oy} + ${V.c4}]`, originY, [TM(V.oy), TM(V.c4)]),
    );
    // THE ARC'S I/J IS A VECTOR, so a rotation turns it and the pivot does not touch it. The radius is baked, so both
    // components are build-time constants either way — no register, and no expression on an arc word.
    const rotA = num(p.rotAngle, 0);
    const IJ = (() => {
        if (!rotA || holeCycleAbsorbsRotation(p) !== true) return `I${r3(-r)} J0`;
        const th = rotA * Math.PI / 180;
        return `I${r3(-r * Math.cos(th))} J${r3(-r * Math.sin(th))}`;
    })();

    const body = cycle === 'peck' ? peckCycle({ feed, clr, A, azE, az })
        : cycle === 'bore-helix' ? boreHelixCycle({ feed, clr, r, ENTRY, IJ, HELIX, azE, az })
            : boreStepCycle({ feed, clr, r, ENTRY, IJ, azE, az });

    /**
     * A HOLE NO BIGGER THAN THE TOOL IS A PLUNGE, not a bore — the literal's own fallback, and a BUILD-TIME branch
     * because the radius is baked. Reproduced rather than refused: it is a legitimate way to drill with an end mill.
     *
     * ⚠ t1444 — …AND THAT SENTENCE WAS TRUE OF *EQUAL* AND FALSE OF *SMALLER*, which is how this arm became the sweep's
     * one measured liar. `r <= 0.01` swallowed both cases into the plunge, so a Ø5 hole asked of a Ø12 end mill emitted
     * a confident plunge that makes a **Ø12 hole** — the same silent oversize as the slot's width clamp, arrived at
     * from the other direction (there a number was repaired, here a branch was widened past what its reason covered).
     * Equal keeps the plunge exactly as shipped, byte-identical; strictly smaller now refuses upstream (see the guard
     * at the top of this function), so `plunge` here is only ever reached by the case its comment describes.
     */
    const bored = cycle !== 'peck';
    const plunge = bored && r <= 0.01;
    const cycleBody = plunge
        ? [`  G0 ${A}`, `  G0 Z${az(clr)}`, `  G1 Z${azE(`- ${V.depth}`)} F${feed}`, `  G0 Z${az(clr)}`]
        : body;

    const L = [
        // THE DECLARED WORK RIDES IN THIS HEADER (t1383) — a token in a comment the body already emits, rather than a new
        // marker LINE, because a new line would shift every index in the emitter's line-aligned maps and perturb the
        // round-trip diff of every program that grew one. `stripAnnotations` drops it with every other parenthetical, so
        // no byte-equivalence bridge sees it.
        // …and it declares ONLY when it can be TRUE (t1389). `holeCycleWorkSteps` returns null the moment any input it
        // multiplies is a live expression, and the token is then omitted entirely — see the note on that function.
        `( ---- ${bored ? 'BORE' : 'DRILL'}, parametric: ${pat.n} hole${pat.n === 1 ? '' : 's'} (${pattern}) x ${cycle}`
            + `${holeCycleWorkSteps(p) == null ? '' : ' · ' + workMarker(holeCycleWorkSteps(p))} ---- )`,
        `${V.depth}=${depthSeed}   ( total depth — LIVE: a pendant can turn this )`,
        `${V.bite}=${biteSeed}   ( ${cycle === 'peck' ? 'bite per peck' : 'pitch per pass'} — LIVE )`,
        // The guard is the same class as the raster's zero-stepover refusal: a bite that never advances would loop
        // forever. It refuses cleanly with the reason IN the program, because #82 is live and an operator can zero it.
        `IF ${V.bite} <= 0 GOTO@E   ( a zero bite never advances — refuse instead of looping forever )`,
        ...pat.seed,
        `${V.k}=0   ( the hole index )`,
        `WHILE [${V.k} < ${pat.n}] DO1   ( one pass per hole — the pattern is walked, not unrolled )`,
        ...pat.step.map((l) => '  ' + l),
        // SKIP: the operator's 1-based hole numbers. The test jumps PAST the cycle but not past the bookkeeping, so a
        // pattern that carries state between holes (the bolt circle's rotating vector) still advances correctly.
        ...skips.map((s) => `  IF ${V.k} == ${s - 1} GOTO@S   ( hole ${s} skipped )`),
        ...cycleBody,
        ...(skips.length ? ['  N@S'] : []),
        ...pat.advance.map((l) => '  ' + l),
        `  ${V.k}=[${V.k} + 1]`,
        'END1',
        'GOTO@X',
        'N@E',
        `#1505=1   ;ERROR: ${cycle === 'peck' ? 'peck' : 'pitch'} must be greater than zero`,
        'N@X',
    ];

    // ── THE LABELS, RESOLVED LAST ────────────────────────────────────────────────────────────────────────────────
    // The body above writes SYMBOLIC labels (`@E`, `@S`, `@R`, `@V`, `@H`, `@X`). They are substituted here from the
    // block's own declared label params, which the emitter assigns UNIQUELY per program — so two hole ops in one
    // program cannot collide the way a stamped body did. See `flowLabels` below for why this is a declaration.
    const N = labelsOf(p);
    return L.map((line) => line.replace(/@([ESRVHX])/g, (_, key) => String(N[key])));
}

/**
 * THE LABEL NUMBERS this body uses, from the block's params. `uniquifyFlowLabels` (blockEmitter) fills them in per
 * program; the defaults keep a bare call emitting something valid and are the numbers t1379 used.
 */
function labelsOf(p = {}) {
    return {
        E: num(p.errLabel, 63), X: num(p.errSkipLabel, 62), S: num(p.skipLabel, 60),
        R: num(p.reseedLabel, 61), H: num(p.rectHLabel, 66), V: num(p.rectVLabel, 67),
    };
}

/**
 * WHAT THIS ATOM COVERS — declared, and SCOPED, because the surfacing pilot's hardest-won lesson (t1349) was that an
 * envelope claim is worthless unless it says what it is ABOUT.
 *
 * IN: all five patterns at any count, all three cycles, at any depth/bite — including a depth that is not a multiple
 * of the bite (the last one clamps), a bite larger than the depth (one pass), a hole no bigger than the tool (the
 * literal's plunge fallback), skipped holes, a placement frame and a declared program rotation.
 *
 * OUT, and named — each is a REACHABILITY statement or a refusal a reader can act on:
 */
export function holeCycleCovers(p = {}) {
    return holeCycleGap(p) === '';
}

/** Why a config is outside the envelope, in the words a reader needs — never a bare false. */
export function holeCycleGap(p = {}) {
    if (String(p.zMode || '') === 'skim') {
        return 'a skim frame is measured from wherever the operator jogged to; no drill flow builds one, so this cycle '
            + 'has never needed to read a live position and does not pretend to';
    }
    // A DEGENERATE RECT IS A REAL DIVERGENCE, NOT A ROUNDING — and it is named rather than silently wrong. The literal
    // dedups its perimeter with a rounded key, so at w=0 (or h=0) the two edges COINCIDE and its Set collapses points
    // this body's range formula would still walk. Reproducing a hash's collapse would mean testing every point against
    // every other at runtime; refusing a zero-size pattern is the honest answer, and the wizard cannot mean one.
    if (String(p.pattern || '') === 'rect' && (num(p.w, 100) <= 0 || num(p.h, 80) <= 0)) {
        return 'a rect perimeter with a zero width or height has coincident edges, so the literal pattern collapses '
            + 'points by rounding that this walk would drill twice — give the rectangle a real size';
    }
    return '';
}

/**
 * WHEN THIS ATOM CAN ABSORB A PROGRAM ROTATION. Always, except in a frame it cannot have — and unlike t1379's cycle
 * this is NOT trivial: the pattern's points are RUNTIME registers, so the rotation has to mix the axes symbolically
 * through the shared affine printer rather than being applied to a build-time pair of numbers. That is precisely why
 * `affineFrame` is a module and not a copy.
 */
export function holeCycleAbsorbsRotation(p = {}) {
    const gap = holeCycleGap(p);
    return gap === '' ? true : gap;
}

export const holeCycleBlock = {
    type: 'holecycle', label: 'Holes (parametric)', kind: 'leaf', category: 'Toolpaths',
    defaults: {
        pattern: 'single', cycle: 'peck',
        x: 0, y: 0, z0: 0, x0: 0, y0: 0,
        depth: 5, peck: 5, pitch: 0.5, holeDia: 12, toolDia: 6, feed: 100, clearance: 5,
        cols: 3, rows: 2, dx: 20, dy: 20, count: 4, spacing: 20, angle: 0, dia: 50, startAngle: 0,
        w: 100, h: 80, nx: 2, ny: 2, skip: '',
    },
    fields: ['pattern', 'cycle', 'depth', 'peck', 'feed', 'clearance'],
    selects: { pattern: PATTERNS, cycle: CYCLES },   // t1520 — this atom's OWN vocabularies (the shared by-name lists are the array/canned-cycle ones)
    // The Blocks view carries EVERY pattern + cycle field so all of them round-trip; a Blockly extension toggles which
    // are visible per `pattern`, exactly as the `array` block already does.
    allFields: ['pattern', 'cycle', 'x', 'y', 'z0', 'x0', 'y0', 'depth', 'peck', 'pitch', 'holeDia', 'toolDia', 'feed', 'clearance',
        'cols', 'rows', 'dx', 'dy', 'count', 'spacing', 'angle', 'dia', 'startAngle', 'w', 'h', 'nx', 'ny', 'skip'],
    dynamic: 'pattern',
    scratch: HOLE_SCRATCH,   // read by universalScratch.opBands() — the band is data, not a comment
    /**
     * THE DECLARED FLOW LABELS (t1381). A body carrying `N`/`GOTO` must have labels that are unique across the whole
     * PROGRAM, or a second op's `GOTO` binds to the first op's `N` — t1379 measured exactly that and it silently
     * dropped every hole after the first. The emitter has always uniquified labels, but by a hand-written switch on
     * three block types; this atom declares the params it needs instead, so the mechanism serves any atom that says so.
     *
     * A label is only listed when the body actually emits it: a pattern with no skips needs no skip label, and only a
     * helical bore re-seeds. That keeps the numbering tight and, more importantly, keeps the declaration honest.
     */
    flowLabels: (p = {}) => {
        const out = ['errLabel', 'errSkipLabel'];
        if (skipSet(p).size) out.push('skipLabel');
        if (cycleOf(p.cycle) === 'bore-helix') out.push('reseedLabel');
        if (String(p.pattern || '') === 'rect') out.push('rectHLabel', 'rectVLabel');
        return out;
    },
    /** The stamped footprint: the pattern-point bbox (a hole is a point). Recomputed LIVE from params, so a placement
     *  tracks the pattern instead of a frozen snapshot — the same contract `array` + `drill` had between them. */
    extent: (p) => {
        const pts = holePatternPoints(p);
        if (!pts.length) return null;
        const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
        return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    },
    lines: (p) => holeCycleLines(p),
    emit: (p, dx = 0, dy = 0) => holeCycleLines({ ...p, x: num(p.x, 0) + (Number(dx) || 0), y: num(p.y, 0) + (Number(dy) || 0) }),
    absorbsPlacement: true,
    absorbsRotation: (p) => holeCycleAbsorbsRotation(p),
};
