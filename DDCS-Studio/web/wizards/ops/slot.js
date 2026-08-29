/**
 * wizards/ops/slot.js — SLOT primitive (kind:'leaf', category:'Ops').
 *
 * The one wizard op with no block equivalent until now: a widened channel from (x0,y0)→(x1,y1) at ANY angle,
 * `width` wide (≥ tool Ø), zig-zag offset passes stepping down to `depth`. The tool CENTRE travels the axis;
 * width>tool adds parallel passes offset perpendicular by the stepover. NOT a region fill (its passes run
 * along the slot axis, not axis-aligned scanlines), so it's its own atom. `slotPath` is the shared kernel —
 * SlotWizard and this block both emit through it, so they're one implementation (like drill = array(bore)).
 */
import { num, r3 } from './util.js';
import { depthLevels, entryOrPlunge } from '../clearing.js';
import { pointsBBox } from './placement.js';
import { toolTooLarge, toolFitRefusal, refusalLines } from './toolFit.js';   // t1444 — the ONE too-small boundary + the family's refusal form
import { surfaceRasterCovers, surfaceRasterGap } from './surfaceraster.js';   // t1498 — the atom's OWN envelope decides whether this slot may ride it

/**
 * t1444 — THE SLOT'S OWN SPAN, DECLARED: a slot offers the tool exactly its WIDTH, and nothing else about a slot
 * constrains the tool (its LENGTH is travel, not clearance — a slot shorter than the tool is still a legal plunge-
 * and-move, and the zero-length degenerate already has its own arm). So the boundary is one comparison, and both the
 * predicate and the sentence read this one number.
 */
export const slotMaxToolDia = (p = {}) => num(p.width, num(p.tool, num(p.toolDia, 6)));
/** Is this slot strictly narrower than its tool → refuse everywhere? (Exactly tool-width is ALLOWED — the ruling.) */
export const slotTooSmall = (p = {}) => toolTooLarge(slotMaxToolDia(p), num(p.tool, num(p.toolDia, 6)));
/** The operator sentence for a slot the tool cannot fit, or '' — one wording for emit, preview, twin and CAM pack. */
export const slotToolRefusal = (p = {}) => toolFitRefusal(slotMaxToolDia(p), num(p.tool, num(p.toolDia, 6)), 'slot');

// t2036 — the ONE declared perpendicular-offset fact (PREVIEW-AS-DATA.md Tier-2 #11), now reused by both preview
// consumers (slotData.js's twin, slotView.js's classic wizard) instead of each hand-typing this 2-line formula a
// second and third time. Each caller keeps its OWN dx/dy/len (and its own zero-length handling — the emit below
// short-circuits into a single-plunge comment before ever reaching this; a preview instead defaults len to 1 so
// it still has something to draw for a degenerate A==B) — only the shared vector math collapses onto one place.
export const slotPerp = (dx, dy, len) => ({ nx: -dy / len, ny: dx / len });   // perpendicular (left of A→B)

/** Slot toolpath: clearance preamble + zig-zag offset passes stepping down (+ zero-length single-plunge guard). */
export function slotPath(p) {
    const x0 = num(p.x0, 0), y0 = num(p.y0, 0), x1 = num(p.x1, 60), y1 = num(p.y1, 0);
    const tool = Math.max(0.1, num(p.tool, 6));
    /**
     * ── t1444 — THE CLAMP THAT HID THE DEFECT, REPLACED BY A REFUSAL (user-ruled) ─────────────────────────────────
     *
     * This line was `Math.max(tool, num(p.width, tool))`. A 6.35mm slot asked of a 12.7mm tool came out as a **12.7mm
     * slot** — the wrong number repaired into a plausible one before anything could notice it was wrong, which is why
     * it survived: the program was clean, the preview confident, and the channel twice the width that was typed.
     * A strictly-smaller slot now refuses with no motion (`slotTooSmall` is the one boundary, shared with the twin and
     * the CAM pack); EXACTLY tool-width keeps the single centreline pass it has always emitted, byte-identical.
     */
    const width = num(p.width, tool);
    const refusal = slotToolRefusal({ ...p, tool, width });
    if (refusal) return refusalLines(refusal);
    const so = Math.max(0.2, tool * num(p.stepoverPct, 40) / 100);
    const depth = num(p.depth, 4);
    const clr = num(p.clearance, 5), feed = num(p.feed, 2000), plunge = num(p.plunge, 150);
    const sd = num(p.stepdown, 1.5);
    const levels = depthLevels(depth, sd);
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    const L = [];   // program-level clearance is provided by the enclosing program (emitMapped header)

    if (len < 1e-6) {     // A == B → just a plunged hole
        L.push('( zero-length slot — single plunge )');
        for (const d of levels) L.push(`G0 X${r3(x0)} Y${r3(y0)}`, `G1 Z${r3(-d)} F${plunge}`, `G0 Z${clr}`);
        return L;
    }

    const { nx, ny } = slotPerp(dx, dy, len);
    const band = Math.max(0, width - tool);     // width the tool centre must sweep
    const offs = [];
    if (band < 1e-6) offs.push(0);
    else { const half = band / 2; for (let o = -half; o < half - 1e-6; o += so) offs.push(o); offs.push(half); }

    // t842 — DEPTH ENTRY: ramp runs along the slot LENGTH (the pass direction, not toward-centre); a helix must fit the
    // slot WIDTH (helix + tool ≤ width/2) — a tool-width slot degrades to plunge with a why. Plunge (default) = byte-identical.
    const entry = p.entry || 'plunge';
    const wantR = num(p.helixDia, 0) > 0 ? num(p.helixDia, 0) / 2 : tool / 2;
    const helixMaxR = width / 2 - tool / 2, helixR = Math.max(0.2, Math.min(wantR, helixMaxR));
    /**
     * ── t1524 — THE DESCENT STARTS FROM THE FLOOR THAT IS REALLY THERE, and the FAMILY came to the slot ───────────
     *
     * ⚠ THE HISTORY MATTERS HERE MORE THAN USUAL, because this line has now moved twice and a reader who sees only
     * the current form will mis-read the second move as an undo of the first.
     *
     *   t1498  this kernel passed `-prevD` — the REAL previous level — and was the ONLY descent in the corpus that
     *          ramped the actual remaining bite on a clamped final level. That made ramping slots undescribable by
     *          the parametric atom, which is what `SLOT_RAMP_PARTIAL_GAP` refused.
     *   t1506  t1504 measured the family and found the split was three-to-one the OTHER way, so the slot converged on
     *          the nominal `z + sd`. The gate retired and the shipped-default ramping slot went parametric — a real
     *          capability, bought with the less efficient descent, and t1504 said so at the time.
     *   t1524  THE SHELVED HALF LANDS: the whole family moves to the actual floor instead — the atom (`#46 − #35`),
     *          `stepover.js` and `contourfill.js` through the StepDown scope contract, and this kernel back to the
     *          floor it always had. So this is NOT a revert of t1506. t1506 converged the family; this act keeps it
     *          converged and moves the agreed value onto the more correct descent.
     *
     * WHAT THE ACTUAL FLOOR BUYS: on a partial final level the nominal `z + sd` sits `(stepdown − lastBite)` ABOVE
     * the real floor, so the ramp spends that much of its descent cutting air the previous level already cleared —
     * 9.54mm of run at the shipped defaults (depth 4 @ 1.5, 3°). Neither form ever overshoots (both end at exactly
     * the asked depth, measured 0.0000 across depths 3/4/5/2/3.2 by stepdowns 1.5/0.75/0.8), so this is efficiency
     * and meaning rather than safety: a ramp ANGLE should describe the drop that is actually left.
     *
     * It is set ONCE for every entry, exactly as the other three call sites do it — the helix reads the same `prevZ`,
     * and giving the two descents different floors is the kind of split this arc exists to close.
     */
    let prevD = 0;
    for (const d of levels) {
        const z = -d;
        L.push(`( level Z${r3(z)} )`);
        let dir = 1, first = true;
        for (const o of offs) {
            let sx = x0 + nx * o, sy = y0 + ny * o, ex = x1 + nx * o, ey = y1 + ny * o;
            if (dir < 0) { [sx, ex] = [ex, sx];[sy, ey] = [ey, sy]; }
            if (first) {
                const ctx = { entry, z, prevZ: -prevD, rampAngle: num(p.rampAngle, 3), feed,
                    runX: ex - sx, runY: ey - sy, runLen: len,                                   // ramp along the pass (the slot length)
                    helixR, helixPitch: num(p.helixPitch, 1), maxHelixR: helixMaxR,
                    cx: sx + helixR * (ex - sx) / len, cy: sy + helixR * (ey - sy) / len };       // helix centred R into the slot (stays inside)
                L.push(...entryOrPlunge(ctx, sx, sy, [`G0 X${r3(sx)} Y${r3(sy)}`, `G1 Z${r3(z)} F${plunge}`]));
                first = false;
            }
            else L.push(`G1 X${r3(sx)} Y${r3(sy)} F${feed}`);   // step across to the next pass
            L.push(`G1 X${r3(ex)} Y${r3(ey)} F${feed}`);
            dir = -dir;
        }
        L.push(`G0 Z${clr}`);
        prevD = d;   // t1524 — the floor the NEXT level starts from
    }
    return L;
}

/**
 * ── t1442 — WHY A SLOT'S CLEARING STAYS LITERAL, DECLARED AS DATA (the rest-machining precedent) ──────────────────
 *
 * T4 opened by asking whether this kernel's zig-zag is the raster atom's parallel walk over the slot's rect. It was
 * MEASURED before anything was built (both walks emitted, both traced through the real engine) and the answer is no —
 * four times over, three of them on a capability the atom does not declare. Written down rather than left to be
 * rediscovered, exactly as `REST_PARAMETRIC_GAP` is, because the acts behind this one (pocketfill's declared domain —
 * t1464 CLOSED that item as SCOPED rather than retired: the atom shrank to non-rect + rest permanently — and the
 * porting arc) must know which walks may become runtime loops from a DECLARATION and not by reading three kernels.
 *
 * ── 1. THE ROW RULE IS A DIFFERENT RULE, and it is the one that cuts a different part ─────────────────────────────
 * This kernel anchors its passes ON the wall — `offs` runs ±(width−tool)/2 — and FORCES a final pass clamped to the far
 * wall, so the finished channel is exactly `width` whatever the stepover leaves over. The atom counts *rows that FIT*:
 * uniformly spaced, the first half a stepover INSIDE the walked edge, the last wherever it lands. That is the right
 * rule for its own two jobs (surfacing lets the tool overhang; a pocket has a wall-finish pass behind it) and a slot
 * has neither. Measured on 60×12, Ø6 @40%:
 *
 *     slotPath   4 passes at y = −3, −0.6, 1.8, 3        → a 12.0mm channel, the width that was typed
 *     the atom   3 rows   at y = −1.8, 0.6, 3            → a 10.8mm channel — 1.2mm NARROW
 *     …and phase-corrected (walk a rect one stepover taller, so the rows start on the wall) the atom's last row lands
 *     at 4.2 — 1.2mm PAST the wall, i.e. OVERSIZE, which is the destructive direction of the same miss.
 *
 * THE DIVERGENCE REGION IS NAMED, because an unmeasured agreement is not an agreement: the two row sets coincide
 * EXACTLY when (width − tool) is a whole multiple of the stepover (measured identical at 18×Ø6@40%, 13.2×Ø6@40%,
 * 20×Ø8@50%; different at 12, 16.8 and 15). So the row rule alone CAN be dialled past — which is precisely why the
 * boundary does not rest on it, and why the three below matter.
 *
 * ── 2. THE INSET IS ANISOTROPIC, and the atom's is one number ─────────────────────────────────────────────────────
 * A slot is held tool/2 inside across its WIDTH and not at all along its LENGTH — the tool centre runs the full
 * centreline, A to B. The atom's `inset` moves BOTH axes (`w − 2·inset`, `h − 2·inset`), so handing it tool/2 walks a
 * 60mm slot from x=3 to x=57: a 54mm channel where 60 was asked. Measured.
 *
 * ── 3. THE AXIS — a slot has a bearing, the atom's rows have an axis ──────────────────────────────────────────────
 * The passes run on the slot's own bearing (measured 30.000° on a 30° slot, its step-overs at 120°); the atom's rows
 * run ∥X or ∥Y (`rasterRowAxisOf`). Only `rotAngle` could express the angle, and that socket means the PROGRAM's
 * declared rotation — a second, unrelated quantity that would have to compose with it.
 *
 * ── 4. THE DESCENT IS ANCHORED TO DIFFERENT GEOMETRY ──────────────────────────────────────────────────────────────
 * This kernel declares its run vector: a slot ramps ALONG its length (measured (0,−3)→(28.622,−3), pure along-axis)
 * and helixes at the ENTRY END clamped to the slot WIDTH (centre (1,−3)). The atom bakes ramp-toward-AREA-CENTRE
 * (measured (0,−1.8)→(28.57,−0.086) — a diagonal that drifts across the channel) and a helix at the AREA CENTRE
 * (measured (32,0) — the middle of the slot, which it then cuts back out of).
 *
 * ⚠ THIS IS A BOUNDARY OF THE ATOM'S DECLARED AXES, NOT OF ARITHMETIC — and that distinction is the whole reason it is
 * recorded rather than ruled. Rest's obstruction is SQRT on an unverified controller and only evidence lifts it. These
 * four are things the atom COULD be taught (a wall-anchored row rule, a two-axis inset, the slot's bearing, the
 * declared run vector t1339's own TODO already names) — which makes this a capability arc to be opened deliberately,
 * with its own bridge per step, and NOT a re-point that can ride the t1406 recipe. `tests/slot-parametric-boundary-
 * 1442.spec.js` MEASURES every clause on the real walks, so the day any of them closes the spec goes red and this
 * declaration has to be cut down rather than quietly kept.
 */
export const SLOT_RASTER_GAP = 'a slot is not a rectangle the raster atom walks, measured four ways. THE ROW RULE: '
    + 'slotPath anchors its passes ON the wall (+/-(width-tool)/2) and FORCES a final pass clamped to the far wall, so '
    + 'the channel is exactly the width you typed; the atom USED to take uniformly spaced rows half a stepover inside '
    + 'the walked edge and keep only those that FIT (60x12 Ø6 @40%: 4 passes at -3,-0.6,1.8,3 against 3 at '
    + '-1.8,0.6,3 - a channel 1.2mm NARROW, or 1.2mm OVERSIZE once the seeding was phase-corrected without a clamp), '
    + 'and C1 (t1492) taught it the wall rule with its clamp as ONE step, so this clause is retired - handed '
    + 'rowAnchor:wall it reproduces slotPath move for move at every width measured, whole-multiple or not. THE INSET: a slot is held tool/2 '
    + 'inside across its WIDTH and not at all along its LENGTH; the atom used to inset both axes by one number (a '
    + '60mm slot walked 3..57) and C2 (t1490) taught it a PAIR, so this clause is retired - handed (0, tool/2) the '
    + 'atom walks the full 0..60 centreline. THE AXIS: the passes run on the slot bearing; the atom rows ran parallel '
    + 'to X or Y until C3 (t1494) gave it a BAKED bearing, so this clause is retired too - handed the slot bearing it '
    + 'reproduces slotPath at every angle measured. A DIALLED bearing is still refused: that half needs COS/SIN of a '
    + 'runtime angle and waits on V13. THE '
    + 'DESCENT: a slot ramps ALONG its length and helixes at the ENTRY END clamped to the slot width; the atom now '
    + 'ramps along its own ROW (C4, t1485 - it used to ramp toward the AREA CENTRE, and that half of this clause is '
    + 'retired) but still helixes in the middle of the channel with the radius clamped by the rect inradius. Three of '
    + '⚠ ALL FOUR CLAUSES ARE RETIRED NOW (C4 t1485, C2 t1490, C1 t1492, C3 t1494), so this declaration no longer '
    + 'describes a walk the atom cannot do. WHAT REMAINS IS NOT A WALK BUT TWO NAMED EVIDENCE GATES, and they are why '
    + 'the slot still keeps its literal kernel: a DIALLED bearing needs COS/SIN of a runtime angle (trig, unverified '
    + 'here - V13 decides), and a slot HELIX entry still wants the true-arc form the atom does not have, so the atom '
    + 'helixes in the MIDDLE of the channel clamped by the rect inradius rather than at the ENTRY END clamped to the '
    + 'slot width. A BAKED-bearing, PLUNGE-or-RAMP slot is expressible by the atom today, and whether to re-point '
    + 'this kernel onto it is a RULING rather than a capability gap - the arc closed, the decision did not';

/**
 * Why THIS slot's clearing cannot ride the parametric raster — or '' when there is no clearing walk to port at all.
 *
 * Keyed on the SAME degenerate test the kernel itself branches on (a zero-length slot is a single plunge, not a walk),
 * and NOT on any of the numbers: every clause above lives in the walk, so no width, tool, stepover or angle can dial
 * past it. The 1442 spec asserts both halves — the refusal on every dimension moved, and the '' on the degenerate.
 */
export function slotRasterGap(p = {}) {
    const len = Math.hypot(num(p.x1, 60) - num(p.x0, 0), num(p.y1, 0) - num(p.y0, 0));
    return len < 1e-6 ? '' : SLOT_RASTER_GAP;
}

/**
 * ── t1498 — THE RE-POINT. The arc closed as a RULING; this is the ruling taken ────────────────────────────────────
 *
 * `SLOT_RASTER_GAP` above is the BOUNDARY — what a slot's walk needs and what the atom can express. This section is
 * the OPERATIONAL twin of it: which slots actually ride the atom today, and the REASON, in words, for each that does
 * not. Two names because they are two questions (the pocket keeps the same split: `POCKET_SHAPE_GAP` declares the
 * permanent literal domain, `pocketRasterGap` picks the arm), and collapsing them would make the boundary's careful
 * "what is left is TWO EVIDENCE GATES" reading answer a question about arithmetic it was never measuring.
 */

/**
 * THE SLOT'S OWN BEARING, in degrees — `atan2(B − A)`, and it is BAKED by construction.
 *
 * A slot's angle is geometry the operator DREW, so it is known when the program is built: two build-time constants,
 * no registers, no trig on the controller, no evidence required (C3, t1494). The DIALLED half — an operator turning
 * the bearing at the pendant — would need COS/SIN of a runtime angle and stays V13's decision; nothing here can
 * reach it, because this function computes a NUMBER from two drawn endpoints.
 */
export function slotBearingDeg(p = {}) {
    return Math.atan2(num(p.y1, 0) - num(p.y0, 0), num(p.x1, 60) - num(p.x0, 0)) * 180 / Math.PI;
}

/**
 * ── t1506 — THE THIRD GATE IS RETIRED, AND THIS IS WHERE IT STOOD ────────────────────────────────────────────────
 *
 * t1498 found a boundary the arc's inventory never named: a RAMP entry over a PARTIAL last depth level. The slot
 * kernel ramped the ACTUAL remaining drop (a 1.0mm last bite = a 19.08mm run at 3°) while the shared atom ramped a
 * NOMINAL full stepdown (28.62mm), so the descent entered the material `(stepdown − lastBite)/tan(rampAngle)`
 * further along — 9.54mm on the wizard's OWN defaults. Every ramp config with a partial last bite diverged and no
 * other config did, so those slots were routed literal.
 *
 * t1504 measured the whole family and found the split ran the OTHER way: `stepover.js` (pocket, surfacing),
 * `contourfill.js` (contour) and the atom itself all ramp the nominal stepdown. **The slot kernel was the outlier**,
 * and the boundary was not a capability the atom lacked — it was one kernel disagreeing with three.
 *
 * So the slot converged on the nominal form (see `slotPath`) and the boundary CEASED TO EXIST. It is not narrowed,
 * not deferred, and not gated on evidence: there is no longer a divergence for a gate to describe. `SLOT_HELIX_GAP`
 * and the zero band still stand on their own measurements; this one has no subject left.
 *
 * ⚠ THE RULING THAT MADE IT SAFE, recorded because it is what a future reader will want: the nominal floor
 * (`z + stepdown`) is at or ABOVE the true floor and never below it, so a nominal descent starts in air the previous
 * level already cleared and can only cut LESS, never more — safe by DIRECTION rather than by margin. Measured across
 * depths 3/4/5/2/3.2 by stepdowns 1.5/0.75/0.8: every kernel ends at exactly the asked depth (overshoot 0.0000) and
 * leaves no material. The cost is a longer approach; the payoff is that the SHIPPED-DEFAULT ramping slot is now
 * expressible by the atom. The more-correct actual-drop form is shelved as a family-wide efficiency act — it is a
 * real improvement, it is simply not this one, and doing it here would have moved every ramped literal emit in the
 * corpus for a benefit measurement puts at zero.
 */

/**
 * THE HELIX, which the arc already named and which stays exactly where it was.
 *
 * A slot helixes at the ENTRY END clamped to the slot WIDTH; the atom helixes in the MIDDLE of the channel clamped by
 * the rect inradius, and then has to cut its way back out of the middle. Different geometry, not a rounding.
 */
export const SLOT_HELIX_GAP = 'a HELIX entry: the slot descends at the ENTRY END with its radius clamped to the slot '
    + 'WIDTH, and the raster atom helixes in the MIDDLE of the channel clamped by the rect inradius — a different '
    + 'place to enter the material, which is one of the two evidence gates SLOT_RASTER_GAP names as what is left';

/**
 * A slot's clearing expressed in the ATOM'S OWN WORDS — the one source, read by the stack builder AND by the bridges.
 *
 * ⚠ THE PLACEMENT IS THE WHOLE SUBTLETY, so it is written once here rather than re-derived per caller. The atom walks
 * a RECT and turns it about its DECLARED origin; a slot is that rect with its near-edge MIDPOINT sitting on A. So the
 * origin is `A − R(bearing)(0, width/2)` — and it is computed UNROUNDED, because rounding it to the emit's three
 * decimals injects up to half a quantum of placement error that then reads as a code difference (measured at t1494,
 * at 137.5 degrees, where it read 0.0020 until the harness stopped rounding its own inputs).
 *
 * The four capabilities the arc built are all here, and each is the one the slot actually needs:
 *     insetAlong 0 / insetAcross tool/2   C2 — held a radius across the WIDTH, nothing along the LENGTH
 *     rowAnchor 'wall'                    C1 — passes ON the wall plus the forced final one, so the channel is the
 *                                              width that was typed
 *     bearing                             C3 — the passes run on the slot's own angle
 *     entry + rampAngle                   C4 — the ramp runs along the ROW, which for a slot IS its length
 */
/**
 * ── t1512 — THE SECOND RENDERING: the same frame with the pendant knobs as REGISTER WORDS ─────────────────────────
 *
 * A packed CAM slot needs THIS param set with `width`/`toolDia`/`stepoverPct`/`depth`/`stepdown`/`feed`/`plunge`/
 * `clearance` as live `#11xx`-mirror registers, and the frame (bearing, length, A) baked — the arrangement
 * `SLOT_CAM_PACK_DESIGN` settled. The obvious way to get it is a second function in `opToSlot` that re-derives
 * `x = x0 + (width/2)·sin(bearing)`, and that is exactly the divergence this file keeps closing: the forward formula
 * already has an inverse (`slotFromRasterParams`) that must track it, and a third copy in the CAM layer would make
 * three places to keep in step. So `regs` is an OPTIONAL argument here instead — ONE formula, two renderings.
 *
 * `regs` ABSENT is the whole existing corpus and is byte-identical BY CONSTRUCTION, not by promise: every value falls
 * to the number it always was, `y`'s sum is `y0 + (width/2)·(−cos)` where the original wrote `y0 − (width/2)·cos`
 * (negation is exact in IEEE-754, so the two are bit-identical), and the spec asserts it over a sweep.
 *
 * ⚠ THE WIDTH TERM DISAPPEARS AT A ZERO COEFFICIENT, and that is a correctness point rather than tidiness. At
 * bearing 0 the frame's `x` does not depend on the width at all (`sin 0` is exactly 0), so emitting
 * `[5+[#35/2]*0.000000000]` would make `x` a LIVE word that the atom's own `surfaceRasterLiveInputs` then reports as
 * a dialled input — a register standing where a build-time constant belongs, for a term that is not there.
 *
 * NINE DECIMALS on the coefficient: it multiplies `width/2` ONCE per coordinate with no recurrence (t1375's
 * derivation — six would do; nine costs nothing and matches the helix's constants), and at every bearing this arm can
 * actually take today the coefficient is exactly 0 or ±1 anyway.
 *
 * ⚠ AND THE GENERAL (angled) FORM IS WRITTEN EVEN THOUGH ONLY BEARING 0 CAN PACK TODAY. That is deliberate and it is
 * the advisor's t1511 condition: the packed arm's eligibility asks the ATOM'S ENVELOPE, never a bearing check of its
 * own, so when C5 teaches the atom to rotate a live frame the angled case lifts by the envelope opening — with this
 * function, and the arm that calls it, unchanged.
 *
 * ⚠ t1514 — THAT PAID OUT, and it is worth recording as a MEASUREMENT rather than as a nice outcome: C5 landed, the
 * envelope opened, and this function was not touched. The general form written "for a case that could not happen yet"
 * is the whole reason the lift cost no edit here — the alternative (writing the bearing-0 special case and reaching
 * back for the general one later) is the divergence this file's `regs` argument exists to avoid, one act earlier.
 */
export function slotRasterParams(p = {}, regs = null) {
    const tool = Math.max(0.1, num(p.tool, 6));
    const width = num(p.width, tool);
    const x0 = num(p.x0, 0), y0 = num(p.y0, 0);
    const len = Math.hypot(num(p.x1, 60) - x0, num(p.y1, 0) - y0);
    const ang = slotBearingDeg(p);
    const rad = ang * Math.PI / 180;
    const R = regs || {};
    // ONE formula: `base + (width/2)·coef`, as a build-time number or as the same sum around a live width register.
    /**
     * ⚠ t1514 — THE ZERO TEST IS ON THE **PRINTED** COEFFICIENT, AND ONLY ON THE REGISTER ARM. Two corrections in
     * one, and the second was caught by this file's own bit-identity pin rather than by reading the code:
     *
     *   1. `coef === 0` is right for `sin 0` (exactly 0 — the axis-aligned case, the only one that could pack before
     *      C5) and WRONG for `cos 90°`, which is 6.1e-17. So a CARDINAL bearing slipped past it and emitted
     *      `[10 - [#1/2] * 0.000000000]` — precisely the failure the paragraph above names: a register standing where
     *      a build-time constant belongs, for a term that is not there. C5 makes every bearing reachable, so it is
     *      closed here rather than inherited.
     *   2. ⚠ THE NUMERIC ARM MUST NOT MOVE FOR IT. The first cut rounded the coefficient for BOTH arms, which shifts
     *      the baked frame by ~4e-16 at a cardinal bearing — invisible after `r3`, and `slot-cam-pack-1512` PROOF 8
     *      asserts BIT-identity against the arithmetic this function replaced, so it went red and was right (it also
     *      turned a `-0` footprint into `0`, which `slot-repoint-domain-1498` distinguishes). The rounding decides
     *      only whether a TERM IS PRINTED; the value the numeric arm returns is the raw expression, untouched.
     */
    const frame = (base, coef) => {
        if (!R.width || Number(coef.toFixed(9)) === 0) return base + (width / 2) * coef;   // no live width, or no width term at all
        // a UNIT coefficient prints no multiply — this is the axis-aligned case, i.e. every slot that packs today, and
        // `[0 - [#1/2] * 1.000000000]` is noise in a macro an operator reads and a multiply the controller then does
        const mag = Math.abs(coef) === 1 ? '' : ` * ${Math.abs(coef).toFixed(9)}`;
        return `[${base} ${coef < 0 ? '-' : '+'} [${R.width}/2]${mag}]`;
    };
    const knob = (k, n) => (R[k] || n);   // the live register word for a knob, else the build-time number
    return {
        // the walked rect's near-edge MIDPOINT lands on A — UNROUNDED, see above
        x: frame(x0, Math.sin(rad)), y: frame(y0, -Math.cos(rad)), z0: 0,
        w: len, h: knob('width', width),
        insetAlong: 0, insetAcross: R.toolDia ? `[${R.toolDia}/2]` : tool / 2, rowAnchor: 'wall', bearing: ang,
        toolDia: knob('toolDia', tool), stepoverPct: knob('stepoverPct', num(p.stepoverPct, 40)),
        depth: knob('depth', num(p.depth, 4)), stepdown: knob('stepdown', num(p.stepdown, 1.5)),
        strategy: 'parallel', direction: 'bothways', rowAxis: 'x',
        entry: p.entry || 'plunge', rampAngle: num(p.rampAngle, 3),
        // t1500 — THE HELIX PAIR IS CARRIED THOUGH THIS ARM CAN NEVER TAKE A HELIX, and that is deliberate. The gate
        // routes every helix entry to the literal kernel, so these are unread here — but leaving them off made the
        // atom's param set INCOMPLETE against its own declaration, and the canvas round trip then materialised the
        // absent `helixPitch` as 0 where the block declares 1. A body whose params change by merely being looked at
        // is the t1319 class (absence turned into a wrong concrete value); carrying the pair costs two keys in a
        // declaration that already has fifteen and removes the reliance on "nothing can reach it".
        helixDia: num(p.helixDia, 0), helixPitch: num(p.helixPitch, 1),
        feed: knob('feed', num(p.feed, 2000)), plunge: knob('plunge', num(p.plunge, 150)), clearance: knob('clearance', num(p.clearance, 5)),
    };
}

/**
 * THE KNOBS A PACKED CAM SLOT MAKES LIVE, declared here beside the function that renders them — so the generator
 * cannot make a register for a key `slotRasterParams` does not read, and a reader sees the live set in ONE place.
 * `SLOT_CAM_PACK_DESIGN` (data/slotCapabilityArc.js) is the WHY; this is the list the code actually uses.
 *
 * `width` is here and the ENDPOINTS are not, which is the whole finding of the t1508 scout: `x`/`y` need the width
 * only as `width/2 · <baked sin>` and a baked sine is a constant, while A and B feed a bearing and a length the
 * controller cannot recompute (atan2 / hypot are V13-gated), so they bake TOGETHER WITH the frame they derive.
 */
export const SLOT_CAM_LIVE_KNOBS = ['width', 'toolDia', 'stepoverPct', 'depth', 'stepdown', 'feed', 'plunge', 'clearance'];

/** The four the packed arm BAKES, with the bearing and length they derive — never a pendant register. */
export const SLOT_CAM_BAKED_FRAME = ['ax', 'ay', 'bx', 'by'];

/**
 * ⚠ A PLACEHOLDER REGISTER MAP, AND THE REASON IT EXISTS IS A DEFECT THIS ACT ALMOST SHIPPED ─────────────────────────
 *
 * The pack's eligibility gate asks the atom's envelope "can you walk this slot?". Asked with the WIZARD's params that
 * question is about a body of pure build-time numbers — and the pack is not going to emit that body, it is going to
 * emit one whose knobs are registers. Measured: an ANGLED wide slot came back COVERED and packed, because with numbers
 * the atom absorbs its own rotation, and the arm would then have built the live shape whose bearing t1510 proved gets
 * DROPPED. The gate would have been asking about a program nobody builds — the same wrong question, one surface along.
 *
 * So the gate asks with THIS map: not real var numbers (it runs before allocation and does not need them), just words
 * `liveWordOf` reads as live, over exactly the keys `SLOT_CAM_LIVE_KNOBS` declares. DERIVED from that list rather than
 * written out, so a knob added to the live set cannot be missed by the question that decides whether it may go live.
 */
export const SLOT_CAM_PACK_REGS = SLOT_CAM_LIVE_KNOBS.reduce((a, k, i) => ({ ...a, [k]: '#' + (i + 1) }), {});

/**
 * ── THE INVERSE OF `slotRasterParams`, for reading a re-pointed slot back OUT of its atom (t1500) ─────────────────
 *
 * The reverse-sync (Blocks → the wizard form) has to answer "what slot is this?" from a block that no longer says
 * `slot` anywhere. ⚠ THIS IS READING A DECLARATION BACKWARDS, NOT INFERRING INTENT FROM OUTPUT — every line below is
 * the algebraic inverse of the line above it in `slotRasterParams`, which is the distinction t1406 drew when pocket
 * needed the same thing (`pocketWallOffsetFromInset`). Derive it from the emitted G-code instead and the reader
 * becomes a parser of its own output, which is the failure mode this project keeps closing.
 *
 *     forward:  x = x0 + (width/2)·sin(bearing)   ·   y = y0 − (width/2)·cos(bearing)   ·   w = |B−A|   ·   h = width
 *     inverse:  x0 = x − (width/2)·sin(bearing)   ·   y0 = y + (width/2)·cos(bearing)   ·   B = A + w·(cos,sin)
 *
 * The tool comes back from `insetAcross` (which the forward direction set to tool/2) — the one socket that carries
 * it, since the atom's `toolDia` and the slot's are the same number by construction and the inset is what the walk
 * actually rides. Asserted round-trip-exact against the forward function in tests/slot-twin-repoint-1500.spec.js.
 */
export function slotFromRasterParams(a = {}) {
    const width = num(a.h, 6);
    const ang = num(a.bearing, 0), rad = ang * Math.PI / 180;
    const x0 = num(a.x, 0) - (width / 2) * Math.sin(rad);
    const y0 = num(a.y, 0) + (width / 2) * Math.cos(rad);
    const len = num(a.w, 60);
    return {
        x0, y0, x1: x0 + len * Math.cos(rad), y1: y0 + len * Math.sin(rad),
        width, tool: num(a.insetAcross, num(a.toolDia, 6) / 2) * 2,
        stepoverPct: num(a.stepoverPct, 40), depth: num(a.depth, 4), stepdown: num(a.stepdown, 1.5),
        entry: a.entry || 'plunge', rampAngle: num(a.rampAngle, 3),
        helixDia: num(a.helixDia, 0), helixPitch: num(a.helixPitch, 1),
        feed: num(a.feed, 2000), plunge: num(a.plunge, 150), clearance: num(a.clearance, 5),
    };
}

/**
 * '' when THIS slot's clearing rides `surfaceraster`, else the REASON it keeps its literal kernel — never a bare
 * false, and every clause a NARROWING. The discipline is t1402/t1406's: the question is not "will something run",
 * it is "will what runs be what was ASKED for". Where the answer is no the slot emits exactly what it always has.
 */
/**
 * `regs` (t1512) — the OPTIONAL register map the caller will actually EMIT with. The clauses below are all about the
 * slot's own geometry and read the numbers either way; only the final question — the atom's own envelope — depends on
 * the rendering, and it must be asked about the body that will really be built. The wizard passes nothing and is
 * unchanged; the CAM pack passes `SLOT_CAM_PACK_REGS`, which is what makes an angled slot refuse there and not here.
 */
export function slotRasterArmGap(p = {}, regs = null) {
    const tool = Math.max(0.1, num(p.tool, 6));
    const width = num(p.width, tool);
    // The too-small law is untouched by all of this: it refuses with NO MOTION, so there is no walk to re-point.
    if (slotTooSmall({ ...p, tool, width })) return 'a slot narrower than its tool refuses with no motion at all (t1444), so there is no clearing walk to re-point';
    const len = Math.hypot(num(p.x1, 60) - num(p.x0, 0), num(p.y1, 0) - num(p.y0, 0));
    if (len < 1e-6) return 'a zero-length slot is a single plunged hole, not a walk';
    /**
     * ⚠ THE ZERO BAND, which the arc's own C1 row recorded and which would otherwise surface a REFUSAL where a pass
     * belongs. At width == tool the band the tool centre must sweep is zero: the slot kernel cuts ONE centreline
     * pass, and the atom — handed a span that its two insets collapse to nothing — refuses through its collapsed-
     * inset guard and emits no motion at all (measured: 0 cut moves against the kernel's 4). So this width routes to
     * the literal arm, and it is the FIRST thing checked after the degenerates for that reason.
     */
    if (width - tool < 1e-6) return 'a slot exactly its tool\'s width has a ZERO band — the kernel cuts one centreline pass, and the atom refuses a span its insets collapse to nothing (its collapsed-inset guard), emitting no motion at all';
    const entry = String(p.entry || 'plunge');
    if (entry === 'helix') return SLOT_HELIX_GAP;
    // t1506 — THE RAMP CLAUSE IS GONE, not disabled. It refused a partial last bite because this kernel ramped the
    // ACTUAL remaining drop where the atom ramped a nominal stepdown; the kernel now uses the nominal floor the rest
    // of the family already used, so the two agree at every bite and there is no divergence left to gate on. The
    // wizard's OWN DEFAULTS (depth 4 @ stepdown 1.5, ramp) pass here now — see the retirement note above `slotPath`.
    // …and finally the atom's OWN envelope, asked in its own words, so this gate can never claim a coverage the
    // atom does not declare (the pocket asks the identical question at the identical point).
    const probe = slotRasterParams(p, regs);
    return surfaceRasterCovers(probe) ? '' : surfaceRasterGap(probe);
}

/** Does this slot's clearing ride the parametric atom? (The predicate half of slotRasterArmGap — one source.) */
export function slotRidesRaster(p = {}) { return slotRasterArmGap(p) === ''; }

export const slotBlock = {
    type: 'slot', label: 'Slot', kind: 'leaf', category: 'Toolpaths',
    defaults: { x0: 0, y0: 0, x1: 60, y1: 0, width: 6, tool: 6, stepoverPct: 40, depth: 4, stepdown: 1.5, entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1, feed: 2000, plunge: 150, clearance: 5 },
    fields: ['x0', 'y0', 'x1', 'y1', 'width', 'tool', 'stepoverPct', 'depth', 'stepdown', 'entry', 'rampAngle', 'helixDia', 'helixPitch', 'feed', 'plunge', 'clearance'],
    allFields: ['x0', 'y0', 'x1', 'y1', 'width', 'tool', 'stepoverPct', 'depth', 'stepdown', 'entry', 'rampAngle', 'helixDia', 'helixPitch', 'feed', 'plunge', 'clearance'],
    // t2403 (BACKLOG #48 item 5) — `rampAngle` only means anything for `entry:'ramp'` (read at line ~74's own
    // `entryOrPlunge` call), `helixDia`/`helixPitch` only for `entry:'helix'` — every other entry showed all 3
    // regardless, the same dead-field shape t2393/t2399 already fixed elsewhere on this family.
    dynamic: 'entry',
    fieldsFor(p) {
        const entry = (p && p.entry) || 'plunge';
        const f = ['x0', 'y0', 'x1', 'y1', 'width', 'tool', 'stepoverPct', 'depth', 'stepdown', 'entry'];
        if (entry === 'ramp') f.push('rampAngle');
        else if (entry === 'helix') f.push('helixDia', 'helixPitch');
        f.push('feed', 'plunge', 'clearance');
        return f;
    },
    emit: (p, dx = 0, dy = 0) => slotPath({
        ...p,
        x0: num(p.x0, 0) + dx, y0: num(p.y0, 0) + dy,
        x1: num(p.x1, 60) + dx, y1: num(p.y1, 0) + dy,
    }),
    // Declared footprint = the A↔B centreline widened by the cut width (== slotWizard's slotBBox). So the place fold's
    // liveExtent recomputes the placement bbox from LIVE leaf params (one source of truth) instead of a frozen snapshot
    // — makes stock-attach track the geometry, and lets an enclosing Array compose the pattern footprint. (See drill/array.)
    extent: (p) => {
        const x0 = num(p.x0, 0), y0 = num(p.y0, 0), x1 = num(p.x1, 60), y1 = num(p.y1, 0);
        // t1444 — the width clamp is gone from here too. It was a no-op for every slot that still cuts (width ≥ tool)
        // and a LIE for the one that no longer does: a 6.35mm slot refused by the emit was still declaring a 12.7mm
        // footprint to the placement fold. Same clamp, same class, three copies — this one, `slotBBox` and `slotView`.
        const tool = Math.max(0.1, num(p.tool, 6)), W = num(p.width, tool);
        const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
        const px = (-dy / len) * (W / 2), py = (dx / len) * (W / 2);
        return pointsBBox([{ x: x0 + px, y: y0 + py }, { x: x0 - px, y: y0 - py }, { x: x1 + px, y: y1 + py }, { x: x1 - px, y: y1 - py }]);
    },
};
