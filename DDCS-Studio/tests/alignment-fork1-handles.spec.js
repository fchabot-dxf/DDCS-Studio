import { test, expect } from '@playwright/test';

/**
 * ALIGNMENT Fork 1 (t508) — the in-place data-op form's 2D Layout renders BOTH sim-start markers (A, B) as DRAGGABLE
 * handles bound to the ONE source (def.simStartParams: A → ax/ay, B → bx/by as FRACTIONS of the stock). A REAL pointer
 * drag writes the fraction param → recorded (persist + round-trip) → re-read by opSimStarts (the marker tracks it). This
 * pins the drag → param → sim end-to-end in the ACTUAL in-place UI (verify 1). The emitted-AUTO-coord surface = Fork 2.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('the alignment in-place Layout has 2 draggable handles (A/B); dragging A writes the fraction param (one source)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 200, y: 120, z: 30, shape: 'box', show: true } }); });
    await page.evaluate(() => window.openWiz('user_alignment_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('#userVizContainer [data-hid="__simstart0"]'), null, { timeout: 8000 });

    // the DECLARED binding + BOTH markers render as draggable handles (A, B) — the old Layout showed only 1
    const setup = await page.evaluate(async () => {
        const { alignmentDataDef } = await import('/blocks/dataOps/alignmentData.js');
        const spb = alignmentDataDef().simStartParams;
        const hids = [...document.querySelectorAll('#userVizContainer [data-hid^="__simstart"]')].map((e) => e.getAttribute('data-hid'));
        return { spb, hids };
    });
    expect(setup.spb, 'the marker→param binding is DECLARED on the def').toEqual([{ x: 'ax', y: 'ay' }, { x: 'bx', y: 'by' }]);
    expect(setup.hids.sort(), 'both A and B render as draggable Layout handles').toEqual(['__simstart0', '__simstart1']);

    // DRAG handle A to the stock CENTRE (world ≈ 100,60 for a 200×120 stock → fraction ≈ 0.5, 0.5)
    const stockBox = await page.locator('#userVizContainer .fc-stock').first().boundingBox();
    const hb = await page.locator('#userVizContainer [data-hid="__simstart0"]').first().boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(stockBox.x + stockBox.width / 2, stockBox.y + stockBox.height / 2, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(250);

    // the drag wrote params.ax/ay as a FRACTION → recorded (the ONE source: persists + round-trips + feeds opSimStarts/emit)
    const rec = await page.evaluate(async () => { const { getLastOp } = await import('/blocks/opRecord.js'); const o = getLastOp(); return o && o.params ? { type: o.type, ax: o.params.ax, ay: o.params.ay } : null; });
    expect(rec && rec.type, 'the alignment op is the recorded op').toBe('user_alignment_data');
    expect(Number.isFinite(rec.ax) && Math.abs(rec.ax - 0.5) < 0.12, `dragging A to centre → ax fraction ≈ 0.5 (got ${rec && rec.ax})`).toBe(true);
    expect(Number.isFinite(rec.ay) && Math.abs(rec.ay - 0.5) < 0.18, `ay fraction ≈ 0.5 (got ${rec && rec.ay})`).toBe(true);

    // and the sim marker A now reflects that fraction (opSimStarts reads the written param — the marker TRACKS the source)
    const markA = await page.evaluate(async () => {
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const { getLastOp } = await import('/blocks/opRecord.js');
        const s = opSimStarts('user_alignment_data', getLastOp().params, window.ddcsGetSettings().stock) || [];
        return s[0] ? { x: s[0].x, y: s[0].y } : null;
    });
    expect(markA && Math.abs(markA.x - 100) < 25, `sim marker A tracks the dragged fraction (x≈100; got ${markA && markA.x})`).toBe(true);
    await page.locator('#wiz_user').screenshot({ path: 'scratchpad/alignment_fork1_handles.png' });
});
