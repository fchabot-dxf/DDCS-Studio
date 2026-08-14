import { test, expect } from '@playwright/test';

/**
 * t1772 — MAKE THE PICTURE CHECKABLE. Markers are DECLARED (opSimStarts); the traced path comes from actually
 * EXECUTING the emitted G-code (engine/trace.js). Nothing compared them — a snapshot only proves "the picture
 * looks like a stored snapshot," which can't tell a genuine single source from a copy that currently agrees.
 * This asserts every CHECKABLE marker corresponds to somewhere the REAL emitted G-code actually goes.
 *
 * CORRECTED at t1852→t1856 (see WORK-LOG) — TWO separate defects in the ORIGINAL comparison
 * (`declared[p]` vs `markerWorldOf(declared, passEnds, p)`), found while fixing the first:
 *
 *   1. For an `anchorsAtPrev` pass (a reposition DESTINATION — corner's wall 2), `markerWorldOf` reconciles the
 *      declared row to `passEnds[p-1] + (declared[p] − declared[p-1])` — the REAL runtime end of the previous
 *      pass, shifted by the wizard's own programmed dogleg. `declared[p]` itself is computed by `opSimStarts`
 *      from a fixed fractional-stock anchor (`cornerData.js`'s `cornerSimStartsProvider`), with ZERO dependency
 *      on where the previous pass's probe actually contacts material — which is PHYSICALLY UNKNOWABLE before
 *      the probe fires. Comparing these two asserted a PLACEHOLDER equals a MEASUREMENT: impossible by
 *      construction, not a defect in the app (t1854's own diagnosis, confirmed against the emitted G-code's own
 *      incremental reposition math: `G0 X#23; G0 Y#24` applied from the previous pass's real runtime end lands
 *      EXACTLY on the reconciled value, not the declared one).
 *
 *   2. For EVERY OTHER pass — not `anchorsAtPrev`, not `pinned` — `markerWorldOf` degenerates to `return row`,
 *      the SAME object as `declared[p]`. `passAnchorFor` (the sibling function the LIVE engine uses to anchor
 *      that pass's own local motion frame) degenerates the SAME way for the SAME reason: a non-anchorsAtPrev
 *      pass is a MANUAL reposition — the OPERATOR physically moves the tool there by hand, so there is no
 *      accompanying G-code move to check it against at all. `declared[p]` is, BY NECESSITY not by oversight,
 *      the sole source of truth for these passes — the same footing pass 0 has. Comparing `declared[p]` to
 *      `markerWorldOf(declared[p])` (or, an earlier draft of this fix, to a "ground truth" derived via
 *      `passAnchorFor`) was comparing a value to ITSELF either way: `dist(...)` was always exactly 0, so this
 *      branch of the check could never fail, for any op, ever. Confirmed empirically against a REAL op
 *      (`user_rotary_clock_data`'s own pass 1, `anchorsAtPrev: false`): a "ground truth via segments" draft of
 *      this fix flagged it as a fabricated failure ("no real motion for this pass"), which is the SAME class of
 *      false positive — that pass IS operator-jogged, there genuinely is no G-code move to verify it against.
 *
 * THE FIX: the check applies ONLY to `anchorsAtPrev` passes — the ONE case where a genuinely independent ground
 * truth exists (a programmed G-code move connects this pass to the previous one). For those, it asserts the
 * CLAIMED marker (`markerWorldOf`'s own reconciled output) is a position the REAL TRACED ROUTE actually reaches
 * (converted from each segment's pass-local frame to world coordinates via `passAnchorFor`, the SAME anchor the
 * live engine uses) — not "does declared match rendered" (impossible), but "does the emitted G-code's own real
 * execution actually reach the position the app claims." Every other pass is EXCLUDED, by name, with this exact
 * reason, so the next reader does not re-add the impossible/vacuous assertion thinking they found a regression.
 * Proven capable of failing on synthetic data (`the check can catch a REAL drift`, below) before trusting it.
 *
 * EXCLUDED, deliberately, not silently: any twin where `opSimStarts` returns null/empty (nothing DECLARED to
 * compare), fewer than 2 passes (nothing to check against a "previous" pass), whose emitted G-code produces no
 * traceable motion (a preview-only visual with no G-code behind it), OR — per the fix above — any INDIVIDUAL
 * pass that is not `anchorsAtPrev` (a manual/operator-jog reposition — the declared value IS the truth, by
 * construction, no G-code move exists to verify it against). The excluded lists are reported explicitly (see
 * the console output), not swept away.
 */

const TOLERANCE_MM = 3;

test.use({ viewport: { width: 1400, height: 1000 } });

test('THE PICTURE IS CHECKABLE: every anchorsAtPrev marker sits somewhere the REAL emitted G-code actually goes', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsEditWizardDef, null, { timeout: 60000 });

    const result = await page.evaluate(async (TOL) => {
        const U = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const { markerWorldOf } = await import('/viz/markerWorld.js');
        const { passAnchorFor } = await import('/engine/passAnchor.js');

        const STOCK = { x: 100, y: 80, z: 20 };
        const dist = (a, b) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));

        // GROUND TRUTH, for an anchorsAtPrev pass ONLY: does any segment of pass p's own motion (converted to
        // world coords via the SAME pass-anchor the live engine uses) come within `tol` of `target`?
        function touchesGroundTruth(segments, starts, passEnds, p, target, tol) {
            const anchor = passAnchorFor(starts, passEnds, p) || { x: 0, y: 0, z: 0 };
            let best = Infinity;
            for (const s of segments) {
                if (s.pass !== p) continue;
                const w1 = { x: anchor.x + s.x1, y: anchor.y + s.y1 };
                const w2 = { x: anchor.x + s.x2, y: anchor.y + s.y2 };
                best = Math.min(best, dist(w1, target), dist(w2, target));
                if (best <= tol) return { touched: true, nearestMm: +best.toFixed(2) };
            }
            return { touched: false, nearestMm: Number.isFinite(best) ? +best.toFixed(2) : null };
        }

        const excluded = [];
        const excludedPasses = [];
        const checked = [];
        const failed = [];

        for (const s of U.listUserOps()) {
            const opType = s.opType;
            const def = U.getUserDef(opType);
            if (!def) { excluded.push({ opType, why: 'no def' }); continue; }
            const params = U.defaultParams(def);

            let declared;
            try { declared = opSimStarts(opType, params, STOCK); }
            catch (e) { excluded.push({ opType, why: 'opSimStarts threw: ' + e.message }); continue; }
            if (!declared || declared.length < 2) { excluded.push({ opType, why: `opSimStarts returned ${declared ? declared.length : 'null'} pass(es) — nothing to check against a previous pass` }); continue; }

            const build = builderOf(opType);
            if (!build) { excluded.push({ opType, why: 'no builder' }); continue; }
            let gcode;
            try {
                const stack = build(params);
                gcode = emitMapped(stack, {}).text;
            } catch (e) { excluded.push({ opType, why: 'build/emit threw: ' + e.message }); continue; }
            if (!gcode || !gcode.trim()) { excluded.push({ opType, why: 'empty emit — a preview-only visual with no G-code behind it' }); continue; }

            let traced;
            try {
                const start = { x: declared[0].x, y: declared[0].y, z: declared[0].z };
                traced = traceToolpath(gcode, { stock: STOCK, start, passStarts: declared });
            } catch (e) { excluded.push({ opType, why: 'trace threw: ' + e.message }); continue; }
            if (!traced.segments || !traced.segments.length) { excluded.push({ opType, why: 'trace produced no motion segments' }); continue; }
            if (!traced.passEnds || !traced.passEnds.length) { excluded.push({ opType, why: 'trace published no per-pass runtime ends (opSimStarts declares passes this op\'s own G-code never reposition-marks)' }); continue; }

            let sawAny = false;
            for (let p = 1; p < declared.length; p++) {
                if (!declared[p].anchorsAtPrev) {
                    excludedPasses.push({ opType, pass: p, why: 'not anchorsAtPrev — a manual/operator-jog reposition; the declared value IS the truth, no G-code move connects it to the previous pass' });
                    continue;
                }
                sawAny = true;
                const claimed = markerWorldOf(declared, traced.passEnds, p);
                const check = touchesGroundTruth(traced.segments, declared, traced.passEnds, p, claimed, TOL);
                if (!check.touched) {
                    failed.push({
                        opType, pass: p,
                        claimed: { x: +claimed.x.toFixed(2), y: +claimed.y.toFixed(2) },
                        nearestSegmentMm: check.nearestMm,
                    });
                }
            }
            if (sawAny) checked.push(opType);
        }
        return { excluded, excludedPasses, checked, failed };
    }, TOLERANCE_MM);

    console.log(`CHECKED (${result.checked.length}): ${result.checked.join(', ')}`);
    console.log(`EXCLUDED OPS (${result.excluded.length}):\n` + result.excluded.map((e) => `  ${e.opType}: ${e.why}`).join('\n'));
    console.log(`EXCLUDED PASSES (${result.excludedPasses.length}):\n` + result.excludedPasses.map((e) => `  ${e.opType} pass ${e.pass}: ${e.why}`).join('\n'));
    console.log(`FAILED (${result.failed.length}):\n` + result.failed.map((f) =>
        `  ${f.opType} pass ${f.pass}: claimed marker (${f.claimed.x},${f.claimed.y}) — nearest real segment point was ${f.nearestSegmentMm}mm away`
    ).join('\n'));

    // The corrected check asserts something TRUE: every anchorsAtPrev marker sits where the real G-code
    // actually goes. Corner (the user's own reported bug) now PASSES this — t1854 proved the reconciled marker
    // IS where the emitted reposition traverse lands, byte-for-byte. A clean picture, for every checkable pass.
    expect(result.failed, `${result.failed.length} marker(s) render somewhere the real emitted G-code never visits`).toEqual([]);
    expect(result.checked, 'at least one op must exercise the anchorsAtPrev ground-truth check, or this test is vacuously green').toContain('user_corner_data');
});

test('the check can catch a REAL drift — synthetic proof the ground-truth comparison is not vacuous', async ({ page }) => {
    // t1856 — proves the REPLACEMENT check has real discriminating power for the ONE case it applies to
    // (anchorsAtPrev), using corner's own real shape as the synthetic data: pass 0 declared (7,-43), a REAL
    // runtime end (7,-7) (a probe travelled further than declared — the whole reason reconciliation exists),
    // pass 1 declared (-43,7). Honest segments reach the RECONCILED point (-43,43); corrupted segments only
    // reach the raw declared point (-43,7) — the impossible-placeholder value t1854/t1856 diagnosed — so the
    // corrupt case must FAIL, and the honest case must PASS, or this check has no teeth.
    test.setTimeout(30_000);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsEditWizardDef, null, { timeout: 60000 });

    const result = await page.evaluate(async () => {
        const { markerWorldOf } = await import('/viz/markerWorld.js');
        const { passAnchorFor } = await import('/engine/passAnchor.js');
        const dist = (a, b) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
        const TOL = 3;

        function touchesGroundTruth(segments, starts, passEnds, p, target, tol) {
            const anchor = passAnchorFor(starts, passEnds, p) || { x: 0, y: 0, z: 0 };
            for (const s of segments) {
                if (s.pass !== p) continue;
                const w2 = { x: anchor.x + s.x2, y: anchor.y + s.y2 };
                if (dist(w2, target) <= tol) return true;
            }
            return false;
        }

        const starts = [{ x: 7, y: -43, anchorsAtPrev: false }, { x: -43, y: 7, anchorsAtPrev: true }];
        const passEnds = [{ x: 7, y: -7, z: 0 }];
        const claimed = markerWorldOf(starts, passEnds, 1);   // reconciled = (-43, 43)
        const segsHonest = [{ pass: 1, x1: 0, y1: 0, x2: -50, y2: 50 }];   // anchor(7,-7) + (-50,50) = (-43,43) ✓
        const segsCorrupt = [{ pass: 1, x1: 0, y1: 0, x2: -50, y2: 14 }];  // anchor(7,-7) + (-50,14) = (-43,7) — the raw declared placeholder, NOT the reconciled truth
        const segsEmpty = [];   // the "no real motion for this pass" edge case — must also read as not-touched, not silently pass

        return {
            honest_touches: touchesGroundTruth(segsHonest, starts, passEnds, 1, claimed, TOL),
            corrupt_touches: touchesGroundTruth(segsCorrupt, starts, passEnds, 1, claimed, TOL),
            empty_touches: touchesGroundTruth(segsEmpty, starts, passEnds, 1, claimed, TOL),
            claimed,
        };
    });

    console.log('PERTURBATION PROOF:', JSON.stringify(result, null, 2));
    expect(result.honest_touches, 'honest anchorsAtPrev data (route reaches the reconciled truth) must PASS').toBe(true);
    expect(result.corrupt_touches, 'corrupted anchorsAtPrev data (route only reaches the raw placeholder) must FAIL — proves the check catches a real drift').toBe(false);
    expect(result.empty_touches, 'no segments at all for the pass must also FAIL, not silently pass').toBe(false);
});
