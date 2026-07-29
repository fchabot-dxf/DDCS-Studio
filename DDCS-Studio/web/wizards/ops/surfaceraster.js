/**
 * wizards/ops/surfaceraster.js — SURFACING, EMITTED PARAMETRIC (t1329, the mill pilot).
 *
 * THE PILOT'S POINT: today a surfacing op unrolls its whole raster in JavaScript — every row, at every depth, as a
 * literal G1. A 200×150 face at a 0.4 stepdown is thousands of lines that all say the same thing, and none of them
 * says WHY. This emits the INTENT instead: a header of named #vars, a depth loop, and a row loop that counts itself
 * from the area and the stepover. Change the tool Ø on the pendant and the raster re-derives at the machine.
 *
 * WHY A NEW ATOM RATHER THAN CHANGING `stepdown` + `surfacefill`: those two are SHARED — pocket, slot and contour
 * emit through them. Making them parametric would re-emit every one of those ops in the same breath as the pilot,
 * which is exactly what a pilot exists to avoid ([[corner-gated-pilot]]: prove each mechanism ONCE, on one op, and
 * let the family inherit it deliberately). This atom owns BOTH loops for the surfacing case and touches nothing else.
 *
 * ── THE SCRATCH IT WRITES, DECLARED (t1325's lesson) ─────────────────────────────────────────────────────────────
 * A hand-picked var is how the CAM stepover derivation got silently overwritten by rasterClear's row count: clean
 * G-code that cut a different part. So the band is DECLARED on the block (`scratch`), the way universalScratch.js
 * already reads every atom's own declaration, and the spec asserts each var is assigned exactly once.
 *
 * camMacroKit's ownership split is the model: a caller's band and the kit's band do not overlap. This atom is its
 * own caller and its own kit, so it takes ONE contiguous band and says so.
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
    rows: '#45',     // row count, counted from the area and the stepover
    z: '#46',        // the level currently being cut
    y: '#47',        // the row currently being cut
    i: '#48',        // row index
    dir: '#49',      // +1 / −1 — which way this row runs (both-ways raster)
};

/**
 * The parametric body for a whole surfacing op: header, depth loop, row loop.
 * @param {object} p  w,h,depth,stepdown,toolDia,stepoverPct (or stepover mm),feed,plunge,clearance,x,y
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
    const r3 = (n) => Math.round(n * 1000) / 1000;

    return [
        '( ---- SURFACING, parametric. Every var below speaks; change one and the loops re-derive. ---- )',
        `${V.w}=${r3(w)}   ( area X — the tool-CENTRE sweep, so the tool overhangs the edge )`,
        `${V.h}=${r3(h)}   ( area Y )`,
        `${V.depth}=${r3(depth)}   ( total depth to face off )`,
        `${V.stepdown}=${r3(stepdown)}   ( bite per level )`,
        `${V.step}=[${r3(tool)} * ${r3(pct)} / 100]   ( stepover mm = tool Ø ${r3(tool)} x ${r3(pct)}% — the CAM derives it the same way )`,
        `IF ${V.step} LE 0 GOTO 91   ( a zero stepover divides by zero below; refuse cleanly instead of looping forever )`,
        `IF ${V.stepdown} LE 0 GOTO 91`,
        // THE ROW COUNT, and it is NOT `h / step` rounded up. Rows sit at step/2 + i·step, so the count is how many of
        // those land INSIDE the area: FIX[(h − step/2) / step] + 1. The two formulas agree at 150/7.2 and 40/5 and
        // disagree at 60/7.2 (8 rows, not 9) — a whole extra pass off the far edge, cutting air. The first five
        // equivalence configs all happened to be ones where the wrong formula coincides, which is exactly why the
        // sixth exists: a bridge is only as good as the configs you point it at.
        `${V.rows}=[FIX[[${V.h} - ${V.step} / 2] / ${V.step}] + 1]   ( rows that FIT: the last one lands inside the area, not past it )`,
        `IF ${V.rows} LT 1 THEN ${V.rows}=1   ( a face narrower than one stepover is still one row )`,
        '',
        `${V.z}=0   ( the level being cut )`,
        `G0 Z${r3(clr)}   ( clear before the first plunge )`,
        `WHILE [${V.z} LT ${V.depth}] DO1   ( depth: one pass per level, the last bite clamped to the total )`,
        `  ${V.z}=[${V.z} + ${V.stepdown}]`,
        `  IF ${V.z} GT ${V.depth} THEN ${V.z}=${V.depth}`,
        `  ${V.i}=0`,
        // EVERY LEVEL STARTS AT THE NEAR CORNER, going +X. Carrying the direction over from the previous level looked
        // tidier and is simply not what the machine does — with an odd row count level 2 would start at the far end
        // and run backwards. The equivalence bridge caught it at move 42 of 84, which is precisely the kind of thing
        // no one finds by reading G-code.
        `  ${V.dir}=1   ( the raster restarts at the near corner for each level )`,
        `  WHILE [${V.i} LT ${V.rows}] DO2   ( rows: counted above, so the area and the stepover decide how many )`,
        // THE ROW'S Y: half a stepover in from the edge, then one stepover per row. That half-step is what makes the
        // tool's SWATH cover the area — its centre never runs on the boundary — and it is the offset the literal
        // emitter has always used. The equivalence bridge caught the naive `i * step` version immediately.
        `    ${V.y}=[${r3(y0)} + ${V.step} / 2 + ${V.i} * ${V.step}]`,
        `    IF ${V.i} GT 0 GOTO 13   ( already down: step over at depth rather than lifting between rows )`,
        // WHICH END TO START THIS LEVEL AT — asked as a BRANCH, not as a comparison inside an expression. `[#49 LT 0]`
        // looked like it would evaluate to 0/1 and the tracer read it as a plain 1, putting the first plunge a
        // millimetre off the corner. A conditional belongs in an IF on this controller; the bridge caught it.
        `    IF ${V.dir} LT 0 GOTO 17`,
        `    G0 X${r3(x0)} Y${V.y}`,
        '    GOTO 18',
        '    N17',
        `    G0 X[${r3(x0)} + ${V.w}] Y${V.y}`,
        '    N18',
        `    G1 Z[0 - ${V.z}] F${r3(plunge)}   ( the ONE plunge of this level )`,
        '    GOTO 14',
        '    N13',
        // STAY DOWN. The tool steps to the next row as a CUTTING move at depth — lifting and re-plunging every row
        // would be a different program (more air, more plunges, more wear), and the bridge proves it is not one.
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
        `  G0 Z${r3(clr)}   ( clear of the work before the next level )`,
        'END1',
        'GOTO 92',
        'N91',
        '#1505=1   ;ERROR: stepover / stepdown must be greater than zero',
        'N92',
    ];
}

/**
 * WHAT THIS ATOM COVERS — declared, because the switch-over depends on it and a silent gap here would DROP FEATURES.
 *
 * The wizard offers more than one raster: concentric rings, a ramp or helix descent instead of a plunge, a one-way
 * raster, and a confirm-every-N-passes halt. This atom implements the DEFAULT and most common one — a both-ways
 * parallel raster that plunges — and the equivalence bridge only ever proved THAT. Measured against the literal
 * emitter, the others differ by a lot (concentric 50 cutting moves vs 36; helix 80 vs 36): they are different
 * toolpaths, not rounding.
 *
 * So the boundary is a predicate rather than a comment: a caller asks whether a config is inside the proven envelope
 * instead of assuming it is. Retiring the literal emitter means closing this gap first — every `false` below is a
 * feature that would otherwise vanish on the day the old path dies.
 */
export function surfaceRasterCovers(p = {}) {
    const strategy = p.strategy || 'parallel';
    const entry = p.entry || 'plunge';
    const direction = p.direction || 'bothways';
    const confirmEvery = Number(p.confirmEvery) || 0;
    return strategy === 'parallel' && entry === 'plunge' && direction === 'bothways' && confirmEvery === 0;
}

/** Why a config is outside the envelope, in the words a reader needs — never a bare false. */
export function surfaceRasterGap(p = {}) {
    if ((p.strategy || 'parallel') !== 'parallel') return 'concentric rings are a different toolpath — the parametric raster walks rows';
    if ((p.entry || 'plunge') !== 'plunge') return `a ${p.entry} descent adds moves the row loop does not make`;
    if ((p.direction || 'bothways') !== 'bothways') return 'a one-way raster lifts and returns between rows';
    if (Number(p.confirmEvery) > 0) return 'a confirm-every-N halt is a machine pause between levels';
    return '';
}

export const surfaceRasterBlock = {
    type: 'surfaceraster', label: 'Surface Raster (parametric)', kind: 'leaf', category: 'Transforms',
    defaults: { x: 0, y: 0, w: 100, h: 80, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5 },
    fields: ['x', 'y', 'w', 'h', 'depth', 'stepdown', 'toolDia', 'stepoverPct', 'feed', 'plunge', 'clearance'],
    scratch: RASTER_SCRATCH,   // read by universalScratch.opBands() — the band is data, not a comment
    lines: (p) => surfaceRasterLines(p),
};
