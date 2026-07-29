/**
 * wizards/ops/holepeck.js — THE PECK DRILL CYCLE, EMITTED PARAMETRIC (t1379, the drill family's first atom).
 *
 * ── WHY THIS ONE FIRST, MEASURED ──────────────────────────────────────────────────────────────────────────────────
 * `drill.js`'s `peckDrill` drives a JS `while` loop and writes every peck out as literal Z moves: a 20mm hole at a 2mm
 * peck is 30 lines that all say the same thing. Under a 24-hole bolt circle that is 751 lines for one drill op.
 *
 * But line count is not why this atom is first. THE BLOCKER IS ALREADY WRITTEN DOWN, in opToSlot.js and opCamMap.js:
 * the universal CAM path "cannot expose depth/peck AT ALL, because drill.js peckDrill drives a JS while loop that
 * unrolls the peck sequence and bakes every Z literal at build time." A pendant cannot be given the two knobs an
 * operator most wants on a drilling job. A parametric cycle is what unblocks that, and it is worth having before the
 * pattern loop because it is the half that does not depend on how the pattern's points are computed.
 *
 * ── WHAT THIS ATOM IS ABOUT, SAID EXACTLY (the surfacing lesson about scoping a claim) ────────────────────────────
 * THE PER-HOLE CYCLE. Not the pattern. The `array` container still computes its points in JavaScript and stamps this
 * atom once per hole, exactly as it stamps the literal drill today — the atom folds the stamp offset into its own frame
 * (`dx`/`dy`) so it is correct under one. Making the PATTERN parametric is a separate change with its own open design
 * question (see the work log for t1379: a baked rotation recurrence versus a baked per-hole point pair), and it is
 * deliberately not prejudged here.
 *
 * ── WHAT IT REPRODUCES, AND ONE THING WORTH REPORTING ─────────────────────────────────────────────────────────────
 * The literal cycle, move for move: rapid to the hole, then per peck — a rapid back down to 0.5mm above where the last
 * one stopped (skipped on the first), a FEED of only the new increment, and a full retract to clearance to clear chips.
 *
 * THE FIRST PECK FEEDS FROM CLEARANCE, which means it feeds through the air gap at the drilling feed — 7mm at 100mm/min
 * on the default config, about four seconds per hole doing nothing. That is what the shipped literal does, so it is what
 * this reproduces; a migration that quietly improved it would make its own bridge untrue. Recorded as an observation for
 * a ruling, not fixed here (the t1353 precedent: a defect in the literal needs its own decision before the atom
 * declines to copy it).
 *
 * ── ⚠ IT CANNOT BE STAMPED, AND THAT IS A FINDING ABOUT THE FAMILY, NOT A BUG IN THIS ATOM ────────────────────────
 * MEASURED (t1379): put this atom under the `array` container and only the FIRST hole drills. The cause was isolated by
 * separating the two candidates — two `DO1` loops in one program are FINE (both holes drill), and two copies of the same
 * `N61`/`N62` LABELS are not: the second copy's `GOTO61` binds to the first copy's label, and execution never reaches the
 * later holes. Same class as the duplicate-N91 problem `uniquifySafeRetractLabels` exists for — but that mechanism
 * uniquifies per BLOCK, and a stamped block is ONE block emitted N times, so it cannot reach this.
 *
 * WHY IT IS NOT FIXED HERE. A label-free body is possible but only by changing the MACHINING: the first peck's re-entry
 * rapid has to become unconditional, which starts the first cut 0.5mm above the surface instead of feeding down from
 * clearance. That is arguably better (see the air-feed note below) and it is exactly the kind of change that needs a
 * ruling rather than arriving as a side effect. `THEN` takes an assignment, not a move, so there is no third option.
 *
 * WHAT IT MEANS FOR THE NEXT SLICE: the PATTERN cannot stay a build-time container. A parametric pattern loop emits ONE
 * body with ONE set of labels, so the collision disappears the moment the pattern folds into the atom — which is the
 * direction the family was already going, now with a measurement forcing it rather than a preference suggesting it.
 * Until then this atom is correct for ONE body, which is what its bridges prove and all that they claim.
 *
 * ── LINE COUNT IS NOT ALWAYS A WIN, AND SAYING SO IS THE HONEST CLAIM ─────────────────────────────────────────────
 * A loop has fixed overhead: 13 lines whatever the depth. At 20mm/2mm that replaces 30 literal lines; at 5mm/5mm — one
 * peck — it replaces 3, so it is LONGER. Same shape as the surfacing pilot's finding. The win is the LIVE knobs and the
 * intent being in the program, not the byte count.
 */
import { num, r3, val } from './util.js';

/**
 * THE BAND. #81–#87 — the widest clear run in the region: the probe wizards hold #70–#74, #79 and #80 (corner and
 * alignment temps) and #88 is taken above, so this sits between them with nothing on either side. Clear of the mill
 * kit (#20–#33), of surfaceraster's #34–#49 / #62–#64, and of the probe temps at #50–#61 — which matters because a
 * program can hold a surfacing op and a drilling op together and macro registers persist across ops.
 *
 * Declared as DATA so universalScratch.opBands() reads it instead of a comment re-deriving it, and so the pattern loop
 * can EXTEND the band with its own reason (as surfaceraster extended #40–#49 down to #34 for the helix recurrence)
 * rather than quietly reusing one of these.
 */
export const HOLE_SCRATCH = [[81, 87]];

const V = {
    depth: '#81',   // total depth to drill
    peck: '#82',    // bite per peck
    d: '#83',       // how deep we have got
    prev: '#84',    // where the previous peck stopped — drives the re-entry rapid
};

const REENTRY = 0.5;   // rapid back to this far above the last peck before feeding on (the literal kernel's own value)

/**
 * The parametric body for ONE hole's peck cycle.
 * @param {object} p  x,y,z0,depth,peck,feed,clearance + the absorbed frame/rotation params
 */
export function holePeckLines(p = {}) {
    const depth = num(p.depth, 5);
    const peck = Math.max(0.1, num(p.peck, depth));
    const feed = val(p.feed, 100);          // a #var feed survives (the literal reads it the same way)
    const clr = num(p.clearance, 5);
    const x0 = num(p.x, 0), y0 = num(p.y, 0), z0 = num(p.z0, 0);

    /**
     * t1379 — THE ROTATION, ABSORBED, and it is far simpler here than in a raster and for a reason worth stating: a
     * hole's X and Y are BUILD-TIME CONSTANTS. Surfacing needed a coupled affine printer because its coordinates carry
     * runtime terms (a row's Y is a register), so a rotation had to mix the axes symbolically. A hole has one point, so
     * the rotation is applied to that point at build time and the emitted move is an ordinary pair of numbers.
     *
     * ONE-SHOT, so the t1371 digit bound governs and there is nothing to derive again: two multiplies and an add per
     * coordinate, no recurrence. The constants land in the coordinate itself rather than in an expression, so they need
     * no extra digits at all — the result is rounded to the emit's own 0.001mm quantum like every other coordinate.
     * (The BOLT CIRCLE is the opposite case: a recurrence, needing its own derivation. That is the pattern loop's
     * problem, not this atom's.)
     */
    const rotA = num(p.rotAngle, 0);
    let px = x0, py = y0;
    if (rotA) {
        const th = rotA * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
        const qx = num(p.rotPivotX, 0), qy = num(p.rotPivotY, 0);
        px = qx + (x0 - qx) * c - (y0 - qy) * s;
        py = qy + (x0 - qx) * s + (y0 - qy) * c;
    }
    // Z is rotation-invariant, so the depths are the frame's own and nothing else.
    const az = (rel = 0) => r3(z0 + rel);
    const azE = (expr) => `[${r3(z0)} ${expr}]`;

    return [
        '( ---- DRILL, parametric. The peck loop counts itself from the depth and the bite. ---- )',
        `${V.depth}=${r3(depth)}   ( total depth to drill )`,
        `${V.peck}=${r3(peck)}   ( bite per peck — the tool full-retracts between each to clear chips )`,
        // The guard is the same class as the raster's zero-stepover refusal: a zero bite never advances, so the loop
        // below would run forever. Refuse cleanly, with the reason in the program.
        `IF ${V.peck} <= 0 GOTO63   ( a zero peck never advances — refuse instead of looping forever )`,
        `${V.d}=0   ( how deep we have got )`,
        `${V.prev}=0   ( where the previous peck stopped )`,
        `G0 X${r3(px)} Y${r3(py)}`,
        `WHILE [${V.d} < ${V.depth}] DO1   ( one peck per bite, the last clamped to the total )`,
        `  ${V.prev}=${V.d}`,
        `  ${V.d}=[${V.d} + ${V.peck}]`,
        `  IF ${V.d} > ${V.depth} THEN ${V.d}=${V.depth}`,
        // THE FIRST PECK HAS NOWHERE TO RAPID BACK TO. Asked as a BRANCH rather than as arithmetic on `prev`, because
        // that is the form this emit family has demonstrated (and t1339 measured an in-expression comparison being read
        // wrong). The label pair sits in the 60s, which no other atom in the program uses.
        `  IF ${V.prev} <= 0 GOTO61   ( the first peck feeds from clearance; later ones rapid back down first )`,
        `  G0 Z${azE(`- ${V.prev} + ${REENTRY}`)}   ( rapid to just above where the last peck stopped )`,
        '  N61',
        `  G1 Z${azE(`- ${V.d}`)} F${feed}   ( feed only the new increment )`,
        `  G0 Z${az(clr)}   ( full retract — clear the chips )`,
        'END1',
        'GOTO62',
        'N63',
        '#1505=1   ;ERROR: peck must be greater than zero',
        'N62',
    ];
}

/**
 * WHAT THIS ATOM COVERS — declared, and scoped to the CYCLE, because the surfacing pilot's hardest-won lesson was that
 * an envelope claim is worthless unless it says what it is ABOUT (t1349: every bridge framed the body BARE, and saying
 * so was the finding).
 *
 * IN: the peck cycle at any depth/bite, including a bite larger than the depth (one peck) and a depth that is not a
 * multiple of the bite (the last one clamps). The frame (x/y/z0), a program rotation, and the feed criterion all arrive
 * by inheritance and are bridged.
 *
 * NOT THIS ATOM'S QUESTION: the PATTERN. `array` still computes points in JavaScript and stamps this atom per hole, so
 * a patterned drill is this cycle repeated — correct, and not yet the single parametric body the family is heading for.
 * That is scope, not a gap, and it is stated here so a reader does not mistake one for the other.
 *
 * OUT, and named: a jog-referenced (skim) frame. No drill flow reaches one — `drillStack` builds
 * [progstart, wcs, placeonstock, array, drill, progend] with no skim fold anywhere — so this is a statement about
 * reachability rather than a refusal anyone can hit, and it is the precise form of the claim (the t1371 lesson about
 * "unreachable" being the wrong word when the blocks exist in the palette).
 */
export function holePeckCovers(p = {}) {
    if (String(p.zMode || '') === 'skim') return false;
    return true;
}

/** Why a config is outside the envelope, in the words a reader needs — never a bare false. */
export function holePeckGap(p = {}) {
    if (String(p.zMode || '') === 'skim') {
        return 'a skim frame is measured from wherever the operator jogged to; no drill flow builds one, so this cycle '
            + 'has never needed to read a live position and does not pretend to';
    }
    return '';
}

/**
 * t1379 — WHEN THIS ATOM CAN ABSORB A PROGRAM ROTATION. A hole's point is a build-time constant, so it always can —
 * there is no frame mix to refuse the way a skim raster has (and no drill flow reaches a skim frame at all). Declared
 * as a function anyway, so the seam reads identically to surfaceraster's and a future variant has somewhere to say no.
 */
export function holePeckAbsorbsRotation(p = {}) {
    if (String(p.zMode || '') === 'skim') return holePeckGap(p);
    return true;
}

export const holePeckBlock = {
    type: 'holepeck', label: 'Drill (parametric)', kind: 'leaf', category: 'Toolpaths',
    defaults: { x: 0, y: 0, z0: 0, depth: 5, peck: 5, feed: 100, clearance: 5 },
    fields: ['x', 'y', 'z0', 'depth', 'peck', 'feed', 'clearance'],
    scratch: HOLE_SCRATCH,   // read by universalScratch.opBands() — the band is data, not a comment
    // A hole is a POINT at its local x,y, exactly as the literal drill declares — so a container (Array) recomputes the
    // placement bbox LIVE from params instead of using a frozen snapshot.
    extent: (p) => ({ minX: num(p.x, 0), maxX: num(p.x, 0), minY: num(p.y, 0), maxY: num(p.y, 0) }),
    lines: (p) => holePeckLines(p),
    // dx/dy are the STAMP offsets a container applies per point. Folded into the frame rather than ignored, which is
    // what makes this atom correct under the `array` that still owns the pattern.
    emit: (p, dx = 0, dy = 0) => holePeckLines({ ...p, x: num(p.x, 0) + (Number(dx) || 0), y: num(p.y, 0) + (Number(dy) || 0) }),
    // The two declared seams, inherited whole from the surfacing pilot: the frame arrives as params, and so does a
    // declared program rotation.
    absorbsPlacement: true,
    absorbsRotation: (p) => holePeckAbsorbsRotation(p),
};
