/**
 * tests/support/rampRelationship.js — THE RAMP RELATIONSHIP, DECLARED ONCE (t1487; ruled at t1486).
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────────────────────────────────────────────
 * Every ramp bridge in this corpus was proved MOVE FOR MOVE against the literal kernel, whose ramp runs toward the
 * area CENTRE. C4 (t1483/t1485) gives the ramp a DECLARED RUN VECTOR — it runs along the row instead — because the
 * centre-ward ramp had to bake a hypotenuse and SQRT is unverified on this controller (t1339). So those bridges
 * compare a path against a reference that deliberately no longer describes it.
 *
 * ⚠ THE RULING (t1486) IS **RESTATE, NEVER RETIRE**, and it has a uniform precedent in this project: t1391 restated
 * the drill bridges around the R-plane, t1406 restated the pocket bridges per PHASE. Coverage is never dropped to
 * make a change land — the CRITERION is restated and the row keeps its key. That is why this is a shared module and
 * not fifteen edited assertions: the criterion is ONE idea, and fifteen hand-rolled copies of it would drift the
 * moment the next descent act touches one of them.
 *
 * ── WHAT THE RELATIONSHIP IS ───────────────────────────────────────────────────────────────────────────────────────
 * OUTSIDE the descent nothing moved — the walk is identical, move for move, and each spec keeps asserting that with
 * its OWN comparator (t1404's exactness, t1406's per-phase quantum). This module does not touch that: it only takes
 * the descent OUT, so what each spec already asserts is asserted over what is genuinely unchanged.
 *
 * INSIDE the descent the two ramps are the same ramp pointed a different way, and that is measurable rather than
 * asserted. Measured on `concentric × ramp` at t1487, both sides, 100×60 Ø12 @60%:
 *
 *     literal      (0,0,0) → (8.181, 4.909, −0.5)      toward the centre — run √(8.181²+4.909²) = 9.540
 *     parametric   (0,0,0) → (9.540, 0.000, −0.5)      along the row      — run                  = 9.540
 *
 * SAME START · SAME DROP · SAME RUN LENGTH · SAME FEED · RETURNS TO THE SAME POINT. The run length is the whole
 * angle claim: the run is `drop / tan(angle)` on both sides, so equal drop with equal run IS equal angle — asserted
 * as the quantity the operator set rather than as a direction that was never the point.
 */

/** The emit's own quantum, one unit of the 0.001mm rounding, with the slack t1406 measured for a macro-evaluated expression. */
export const QUANTUM = 0.0015;

/**
 * THE DECLARED PROPERTIES — data, so a reader (or the next descent act) finds the criterion without reading five
 * specs, and so the one property this module cannot see says WHERE it is asserted rather than going unmentioned.
 */
export const RAMP_RELATIONSHIP = [
    { key: 'walk', says: 'OUTSIDE the descent the toolpath is unchanged, move for move — each spec keeps its own comparator for this' },
    { key: 'count', says: 'the same NUMBER of ramping moves as the literal — the t1402 defect stated in its own terms (a lost descent reads as 0)' },
    { key: 'start', says: 'the descent starts where the literal starts it: the row start / the ring corner, on the LIVE row register (t1485)' },
    { key: 'drop', says: 'the same total drop — the level bite, descended while running' },
    { key: 'run', says: 'the same run LENGTH, which is the ANGLE honoured: the run is drop/tan(angle) on both sides' },
    { key: 'feed', says: 'the same cutting feed' },
    { key: 'return', says: 'it comes back to the point it started from, at depth, so the row cuts from where it always did' },
    { key: 'inside', says: 'the run stays inside the material the literal walks — the mirror is what makes this worth asserting (t1485 traced it 28.6mm OUTSIDE the stock before the fix)' },
    { key: 'degrade', says: 'when the run does not fit, it plunges and SAYS so — a text property, asserted at its home in ramp-run-vector-1483 BRIDGE B/F' },
];

const near = (a, b, tol = QUANTUM) => Math.abs(a - b) <= tol;
const hyp = (r) => Math.hypot(r[3] - r[0], r[4] - r[1]);

/** A RAMPING move: it cuts, it changes Z, and it moves in XY. A straight plunge changes Z with no XY, so this counts
 *  exactly the thing the t1402 defect destroyed rather than counting moves in general. */
export const isRampMove = (r) => Math.abs(r[5] - r[2]) > 1e-6 && (Math.abs(r[3] - r[0]) > 1e-6 || Math.abs(r[4] - r[1]) > 1e-6);

/**
 * Split a cut list into the ramp DESCENT and the WALK around it.
 *
 * The return move is found by what it DOES — it starts where the ramping move ended and ends where it began, at one
 * Z — rather than by sitting next to it. Two of these lists arrive SORTED (t1406's coarse key), so adjacency is not
 * available and an index-based split would silently take the wrong move on exactly those two specs.
 *
 * @param rows  array of moves
 * @param at    reader for a spec whose entries are wrapped (t1406 carries `{v, t}`); defaults to identity
 */
export function splitRampDescent(rows, at = (r) => r) {
    /**
     * ⚠ THE PAIRING TAKES Z, and that is not belt-and-braces: a multi-level program ramps from the SAME XY on every
     * level, so an XY-only match hands level 2's ramp the level-1 return and then reports a depth error. Caught by
     * running this module against `many levels` before any spec was wired to it.
     */
    const undoes = (r, m) => Math.abs(r[5] - r[2]) < 1e-6            // the return is flat: it is already at depth
        && near(r[2], m[5], 1e-6)                                     // …at the depth THIS ramp reached
        && near(r[0], m[3], 1e-6) && near(r[1], m[4], 1e-6)           // …starting where it ended
        && near(r[3], m[0], 1e-6) && near(r[4], m[1], 1e-6);          // …and ending where it began
    const ramps = [], returns = [];
    rows.forEach((row, i) => { if (isRampMove(at(row))) ramps.push(i); });
    rows.forEach((row, i) => {
        if (ramps.includes(i)) return;
        if (ramps.some((j) => undoes(at(row), at(rows[j])))) returns.push(i);
    });
    const taken = new Set([...ramps, ...returns]);
    return {
        // the descent's POSITIONS as well as its moves — a comparator that walks two lists by index (the rotation
        // bridge does, because a rotation is checked per move against an exact one) needs to know what to skip.
        indices: [...taken].sort((a, b) => a - b),
        descent: [...taken].sort((a, b) => a - b).map((i) => rows[i]),
        walk: rows.filter((_, i) => !taken.has(i)),
        pairs: ramps.map((j) => ({ ramp: rows[j], back: rows[returns.find((k) => undoes(at(rows[k]), at(rows[j])))] })),
    };
}

/**
 * THE RELATIONSHIP ITSELF — the parametric descent against the literal one, property by property.
 * Returns { ok, why, checked } so a failing bridge names WHICH property broke, not "the arrays differ".
 *
 * @param bbox  the literal path's XY bounding box, for the `inside` property: {minX,maxX,minY,maxY}
 */
export function rampDescentRelationship(lit, par, { at = (r) => r, bbox = null, actualDrop = false } = {}) {
    const L = splitRampDescent(lit, at), P = splitRampDescent(par, at);
    const checked = [];
    const fail = (why) => ({ ok: false, why, checked });

    if (L.pairs.length === 0) return fail('the LITERAL does not ramp on this config, so it proves nothing — check the config, not the code');
    if (P.pairs.length !== L.pairs.length) return fail(`count: the parametric ramps ${P.pairs.length} time(s), the literal ${L.pairs.length} — a lost descent is the t1402 defect`);
    checked.push('count');

    let deepened = 0;
    for (let i = 0; i < L.pairs.length; i++) {
        const a = at(L.pairs[i].ramp), b = at(P.pairs[i].ramp);
        /**
         * ── ⚠ t1524 — THE DECLARED DIVERGENCE: the reference ramps a NOMINAL bite, the live path the ACTUAL drop ──
         *
         * These bridges compare the live path against FROZEN literal references (`literalPocketFill.js` and friends),
         * captured before t1524 moved the family's descent onto the drop that is actually left. On a CLAMPED final
         * level the frozen side still starts its ramp `(stepdown − lastBite)` ABOVE the true floor and descends a
         * whole bite; the live side starts on the real floor and descends only what remains. So `start`, `drop` and
         * `run` legitimately differ — on that level and nowhere else.
         *
         * IT IS NOT A RELAXATION, and the shape is asserted in BOTH directions:
         *   · the XY start is still EXACT (the ramp did not move across the part);
         *   · the live start is at or BELOW the reference's, NEVER above — the direction that can only cut less;
         *   · both descents END at the SAME point, which is the safety-relevant property;
         *   · and run/drop is preserved, which IS the angle claim — the operator's declared angle is untouched, only
         *     the length it is applied over changed.
         * The caller passes `actualDrop: true` to declare it expects this, and gets `deepened` back so it can assert
         * the divergence really occurred (a bridge that never reaches a clamped level would otherwise pass silently).
         */
        if (!near(a[0], b[0]) || !near(a[1], b[1])) return fail(`start: descent ${i} begins at XY (${b[0]}, ${b[1]}) — the literal at (${a[0]}, ${a[1]})`);
        const startMoved = !near(a[2], b[2]);
        if (startMoved && !actualDrop) return fail(`start: descent ${i} begins at (${b[0]}, ${b[1]}, ${b[2]}) — the literal starts it at (${a[0]}, ${a[1]}, ${a[2]})`);
        if (startMoved) {
            if (b[2] > a[2] + QUANTUM) return fail(`start: descent ${i} begins ABOVE the reference (Z${b[2]} vs Z${a[2]}) — the actual floor can only be at or below the nominal one`);
            if (!near(a[5], b[5])) return fail(`end: descent ${i} ends at Z${b[5]}, the reference at Z${a[5]} — both must reach the SAME level floor`);
            const ra = hyp(a) / (a[2] - a[5]), rb = hyp(b) / (b[2] - b[5]);
            if (!near(ra, rb, 1e-3)) return fail(`angle: descent ${i} runs ${rb.toFixed(4)} per mm of drop, the reference ${ra.toFixed(4)} — the declared ANGLE must survive even where the drop does not`);
            deepened++;
        } else {
            // the floors coincide (a whole bite), so the ORIGINAL equalities must hold exactly, declaration or not
            if (!near(a[2] - a[5], b[2] - b[5])) return fail(`drop: descent ${i} drops ${(b[2] - b[5]).toFixed(3)}mm, the literal ${(a[2] - a[5]).toFixed(3)}mm`);
            if (!near(hyp(a), hyp(b))) return fail(`run: descent ${i} runs ${hyp(b).toFixed(3)}mm, the literal ${hyp(a).toFixed(3)}mm — same drop and same run IS the same angle, so this is the angle claim`);
        }
        // …and the feed, the return and the bbox are checked on EVERY descent either way. A declared divergence in the
        // starting floor is no reason to stop asking whether the tool comes back to where the row expects it.
        if (!near(a[6], b[6])) return fail(`feed: descent ${i} cuts at F${b[6]}, the literal at F${a[6]}`);

        const back = P.pairs[i].back && at(P.pairs[i].back);
        if (!back) return fail(`return: descent ${i} never comes back to its start — the row would then cut from the wrong place`);
        if (!near(back[3], b[0]) || !near(back[4], b[1])) return fail(`return: descent ${i} comes back to (${back[3]}, ${back[4]}), not to its start (${b[0]}, ${b[1]})`);
        if (!near(back[5], b[5])) return fail(`return: descent ${i} returns at Z${back[5]}, not at the depth it reached (Z${b[5]})`);

        if (bbox) for (const [x, y] of [[b[0], b[1]], [b[3], b[4]]]) {
            if (x < bbox.minX - QUANTUM || x > bbox.maxX + QUANTUM || y < bbox.minY - QUANTUM || y > bbox.maxY + QUANTUM)
                return fail(`inside: descent ${i} reaches (${x}, ${y}), outside the material the literal walks (${bbox.minX}..${bbox.maxX}, ${bbox.minY}..${bbox.maxY})`);
        }
    }
    checked.push('start', 'drop', 'run', 'feed', 'return');
    if (bbox) checked.push('inside');
    if (actualDrop) checked.push('actual-drop');
    // `deepened` = how many descents took the DECLARED divergence (a clamped final level). The caller asserts on it,
    // so a bridge that never reaches one cannot quietly pass under an allowance it never needed.
    return { ok: true, why: '', checked, deepened };
}

/** The XY box a cut list covers — the material the literal actually walks, for the `inside` property. */
export function cutBox(rows, at = (r) => r) {
    const t = rows.map(at);
    if (!t.length) return null;
    return {
        minX: +Math.min(...t.map((r) => Math.min(r[0], r[3]))).toFixed(3), maxX: +Math.max(...t.map((r) => Math.max(r[0], r[3]))).toFixed(3),
        minY: +Math.min(...t.map((r) => Math.min(r[1], r[4]))).toFixed(3), maxY: +Math.max(...t.map((r) => Math.max(r[1], r[4]))).toFixed(3),
    };
}
