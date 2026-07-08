/**
 * wizards/ops/alignPoints.js — the ONE source for the 2 alignment probe points (t506).
 *
 * The alignment wizard probes a fence at point A then point B. Those 2 points are declared ONCE here as FRACTIONS of the
 * stock (0..1 in X and Y), so they SCALE with the stock size (like corner's _datumFrac). EVERY surface reads this one
 * source: the 2D layout canvas (2 draggable handles), the sim preview (opSimStarts → 2 markers), and the emit (AUTO mode
 * rapids to these positions). Stored on the op as params.ax/ay/bx/by (fractions); an empty field falls back to a sensible
 * default spread along the checkAxis fence (near the far edge) — a drag writes a concrete value that then persists.
 *
 * Neutral module (no wizard/viz imports) so alignmentWizard, opSimStarts, and alignmentView can all read it without a cycle.
 */

const frac = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Math.max(0, Math.min(1, Number(v)));

/** The default A/B fractions for a checkAxis — spread along the fence axis, near the far (0.85) edge (mirrors the old 0.3/0.7). */
export function alignDefaultPoints(checkAxis) {
    return (checkAxis === 'Y')
        ? [{ fx: 0.85, fy: 0.3 }, { fx: 0.85, fy: 0.7 }]   // fence along Y → A/B differ in Y
        : [{ fx: 0.3, fy: 0.85 }, { fx: 0.7, fy: 0.85 }];  // fence along X → A/B differ in X
}

/**
 * The 2 probe points as FRACTIONS, from the op params (stored value wins; empty → the checkAxis default).
 * @returns {[{fx:number,fy:number},{fx:number,fy:number}]}  [A, B] in 0..1
 */
export function alignPoints(params = {}) {
    const checkAxis = params.checkAxis === 'Y' ? 'Y' : 'X';
    const def = alignDefaultPoints(checkAxis);
    return [
        { fx: frac(params.ax, def[0].fx), fy: frac(params.ay, def[0].fy) },
        { fx: frac(params.bx, def[1].fx), fy: frac(params.by, def[1].fy) },
    ];
}

/**
 * The 2 probe points as stock-frame COORDINATES (mm) — fractions × stock size. Used by the sim markers + the AUTO emit.
 * @returns {[{x:number,y:number},{x:number,y:number}]}
 */
export function alignPointsXY(params = {}, stock = {}) {
    const sx = (stock && Number(stock.x)) || 0, sy = (stock && Number(stock.y)) || 0;
    const [A, B] = alignPoints(params);
    return [{ x: A.fx * sx, y: A.fy * sy }, { x: B.fx * sx, y: B.fy * sy }];
}

/** A usable stock for AUTO = a positive-XY block (the fractions resolve to real coords). */
export function alignStockUsable(stock) { return !!(stock && Number(stock.x) > 0 && Number(stock.y) > 0); }

/**
 * The EFFECTIVE travel mode — the ONE source shared by the JS builder (alignmentStack), the twin's prune derive, and the
 * twin's applyAlignAutoTravel recompose, so all three agree. AUTO needs a usable stock: `manual` chosen OR no stock → MANUAL
 * (so `user_alignment_data` without a stock emits byte-identical to the old MANUAL, E1/E3); else AUTO. Default (unset) = auto.
 */
export function alignEffectiveTravel(params, stock) {
    return ((params && params.travel === 'manual') || !alignStockUsable(stock)) ? 'manual' : 'auto';
}
