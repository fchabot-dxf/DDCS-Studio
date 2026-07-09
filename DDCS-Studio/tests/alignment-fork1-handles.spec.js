import { test, expect } from '@playwright/test';

/**
 * ALIGNMENT Fork 1 (t508, REDEFINED t544) — the in-place data-op form's 2D Layout renders BOTH sim-start markers as
 * DRAGGABLE handles bound to the ONE source (def.simStartParams). t544: marker A = the SIM-ONLY start anchor → ax/ay
 * FRACTIONS (never emitted); marker B = A + the span → its drag along the checkAxis fence writes the SPAN field (relSpanFrom
 * pattern, B−A). VERIFY end-to-end in the ACTUAL in-place UI: A drag → ax/ay fraction; B drag → the span field (one source).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('the alignment Layout has 2 draggable handles: A drag → the ax/ay anchor (sim-only); B drag → the SPAN field', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 200, y: 120, z: 30, shape: 'box', show: true } }); });
    await page.evaluate(() => window.openWiz('user_alignment_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('#userVizContainer [data-hid="__simstart0"]'), null, { timeout: 8000 });

    // the DECLARED binding — A = {ax,ay} anchor; B = the relSpanFrom SPAN marker (along checkAxis)
    const setup = await page.evaluate(async () => {
        const { alignmentDataDef } = await import('/blocks/dataOps/alignmentData.js');
        const spb = alignmentDataDef().simStartParams;
        const hids = [...document.querySelectorAll('#userVizContainer [data-hid^="__simstart"]')].map((e) => e.getAttribute('data-hid'));
        return { spb, hids };
    });
    expect(setup.spb, 'A = the ax/ay anchor; B = the relSpanFrom span marker (checkAxis, signed)').toEqual([{ x: 'ax', y: 'ay' }, { y: 'span', relSpanFrom: 0, spanAxisFrom: 'checkAxis', signed: true }]);
    expect(setup.hids.sort(), 'both A and B render as draggable Layout handles').toEqual(['__simstart0', '__simstart1']);

    // ── DRAG handle A to the stock CENTRE (world ≈ 100,60 for a 200×120 stock → fraction ≈ 0.5, 0.5) — the SIM anchor ──
    const stockBox = await page.locator('#userVizContainer .fc-stock').first().boundingBox();
    const hbA = await page.locator('#userVizContainer [data-hid="__simstart0"]').first().boundingBox();
    await page.mouse.move(hbA.x + hbA.width / 2, hbA.y + hbA.height / 2);
    await page.mouse.down();
    await page.mouse.move(stockBox.x + stockBox.width / 2, stockBox.y + stockBox.height / 2, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    const recA = await page.evaluate(async () => { const { getLastOp } = await import('/blocks/opRecord.js'); const o = getLastOp(); return o && o.params ? { type: o.type, ax: o.params.ax, ay: o.params.ay } : null; });
    expect(recA && recA.type, 'the alignment op is the recorded op').toBe('user_alignment_data');
    expect(Number.isFinite(recA.ax) && Math.abs(recA.ax - 0.5) < 0.12, `A drag → ax fraction ≈ 0.5 (got ${recA && recA.ax})`).toBe(true);
    expect(Number.isFinite(recA.ay) && Math.abs(recA.ay - 0.5) < 0.18, `ay fraction ≈ 0.5 (got ${recA && recA.ay})`).toBe(true);

    // ── DRAG handle B along the checkAxis (X) fence → writes the SPAN field = B.x − A.x (relSpanFrom, one source) ──
    // A RELATIVE +X screen drag (the canvas re-fit after the A drag, so an absolute stock-rect target would be stale).
    const spanBefore = await page.evaluate(() => Number(document.querySelector('#wiz_user_form [data-param="span"]').value));
    const hbB = await page.locator('#userVizContainer [data-hid="__simstart1"]').first().boundingBox();
    await page.mouse.move(hbB.x + hbB.width / 2, hbB.y + hbB.height / 2);
    await page.mouse.down();
    await page.mouse.move(hbB.x + hbB.width / 2 + 90, hbB.y + hbB.height / 2, { steps: 14 });   // +90px in X → grow the span
    await page.mouse.up();
    await page.waitForTimeout(250);
    const spanAfter = await page.evaluate(() => Number(document.querySelector('#wiz_user_form [data-param="span"]').value));
    const recSpan = await page.evaluate(async () => { const { getLastOp } = await import('/blocks/opRecord.js'); return Number(getLastOp().params.span); });
    // dragging B in +X grew the span (B is now further from A along the fence) — the span field (the ONE source) changed
    expect(spanAfter, `B drag → the span field changed (${spanBefore} → ${spanAfter})`).not.toBe(spanBefore);
    expect(spanAfter, 'B drag grew the span (dragged toward the far X edge)').toBeGreaterThan(spanBefore);
    expect(Number.isFinite(recSpan) && recSpan === spanAfter, 'the recorded span == the field (one source)').toBe(true);
    await page.locator('#wiz_user').screenshot({ path: 'scratchpad/alignment_fork1_handles.png' });
});
