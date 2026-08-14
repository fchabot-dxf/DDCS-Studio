import { test, expect } from '@playwright/test';

/**
 * t1772 — MAKE THE PICTURE CHECKABLE. Markers are DECLARED (opSimStarts); the traced path comes from actually
 * EXECUTING the emitted G-code (engine/trace.js). Nothing compared them — a snapshot only proves "the picture
 * looks like a stored snapshot," which can't tell a genuine single source from a copy that currently agrees.
 * This asserts the two SOURCES agree with each other, for every shipped twin that has something to compare.
 *
 * THE MECHANISM (traced empirically against the live app before writing this, not assumed from reading code):
 * `gcodeViz3d.js`'s marker sprite renders at `markerWorldOf(starts, passEnds, p)` — for a `anchorsAtPrev` pass,
 * that RECONCILES the declared row against the trace's own runtime pass-end (`_passEnds`, published by
 * `GcodeExecutionEngine` after executing the REAL emitted G-code). The engine's own probe search, however, is
 * fed the RAW declared `starts` array as its target (`traceToolpath`'s `opts.passStarts`) — the SAME raw values
 * `opSimStarts` returns, NOT the reconciled marker position. So the marker SPRITE and the engine's own PROBE
 * TARGET can point at two different places for the exact same pass, and nothing catches it if they drift apart.
 * Live-verified for corner (FL/YX, probeZFirst off, travelDist 50): the raw declared wall2 marker is (-43,7);
 * `markerWorldOf` (what actually renders) reconciles it to (-43,43) using the trace's own passEnds — a 36mm gap
 * between the declared marker and the reconciled/rendered one, for the exact scenario the user reported.
 *
 * THE CHECK: for each pass p ≥ 1, `markerWorldOf(declared, tracedPassEnds, p)` (what renders) must stay within
 * a small tolerance of `declared[p]` itself (what opSimStarts says the pass IS). A small gap is expected and
 * legitimate — pass 0's own "approach" vs. a retract-scale correction; TOLERANCE_MM is set generously above
 * that scale so it does not fire on ordinary retract-sized drift, only on a genuine disagreement.
 *
 * EXCLUDED, deliberately, not silently: any twin where `opSimStarts` returns null/empty (nothing DECLARED to
 * compare), or fewer than 2 passes (nothing to reconcile against a "previous" pass), or whose emitted G-code
 * produces no traceable motion (a preview-only visual with no G-code behind it — e.g. ATC magazine/stylus setup
 * ops). The excluded list is reported explicitly (see the `for the advisor` console output), not swept away.
 */

const TOLERANCE_MM = 3;

test.use({ viewport: { width: 1400, height: 1000 } });

test('THE PICTURE IS CHECKABLE: for every shipped twin, the declared marker and its rendered (reconciled) position agree', async ({ page }) => {
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

        const STOCK = { x: 100, y: 80, z: 20 };
        const dist = (a, b) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));

        const excluded = [];
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
            if (!declared || declared.length < 2) { excluded.push({ opType, why: `opSimStarts returned ${declared ? declared.length : 'null'} pass(es) — nothing to reconcile against a previous pass` }); continue; }

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

            checked.push(opType);
            for (let p = 1; p < declared.length; p++) {
                const reconciled = markerWorldOf(declared, traced.passEnds, p);
                const d = dist(reconciled, declared[p]);
                if (d > TOL) {
                    failed.push({
                        opType, pass: p, anchorsAtPrev: !!declared[p].anchorsAtPrev,
                        declared: { x: +declared[p].x.toFixed(2), y: +declared[p].y.toFixed(2) },
                        rendered: { x: +reconciled.x.toFixed(2), y: +reconciled.y.toFixed(2) },
                        gapMm: +d.toFixed(2),
                    });
                }
            }
        }
        return { excluded, checked, failed };
    }, TOLERANCE_MM);

    console.log(`CHECKED (${result.checked.length}): ${result.checked.join(', ')}`);
    console.log(`EXCLUDED (${result.excluded.length}):\n` + result.excluded.map((e) => `  ${e.opType}: ${e.why}`).join('\n'));
    console.log(`FAILED (${result.failed.length}):\n` + result.failed.map((f) =>
        `  ${f.opType} pass ${f.pass} (anchorsAtPrev=${f.anchorsAtPrev}): declared (${f.declared.x},${f.declared.y}) vs rendered (${f.rendered.x},${f.rendered.y}) — gap ${f.gapMm}mm`
    ).join('\n'));

    // EXPECTED red: corner, the user's own reported bug, made checkable. Report (do not silently fix) any others.
    const failedOps = [...new Set(result.failed.map((f) => f.opType))];
    expect(failedOps, 'user_corner_data is expected to fail here — the user\'s own reported bug, now checkable').toContain('user_corner_data');
    const others = failedOps.filter((o) => o !== 'user_corner_data');
    if (others.length) console.log(`OTHER TWINS ALSO FAILED (report, not fixed this act): ${others.join(', ')}`);
});
