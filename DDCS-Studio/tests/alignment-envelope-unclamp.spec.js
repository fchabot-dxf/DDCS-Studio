import { test, expect } from '@playwright/test';

/**
 * t528 — the sim-start handles UNCLAMP from the stock to the machine ENVELOPE (the human: the marker must be able to exit
 * the stock contour). (1) alignPoints no longer clamps the fraction to [0,1]; (2) a REAL drag past the stock edge writes a
 * fraction >1, bounded only by the machine envelope (settings.machine span); the sim marker follows past the stock edge.
 */

test('the A anchor allows fractions beyond [0,1] (a probe point past the stock edge)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { alignMarkersXY } = await import('/wizards/ops/alignPoints.js');
        return {
            xy: alignMarkersXY({ ax: 1.4, ay: 0.5 }, { x: 200, y: 120 })[0],    // A DRAGGED: along-X 1.4 × 200 = 280 (past the edge), perp-Y 0.5 × 120 = 60
            defA: alignMarkersXY({ checkAxis: 'X' }, { x: 200, y: 120 })[0],     // empty → the default: A just OUTSIDE the probed −Y fence
        };
    });
    expect(r.xy.x, 'a dragged along-fence fraction 1.4 × 200mm = 280mm is NOT clamped to the stock edge').toBeCloseTo(280, 3);
    expect(r.xy.y, 'the perp fraction 0.5 × 120mm = 60').toBeCloseTo(60, 3);
    expect(r.defA.y < 0, 't574 — the empty default seats A OUTSIDE the probed −Y fence (below y=0)').toBe(true);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('a REAL drag past the stock edge writes a fraction >1, bounded by the machine envelope; the marker follows', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    // stock 200×120; a TIGHT envelope 220×220 (workOrigin 0) → the max reach is 220mm → the max ax fraction = 220/200 = 1.10
    await page.evaluate(async () => {
        const SP = await import('/ui/settingsPanel.js');
        SP.applySettings({ stock: { x: 200, y: 120, z: 30, shape: 'box', show: true }, machine: { x: 220, y: 220, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 } } });
    });
    await page.evaluate(() => window.openWiz('user_alignment_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('#userVizContainer [data-hid="__simstart0"]'), null, { timeout: 8000 });
    await page.waitForTimeout(200);

    // DRAG handle A far to the RIGHT (well past the stock's right edge) — world clamps at the 220 envelope → ax → 1.10
    const cont = await page.locator('#userVizContainer').boundingBox();
    const hb = await page.locator('#userVizContainer [data-hid="__simstart0"]').first().boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(cont.x + cont.width - 12, hb.y + hb.height / 2, { steps: 18 });   // far right → past the stock, into the envelope cap
    await page.mouse.up();
    await page.waitForTimeout(250);

    const rec = await page.evaluate(async () => { const { getLastOp } = await import('/blocks/opRecord.js'); const o = getLastOp(); return o && o.params ? { type: o.type, ax: o.params.ax, ay: o.params.ay } : null; });
    const markA = await page.evaluate(async () => {
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const { getLastOp } = await import('/blocks/opRecord.js');
        const s = opSimStarts('user_alignment_data', getLastOp().params, window.ddcsGetSettings().stock) || [];
        return s[0] ? { x: s[0].x, y: s[0].y } : null;
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/alignment_handle_outside_stock.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    console.log('dragged-past-stock: ax=' + (rec && rec.ax) + ' markA.x=' + (markA && markA.x) + ' (stock 200, envelope 220)');
    expect(rec && rec.type).toBe('user_alignment_data');
    expect(rec.ax, 'the drag wrote a fraction >1 — the handle EXITED the stock (past the 200mm edge)').toBeGreaterThan(1);
    expect(rec.ax, 'bounded by the machine envelope (220/200 = 1.10), not runaway').toBeLessThanOrEqual(1.105);
    expect(markA.x, 'the sim marker followed PAST the stock edge (x > 200mm)').toBeGreaterThan(200);
    expect(markA.x, 'the sim marker stops at the envelope (x ≤ 220mm)').toBeLessThanOrEqual(220.5);
});
