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
const setF = (v) => (v !== '' && v != null && !isNaN(Number(v)));
const DEFAULT_ALONG_FRAC = 0.3;   // A's default position ALONG the fence (part-way); B rides to A+span (≈0.7 for the default span)

/**
 * The PROBED FENCE FACE for a (checkAxis × probeDir) combo (t574 — the RULED model): alignment probes the stock wall whose
 * outward normal OPPOSES the probe direction, approached from OUTSIDE. checkAxis picks the probe axis (X→probe Y; Y→probe X);
 * probeDir picks the SIGN. `{ perp, sign }`: `perp` = the axis the probe travels (the tool's PERPENDICULAR-to-fence axis);
 * `sign` = +1 → the tool sits ABOVE the +face (probes −, hits the +face); −1 → BELOW the −face (probes +, hits the −face).
 *   X,+ → probe +Y → the −Y face (sign −1); X,− → +Y face (sign +1); Y,+ → −X face (−1); Y,− → +X face (+1).
 */
export function alignProbedFace(checkAxis, probeDir) {
    const perp = checkAxis === 'Y' ? 'x' : 'y';   // fence along Y → probe X; fence along X → probe Y
    const sign = probeDir === 'neg' ? 1 : -1;     // probeDir+ (probe +) → the − face (below); probeDir− (probe −) → the + face (above)
    return { perp, sign };
}

/** The declared A→B span (mm along checkAxis), signed. */
export function alignSpan(params = {}) { return num(params.span, DEFAULT_ALIGN_SPAN); }

/**
 * The 2 SIM markers as stock-frame COORDINATES (mm) — the t574 RULED model. A = an APPROACH POINT: ALONG the fence at the
 * default fraction (or the dragged ax/ay), PERPENDICULAR = just OUTSIDE the probed face (an approach standoff ~ retract+2mm,
 * face-derived per checkAxis × probeDir) so the default sits OUTSIDE the stock and the probe collides by construction. A is
 * FREELY draggable both axes; B RIDES A's approach line (B.perp == A.perp) offset by the span ALONG the fence. SIM-ONLY (the
 * preview markers + the sim start) — the emit never uses these (A is probed in place, B is a relative jog).
 * @returns {[{x:number,y:number},{x:number,y:number}]}  [A, B]
 */
export function alignMarkersXY(params = {}, stock = {}) {
    const sx = (stock && Number(stock.x)) || 0, sy = (stock && Number(stock.y)) || 0;
    const checkAxis = params.checkAxis === 'Y' ? 'Y' : 'X';
    const probeDir = params.probeDir === 'neg' ? 'neg' : 'pos';
    const span = alignSpan(params);
    const standoff = num(params.retract, 2) + 2;   // the marker sits this far OUTSIDE the probed face (a probing standoff)
    const { sign } = alignProbedFace(checkAxis, probeDir);
    // the PERPENDICULAR default: just outside the face — sign −1 → below the − face (0 − standoff); +1 → above the + face (dim + standoff)
    const perpDefault = (dim) => sign < 0 ? -standoff : dim + standoff;
    if (checkAxis === 'X') {
        const ax = (setF(params.ax) ? Number(params.ax) : DEFAULT_ALONG_FRAC) * sx;                 // ALONG the fence (X)
        const ay = setF(params.ay) ? Number(params.ay) * sy : perpDefault(sy);                      // PERPENDICULAR (Y): just outside the ∓Y face
        return [{ x: ax, y: ay }, { x: ax + span, y: ay }];                                         // B rides A's line (== ay), offset by the span along X
    }
    const ay = (setF(params.ay) ? Number(params.ay) : DEFAULT_ALONG_FRAC) * sy;                     // ALONG the fence (Y)
    const ax = setF(params.ax) ? Number(params.ax) * sx : perpDefault(sx);                          // PERPENDICULAR (X): just outside the ∓X face
    return [{ x: ax, y: ay }, { x: ax, y: ay + span }];                                             // B rides A's line (== ax), offset by the span along Y
}

/**
 * The EFFECTIVE travel mode — the ONE source shared by the JS builder (alignmentStack) + the twin's prune derive. t544:
 * AUTO no longer needs a stock (the span is plain mm), so this is now purely the user's choice: `manual` → MANUAL, else AUTO.
 * Default (unset) = auto.
 */
export function alignEffectiveTravel(params) {
    return (params && params.travel === 'manual') ? 'manual' : 'auto';
}
