import { test, expect } from '@playwright/test';

/**
 * t2695 — TIER MIGRATION: split from pocket-rides-raster-1406.spec.js. This is the one test in that file that is
 * NOT a pure page.evaluate returning plain data — it drives the real wizard modal (window.openWiz/updateWiz/
 * insertWiz/closeWiz) and reads window.ddcsGetBlockProgram() off the live app, so it stays in the browser tier.
 * Every other test in the original file (the SWEEP bridge, the named boundary, the two floor divergences, the helix
 * divergence, the CAM knob, the absorbingChild structural check, and the form-fields check) moved to
 * tests/node/pocket-rides-raster-1406.test.mjs — all pure page.evaluate + plain-data expect() calls, no DOM.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * THE RECONCILER READS THE ARM THAT IS ACTUALLY THERE (the t1387 sweep, done IN this act).
 *
 * The pocket reverse-sync opened with `find(prog, 'stepdown')` and then looked for a `pocketfill` inside it. On the
 * re-pointed arm there is no `pocketfill`, and on spiral no `stepdown` either — so an edited parametric pocket would
 * have failed to reconcile SILENTLY, which is precisely the failure t1387 named: a reader that identifies an arm by a
 * block that moved. The op's own "does this look hand-edited" guard is the symptom, and it is asserted here directly
 * rather than trusted to a general sweep: a reconciler that returns null makes a freshly-inserted op glow as edited.
 */
test('THE RECONCILER — a parametric pocket reverse-syncs, and wallOffset survives the inset round-trip', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const { pocketWallOffsetFromInset, pocketInsetMm } = await import('/wizards/ops/pocketfill.js');
        const P = { shape: 'rect', w: 80, h: 60, toolDia: 6, wallOffset: -0.75, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5, strategy: 'raster', entry: 'ramp', rampAngle: 4 };
        // the inverse is exact, both ways, across signs — it is one declaration read backwards, not an inference
        const trip = [0, 0.5, -0.5, 2, -2].map((w) => pocketWallOffsetFromInset(6, pocketInsetMm({ toolDia: 6, wallOffset: w })));
        // and the op really does round-trip through the app's own edited-check
        window.ddcsLoadBlockStack([]);
        window.openWiz('pocket', undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
        const prog = window.ddcsGetBlockProgram() || [];
        const op = [...prog].reverse().find((b) => b && b.type === 'op' && b.opType === 'pocket');
        const glow = await import('/blocks/opGlow.js');
        const session = await import('/blocks/opSession.js');
        const rebuilt = op ? session.replayReconcile(op.id) : null;
        return {
            trip,
            hasRaster: JSON.stringify(pocketStack(P)).includes('"type":"surfaceraster"'),
            opFound: !!op,
            falseGlow: op ? !!glow.isOpBlockEdited(op.id) : null,
            reconciled: !!rebuilt,
        };
    });
    expect(r.hasRaster, 'the config under test really is on the re-pointed arm').toBe(true);
    expect(r.trip, 'wallOffset → inset → wallOffset is exact, across both signs').toEqual([0, 0.5, -0.5, 2, -2]);
    expect(r.opFound, 'a pocket inserts').toBe(true);
    expect(r.reconciled, 'the reconciler READ the parametric stack and rebuilt from it (null = it declined)').toBe(true);
    expect(r.falseGlow, 'and a freshly-inserted pocket does NOT look hand-edited — the reverse-sync agrees with the builder').toBe(false);
});
