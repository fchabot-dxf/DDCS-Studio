/**
 * blocks/dataOps/drillData.js — the DRILL built-in expressed as a pure DATA definition (ROADMAP Stage 4).
 *
 * The endgame (wizards-as-data): every built-in becomes a { template, bindings } def — open, fork, override,
 * reset-to-factory — exactly like a user op. This is the FIRST port: drill, expressed as data and PROVEN to emit
 * byte-identical G-code to the hand-coded drillStack across a param sweep (tests/drill-as-data.spec.js, via
 * dataOps/equivalence.js). It registers through the SAME federated user layer a wizard-maker op uses
 * (registerUserOp → builderOf), so it inherits the live block↔form round-trip for free.
 *
 * WHY DRILL IS ~90% DATA-EXPRESSIBLE: the per-hole loop + pattern geometry do NOT live in the stack — they live in
 * the emit fold (the `array` container atom stamps its single child at patternPoints(p)). So drillStack is a STATIC
 * 4-block tree [progstart, wcs, placeonstock{ array{ drill } }, progend] whose every variation is a SCALAR in a
 * fixed socket — precisely what a {template, bindings} def + instantiate() substitute. Pattern variety (grid /
 * circle / line / rect) is just the `pattern` enum + numbers, NOT a shape change.
 *
 * THE FRONTIER (what a pure {template,bindings} def CANNOT yet express — the vocabulary Stage 5 must grow,
 * each demonstrated as an executable divergence in the spec):
 *   2. LIVE BBOX — *the primary blocker.* makePlace bakes pointsBBox(patternPoints(params)) into the placeonstock
 *      snapshot, and the DEFAULT placement (stockDatum 'nnp') shifts the program by -bbox.min (re-references the
 *      path's min-corner to origin). A static template FREEZES that bbox at author-time, so the moment the pattern's
 *      bounding box moves — ANY x0/y0 offset, or a circle/line/rect shape — the placement shift is computed against
 *      the wrong box and the output diverges. NOT inert by default (the placeShift is non-zero whenever bbox.min ≠
 *      the author-time bbox.min). The bindings here are all CORRECT — the array faithfully stamps at the bound
 *      points — but placeOnStock's baked snapshot can't track them. This is the sharpest signal for Stage 5: the
 *      format needs computed/derived bindings, OR placeOnStock must compute its shift from a live (param-derived)
 *      bbox instead of a frozen snapshot. Until then, the equivalence sweep holds bbox.min fixed (grid at origin).
 *   1. METHOD SWAP — params.method==='helical' makes drillStack build a `bore` child (different block TYPE + key
 *      set) instead of `drill`. instantiate substitutes VALUES, never a block type. → this def covers the peck path.
 *   3. FAN-OUT PARAM — `clearance` feeds TWO sockets (progstart + the drill leaf); a binding is 1 param → 1 socket,
 *      and duplicate param names are rejected. → clearance is held at its default here.
 *
 * Stage-4 scope note: the template is SEEDED from drillStack(DRILL_DEFAULTS) (== "BUILDERS(defaults)", the canonical
 * valid-by-construction template). The INDEPENDENT artifact under test is the hand-authored BINDINGS map below, proven
 * TWO ways by the spec (so the proof isn't vacuous for the params the emit sweep can't reach):
 *   • WIRING (structural, all bindings) — set one param to a sentinel and assert BOTH instantiate AND drillStack land
 *     it in the binding's (blockIndex,key); a wrong/dropped/swapped key fails. This is the ONLY thing that can validate
 *     the x0/y0 + pattern-SHAPE bindings, which emit-equivalence structurally cannot reach (any pattern that moves the
 *     bounding box diverges on frontier #2 regardless of whether its binding is correct).
 *   • EMIT-EQUIVALENCE (the params a static template fully reproduces) — grid-at-origin geometry + cut + skip + wcs
 *     emit byte-identical to drillStack across a sweep.
 * Stage 6 authors the template independently too (then the builder can be deleted); that's the self-host step, not this one.
 */
import { drillStack } from '../../wizards/drillWizard.js';
import { userOpFromStack } from '../userOps.js';

/** The author defaults — match drillStack's own num() fallbacks so the seeded template == the true default stack. */
export const DRILL_DEFAULTS = {
    pattern: 'grid', x0: 0, y0: 0, cols: 3, rows: 2, dx: 20, dy: 20,
    count: 4, spacing: 20, angle: 0, dia: 50, startAngle: 0, w: 100, h: 80, nx: 2, ny: 2, skip: '',
    depth: 5, peck: 5, feed: 100, clearance: 5, wcs: 'active', method: 'peck',
};

// The hand-authored binding map: each drill param → its (blockIndex, key) socket in the flattened default template.
// Flatten (pre-order) of drillStack's [progstart, wcs, placeonstock{array{drill}}, progend]:
//   0 progstart · 1 wcs · 2 placeonstock · 3 array · 4 drill · 5 progend
// (clearance is deliberately NOT bound — frontier #3; method is NOT bound — frontier #1; the placeonstock bbox
//  snapshot on block 2 is a DERIVED value, not a scalar socket — frontier #2, which is why placement params are
//  intentionally absent here: this def does not claim to support stock-placement.)
export const DRILL_BINDINGS = [
    { param: 'wcs', blockIndex: 1, key: 'wcs', type: 'enum', default: DRILL_DEFAULTS.wcs },
    // pattern + geometry (block 3, the `array` container — patternPoints reads these scalars at emit)
    { param: 'pattern', blockIndex: 3, key: 'pattern', type: 'enum', default: DRILL_DEFAULTS.pattern },
    { param: 'x0', blockIndex: 3, key: 'x0', type: 'number', default: DRILL_DEFAULTS.x0 },
    { param: 'y0', blockIndex: 3, key: 'y0', type: 'number', default: DRILL_DEFAULTS.y0 },
    { param: 'cols', blockIndex: 3, key: 'cols', type: 'number', default: DRILL_DEFAULTS.cols },
    { param: 'rows', blockIndex: 3, key: 'rows', type: 'number', default: DRILL_DEFAULTS.rows },
    { param: 'dx', blockIndex: 3, key: 'dx', type: 'number', default: DRILL_DEFAULTS.dx },
    { param: 'dy', blockIndex: 3, key: 'dy', type: 'number', default: DRILL_DEFAULTS.dy },
    { param: 'count', blockIndex: 3, key: 'count', type: 'number', default: DRILL_DEFAULTS.count },
    { param: 'spacing', blockIndex: 3, key: 'spacing', type: 'number', default: DRILL_DEFAULTS.spacing },
    { param: 'angle', blockIndex: 3, key: 'angle', type: 'number', default: DRILL_DEFAULTS.angle },
    { param: 'dia', blockIndex: 3, key: 'dia', type: 'number', default: DRILL_DEFAULTS.dia },
    { param: 'startAngle', blockIndex: 3, key: 'startAngle', type: 'number', default: DRILL_DEFAULTS.startAngle },
    { param: 'w', blockIndex: 3, key: 'w', type: 'number', default: DRILL_DEFAULTS.w },
    { param: 'h', blockIndex: 3, key: 'h', type: 'number', default: DRILL_DEFAULTS.h },
    { param: 'nx', blockIndex: 3, key: 'nx', type: 'number', default: DRILL_DEFAULTS.nx },
    { param: 'ny', blockIndex: 3, key: 'ny', type: 'number', default: DRILL_DEFAULTS.ny },
    { param: 'skip', blockIndex: 3, key: 'skip', type: 'string', default: DRILL_DEFAULTS.skip },
    // cut params (block 4, the peck `drill` leaf)
    { param: 'depth', blockIndex: 4, key: 'depth', type: 'number', default: DRILL_DEFAULTS.depth },
    { param: 'peck', blockIndex: 4, key: 'peck', type: 'number', default: DRILL_DEFAULTS.peck },
    { param: 'feed', blockIndex: 4, key: 'feed', type: 'number', default: DRILL_DEFAULTS.feed },
];

export const DRILL_DATA_OPTYPE = 'user_drill_data';

/** Build the drill-as-data def: a fresh { opType, label, template, bindings } ready for registerUserOp. The template
 *  is drillStack(defaults) with ids stripped (userOpFromStack does both) — the canonical valid-by-construction stack. */
export function drillDataDef() {
    return userOpFromStack('drill_data', 'Drill (data)', drillStack(DRILL_DEFAULTS), DRILL_BINDINGS, 'form3d');
}
