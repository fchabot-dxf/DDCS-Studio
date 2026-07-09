/**
 * wizards/ops/alignPoints.js — the ONE source for the alignment probe geometry (t506; REDEFINED t544).
 *
 * The alignment wizard probes a fence at point A then point B. The t544 redesign (design-locked):
 *   • Point A = WHEREVER the machine is when the program runs — the emit does NOT travel to A (no Confirm gate; the
 *     corner/edge contract: position first, run, it probes). In the SIM/preview, A is a draggable START anchor (sim-only,
 *     NOT emitted) so you can visualise where the probe begins — stored as params.ax/ay FRACTIONS of the stock.
 *   • Point B = A + a DECLARED SPAN along the checkAxis fence (mm). AUTO's ONLY jog: lift to safe-Z, step the span as a
 *     RELATIVE move, descend, probe. The span is the declared value (params.span), signed along checkAxis (B may be either
 *     side of A). Handle B's drag sets the span (B−A along checkAxis); typing the span moves handle B (the ONE source).
 *
 * So the declared geometry is a SCALAR span (plain mm) + a sim-only A anchor — NOT two absolute coords. AUTO no longer
 * needs a stock (the span is mm, not a fraction × stock). Neutral module (no wizard/viz imports) so alignmentWizard,
 * opSimStarts, and the twin can all read it without a cycle.
 */

const num = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);

/** Default A→B span (mm along the checkAxis fence) when params.span is unset. A sensible fence stride. */
export const DEFAULT_ALIGN_SPAN = 50;

// t528 — NO [0,1] clamp on A's anchor fraction: the stock is a REFERENCE, not a hard bound (a handle past the stock edge
// resolves to a real machine point; the only real limit is the envelope, enforced at the drag in userOpView.writeSimStartFrac).
const frac = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);

/** The default A-anchor fraction for a checkAxis — a sensible spot ON the fence (near the far edge, part-way along). */
export function alignDefaultAnchor(checkAxis) {
    return (checkAxis === 'Y')
        ? { fx: 0.85, fy: 0.3 }    // fence along Y → A sits at the +X edge, low in Y (span steps +Y toward B)
        : { fx: 0.3, fy: 0.85 };   // fence along X → A sits high in Y, part-way along X (span steps +X toward B)
}

/** The sim-only A anchor as a FRACTION {fx,fy} (stored value wins; empty → the checkAxis default). B is DERIVED (A+span). */
export function alignAnchor(params = {}) {
    const checkAxis = params.checkAxis === 'Y' ? 'Y' : 'X';
    const d = alignDefaultAnchor(checkAxis);
    return { fx: frac(params.ax, d.fx), fy: frac(params.ay, d.fy) };
}

/** The declared A→B span (mm along checkAxis), signed. */
export function alignSpan(params = {}) { return num(params.span, DEFAULT_ALIGN_SPAN); }

/**
 * The 2 SIM markers as stock-frame COORDINATES (mm): A = the anchor fraction × stock; B = A + span along the checkAxis.
 * SIM-ONLY (the preview markers + the sim start) — the emit never uses these (A is probed in place, B is a relative jog).
 * @returns {[{x:number,y:number},{x:number,y:number}]}  [A, B]
 */
export function alignMarkersXY(params = {}, stock = {}) {
    const sx = (stock && Number(stock.x)) || 0, sy = (stock && Number(stock.y)) || 0;
    const A = alignAnchor(params);
    const ax = A.fx * sx, ay = A.fy * sy;
    const span = alignSpan(params);
    const checkAxis = params.checkAxis === 'Y' ? 'Y' : 'X';
    const B = checkAxis === 'X' ? { x: ax + span, y: ay } : { x: ax, y: ay + span };
    return [{ x: ax, y: ay }, B];
}

/**
 * The EFFECTIVE travel mode — the ONE source shared by the JS builder (alignmentStack) + the twin's prune derive. t544:
 * AUTO no longer needs a stock (the span is plain mm), so this is now purely the user's choice: `manual` → MANUAL, else AUTO.
 * Default (unset) = auto.
 */
export function alignEffectiveTravel(params) {
    return (params && params.travel === 'manual') ? 'manual' : 'auto';
}
