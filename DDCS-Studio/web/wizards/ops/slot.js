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
    const levels = depthLevels(depth, num(p.stepdown, 1.5));
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    const L = [];   // program-level clearance is provided by the enclosing program (emitMapped header)

    if (len < 1e-6) {     // A == B → just a plunged hole
        L.push('( zero-length slot — single plunge )');
        for (const d of levels) L.push(`G0 X${r3(x0)} Y${r3(y0)}`, `G1 Z${r3(-d)} F${plunge}`, `G0 Z${clr}`);
        return L;
    }

    const nx = -dy / len, ny = dx / len;        // perpendicular (left of A→B)
    const band = Math.max(0, width - tool);     // width the tool centre must sweep
    const offs = [];
    if (band < 1e-6) offs.push(0);
    else { const half = band / 2; for (let o = -half; o < half - 1e-6; o += so) offs.push(o); offs.push(half); }

    // t842 — DEPTH ENTRY: ramp runs along the slot LENGTH (the pass direction, not toward-centre); a helix must fit the
    // slot WIDTH (helix + tool ≤ width/2) — a tool-width slot degrades to plunge with a why. Plunge (default) = byte-identical.
    const entry = p.entry || 'plunge';
    const wantR = num(p.helixDia, 0) > 0 ? num(p.helixDia, 0) / 2 : tool / 2;
    const helixMaxR = width / 2 - tool / 2, helixR = Math.max(0.2, Math.min(wantR, helixMaxR));
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
        prevD = d;
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
 * Is the LAST depth level a FULL bite? The ramp's divergence turns on exactly this, and nothing else (measured below).
 *
 * `depthLevels` clamps its final level to the total depth, so a depth that is not a whole multiple of the stepdown
 * ends on a PARTIAL bite — 4mm at 1.5 gives 1.5 / 3.0 / 4.0, a last drop of 1.0.
 */
function slotLastBiteIsFull(p = {}) {
    const stepdown = Math.max(0.01, num(p.stepdown, 1.5));
    const lv = depthLevels(num(p.depth, 4), stepdown);
    const last = lv.length > 1 ? lv[lv.length - 1] - lv[lv.length - 2] : lv[0];
    return Math.abs(last - stepdown) < 1e-9;
}

/**
 * ⚠ THE THIRD GATE, MEASURED THIS TURN AND NOT IN THE ARC'S INVENTORY — A RAMP OVER A PARTIAL LAST BITE ───────────
 *
 * The arc named two things that keep the slot literal (a dialled bearing, the helix's entry-end clamp). There is a
 * THIRD, it is not trig, and it is not a capability the atom lacks — it is a genuine behavioural difference in the
 * descent that only appears when the last level is a partial bite:
 *
 *     the slot kernel   ramps the ACTUAL drop      — `entryOrPlunge` gets prevZ and z, so a 1.0mm last bite ramps
 *                                                    1.0mm at the asked angle: a 19.08mm run at 3 degrees
 *     the atom          ramps a NOMINAL stepdown   — its run is one full `stepdown`: 28.62mm at 3 degrees
 *
 * MEASURED, on the frozen kernel, across widths x bearings x stepovers x depths: EVERY divergence outside the zero
 * band is `entry:'ramp'` with a partial last bite, and EVERY ramp config with a partial last bite diverges — no
 * false positives and no false negatives on the whole sweep. The size is exactly the run the two disagree about,
 * `(stepdown − lastBite) / tan(rampAngle)`, projected on the slot's bearing:
 *
 *     depth 4  @ 1.5  (last bite 1.0)   9.540mm      depth 3.5 @ 0.8 (last 0.3)   9.541mm
 *     depth 5  @ 1.5  (last bite 0.5)  19.080mm      depth 7   @ 2.5 (last 2.0)   9.541mm
 *     …and at a bearing: 9.540 · cos30 = 8.262, · cos45 = 6.746 — the same run, turned.
 *
 * ⚠ AND THE SHIPPED DEFAULTS LAND IN IT: the slot wizard defaults to depth 4 / stepdown 1.5, so the DEFAULT slot
 * with a ramp entry is precisely the diverging case. That is why this is routed rather than rounded past — a 9.5mm
 * error in where a ramp enters the material is not a quantum, it is a different descent.
 *
 * IT IS THE ATOM'S RAMP THAT WOULD HAVE TO MOVE, AND IT IS **NOT** MOVED HERE. Teaching the atom to ramp the real
 * remaining drop is arguably the more correct reading — but that atom is SHARED, and every surfacing and pocket
 * program in the corpus rides its ramp. Changing it under cover of the slot's re-point is exactly the silent
 * behaviour move this whole arc is built to prevent, so the slot narrows and the atom is left alone. Lifting it is
 * its own act, with its own bridge, on the ops that own it.
 */
export const SLOT_RAMP_PARTIAL_GAP = 'a RAMP entry over a PARTIAL last depth level: the slot kernel ramps the ACTUAL '
    + 'remaining drop (a 1.0mm last bite ramps 1.0mm — a 19.08mm run at 3 degrees) and the shared raster atom ramps a '
    + 'NOMINAL full stepdown (28.62mm), so the descent enters the material somewhere else entirely — measured at '
    + '(stepdown - lastBite)/tan(rampAngle), 9.54mm on the wizard\'s OWN defaults (depth 4 at stepdown 1.5), turned by '
    + 'the bearing. Every ramp config with a partial last bite diverges and no other config does. The atom\'s ramp is '
    + 'SHARED with surfacing and every pocket, so it is not moved to suit the slot; this slot stays literal instead';

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
export function slotRasterParams(p = {}) {
    const tool = Math.max(0.1, num(p.tool, 6));
    const width = num(p.width, tool);
    const x0 = num(p.x0, 0), y0 = num(p.y0, 0);
    const len = Math.hypot(num(p.x1, 60) - x0, num(p.y1, 0) - y0);
    const ang = slotBearingDeg(p);
    const rad = ang * Math.PI / 180;
    return {
        // the walked rect's near-edge MIDPOINT lands on A — UNROUNDED, see above
        x: x0 + (width / 2) * Math.sin(rad), y: y0 - (width / 2) * Math.cos(rad), z0: 0,
        w: len, h: width,
        insetAlong: 0, insetAcross: tool / 2, rowAnchor: 'wall', bearing: ang,
        toolDia: tool, stepoverPct: num(p.stepoverPct, 40),
        depth: num(p.depth, 4), stepdown: num(p.stepdown, 1.5),
        strategy: 'parallel', direction: 'bothways', rowAxis: 'x',
        entry: p.entry || 'plunge', rampAngle: num(p.rampAngle, 3),
        feed: num(p.feed, 2000), plunge: num(p.plunge, 150), clearance: num(p.clearance, 5),
    };
}

/**
 * '' when THIS slot's clearing rides `surfaceraster`, else the REASON it keeps its literal kernel — never a bare
 * false, and every clause a NARROWING. The discipline is t1402/t1406's: the question is not "will something run",
 * it is "will what runs be what was ASKED for". Where the answer is no the slot emits exactly what it always has.
 */
export function slotRasterArmGap(p = {}) {
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
    if (entry === 'ramp' && !slotLastBiteIsFull(p)) return SLOT_RAMP_PARTIAL_GAP;
    // …and finally the atom's OWN envelope, asked in its own words, so this gate can never claim a coverage the
    // atom does not declare (the pocket asks the identical question at the identical point).
    const probe = slotRasterParams(p);
    return surfaceRasterCovers(probe) ? '' : surfaceRasterGap(probe);
}

/** Does this slot's clearing ride the parametric atom? (The predicate half of slotRasterArmGap — one source.) */
export function slotRidesRaster(p = {}) { return slotRasterArmGap(p) === ''; }

export const slotBlock = {
    type: 'slot', label: 'Slot', kind: 'leaf', category: 'Toolpaths',
    defaults: { x0: 0, y0: 0, x1: 60, y1: 0, width: 6, tool: 6, stepoverPct: 40, depth: 4, stepdown: 1.5, entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1, feed: 2000, plunge: 150, clearance: 5 },
    fields: ['x0', 'y0', 'x1', 'y1', 'width', 'tool', 'stepoverPct', 'depth', 'stepdown', 'entry', 'rampAngle', 'helixDia', 'helixPitch', 'feed', 'plunge', 'clearance'],
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
