import { test, expect } from '@playwright/test';

/**
 * t2000 — RECONCILERS.surfacing was stale: it searched for a `stepdown` block, a shape surfacing's builder
 * stopped emitting at t1359 (collapsed into one `surfaceraster` atom). It always returned null, so
 * `wizardManager.pullFromBlocks` — wired to the STUDIO tab click — silently never reflected a Blocks-tab hand
 * edit back into the open wizard's form. Fixed by reading `find(prog, 'surfaceraster')` directly, the same shape
 * `RECONCILERS.pocket` (t1406) and `RECONCILERS.slot` (t1500) already read for their own raster arm.
 *
 * THIS TEST DRIVES THE REAL GESTURE, not the reconciler function: open the Surfacing wizard, hand-edit the live
 * block's params (what a Blocks-tab field edit ultimately does to the model), click back to the STUDIO tab, and
 * read the actual DOM form field. A unit test calling `reconcileActiveOp()` directly would pass even if the
 * `showApp('studio')` → `pullFromBlocks()` wiring itself were broken — that is the exact gap this closes.
 *
 * Non-vacuity: every seeded value is FAR from its own default (depth 0.5→7.777, feed 2000→1888, toolDia
 * (form default 12)→9.333, stepoverPct→37) and different from every other field's value, so a field reading
 * right by coincidence — a stale default, a cross-field mix-up, a re-derive that ignores the edit — reads wrong.
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function boot(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsStudio.wizardManager && window.ddcsGetBlockProgram);
}

test('editing a surfacing op in Blocks, then switching to Studio, updates the open wizard form (the real gesture)', async ({ page }) => {
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await boot(page);

    // Open the Surfacing wizard — the form is live and its op is the active block program.
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
    await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
    await page.evaluate(() => window.ddcsStudio.wizardManager.update());

    const before = await page.locator('#sf_depth').inputValue();

    // Switch to Blocks and hand-edit the live surfaceraster atom's params directly — what a Blocks-tab field
    // edit ultimately does to the model (the same convention atc-roundtrip.spec.js's raw-edit test uses).
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws, { timeout: 8000 });
    const seeded = await page.evaluate(() => {
        const find = (blocks, type) => {
            for (const b of blocks || []) {
                if (!b) continue;
                if (b.type === type) return b;
                if (b.children) { const f = find(b.children, type); if (f) return f; }
            }
            return null;
        };
        const prog = window.ddcsGetBlockProgram() || [];
        const rg = find(prog, 'surfaceraster');
        if (!rg) return null;
        rg.params.depth = 7.777;
        rg.params.feed = 1888;
        rg.params.toolDia = 9.333;
        rg.params.stepoverPct = 37;
        return { depth: rg.params.depth, feed: rg.params.feed, toolDia: rg.params.toolDia, stepoverPct: rg.params.stepoverPct };
    });
    expect(seeded, 'the surfacing op really does build a surfaceraster atom to hand-edit').not.toBeNull();

    // THE REAL GESTURE: click back to Studio. gatewayStatus.js's own showApp('studio') branch fires
    // wizardManager.pullFromBlocks() — never called directly here, exactly to prove that wiring, not the reconciler.
    await page.evaluate(() => window.showApp('studio'));
    await page.waitForFunction(() => document.getElementById('sf_depth') && document.getElementById('sf_depth').value === '7.777', { timeout: 8000 });

    const after = {
        depth: await page.locator('#sf_depth').inputValue(),
        feed: await page.locator('#sf_feed').inputValue(),
        toolDia: await page.locator('#sf_toolDia').inputValue(),
        stepoverPct: await page.locator('#sf_stepoverPct').inputValue(),
    };
    expect(before, 'sanity: the pre-edit form value is NOT the seeded value').not.toBe('7.777');
    expect(after.depth, 'the Studio form field shows the SEEDED value, not the pre-edit default').toBe('7.777');
    expect(after.feed, 'a second independent field also reconciled').toBe('1888');
    expect(after.toolDia, 'toolDia now reconciles too (a real gap the old reader never closed, since it only ever read toolDia off the DOM to un-derive a percent)').toBe('9.333');
    expect(after.stepoverPct, 'stepoverPct reconciles straight off the atom (no un-deriving needed any more)').toBe('37');
    expect(errs, 'no page errors').toEqual([]);
});

test('pocket still reconciles after the surfacing fix (RECONCILERS.pocket, RECONCILERS.slot untouched)', async ({ page }) => {
    await boot(page);
    // Explicit rect big enough to land on the raster arm (RECONCILERS.pocket's own t1406 branch) rather than the
    // wizard's own defaults, which could land on the "too small" fallback arm and decline for an unrelated reason.
    const r = await page.evaluate(async () => {
        const ops = await import('/blocks/opSession.js');
        const rec = await import('/blocks/opRecord.js');
        rec.recordOp('pocket', { shape: 'rect', w: 80, h: 60, toolDia: 6, wallOffset: -0.75, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5, strategy: 'raster', entry: 'ramp', rampAngle: 4 });
        const built = ops.buildActiveOpStack();
        if (!built) return { err: 'no op stack' };
        window.ddcsLoadBlockStack(built.blocks);
        return ops.reconcileActiveOp();
    });
    expect(r, 'pocket still has a working reconciler').not.toBeNull();
    expect(r.type).toBe('pocket');
    expect(r.fields && r.fields.p_toolDia).toBe(6);
    expect(r.fields && r.fields.p_depth).toBe(4);
});
