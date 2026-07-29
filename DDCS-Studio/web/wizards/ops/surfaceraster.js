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
export const RASTER_SCRATCH = [[40, 49]];

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
// The ring walk reuses one of the same slots for its inset: a ring and a row are never walked at the same time, so
// a separate var would be a second name for one register.
const RING_INSET = V.y;

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
    const x0 = num(p.x, 0), y0 = num(p.y, 0);
    const confirmEvery = Math.max(0, Math.round(num(p.confirmEvery, 0)));
    const r3 = (n) => Math.round(n * 1000) / 1000;

    // THE STRATEGY DECIDES THE WALK, under the SAME header and the SAME depth loop — the loop that counts levels
    // does not care what happens inside it, which is why adding a strategy is a new walk and not a new emitter.
    const opts = { x0, y0, w, h, feed, plunge, clr, r3 };
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
        `G0 Z${r3(clr)}   ( clear before the first plunge )`,
        `WHILE [${V.z} LT ${V.depth}] DO1   ( depth: one pass per level, the last bite clamped to the total )`,
        `  ${V.z}=[${V.z} + ${V.stepdown}]`,
        `  IF ${V.z} GT ${V.depth} THEN ${V.z}=${V.depth}`,
        ...walk.body,
        `  G0 Z${r3(clr)}   ( clear of the work before the next level )`,
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
function rowWalk({ x0, y0, feed, plunge, clr, r3 }) {
    void clr;
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
        `    G1 Z[0 - ${V.z}] F${r3(plunge)}   ( the ONE plunge of this level )`,
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
 * THE CONCENTRIC WALK — inset rectangles, inward. Pure arithmetic, as the literal kernel is: each ring is the area
 * shrunk by `inset` on every side, and the walk stops when a ring would collapse. The tool steps to the next ring on
 * a DIAGONAL CUTTING move and never lifts within a level — one plunge, like the both-ways raster.
 */
function ringWalk({ x0, y0, w, h, feed, plunge, clr, r3 }) {
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
            `    G1 Z[0 - ${V.z}] F${r3(plunge)}   ( the ONE plunge of this level )`,
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
    return (p.entry || 'plunge') === 'plunge';
}

/** Why a config is outside the envelope, in the words a reader needs — never a bare false. */
export function surfaceRasterGap(p = {}) {
    if ((p.entry || 'plunge') !== 'plunge') return `a ${p.entry} descent adds moves the walk does not make — split to its own turn, with the arc question`;
    return '';
}

export const surfaceRasterBlock = {
    type: 'surfaceraster', label: 'Surface Raster (parametric)', kind: 'leaf', category: 'Transforms',
    defaults: { x: 0, y: 0, w: 100, h: 80, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5, strategy: 'parallel', direction: 'bothways' },
    fields: ['x', 'y', 'w', 'h', 'depth', 'stepdown', 'toolDia', 'stepoverPct', 'feed', 'plunge', 'clearance', 'strategy', 'direction'],
    scratch: RASTER_SCRATCH,   // read by universalScratch.opBands() — the band is data, not a comment
    lines: (p) => surfaceRasterLines(p),
};
