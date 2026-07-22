import { test, expect } from '@playwright/test';

/**
 * t732 — the layout canvas ACCOMMODATES a marker dragged to the edge. t730 unclamped the WORLD (the reach no longer pins
 * the value), but a SECOND wall remained: the VIEWPORT. _followHandle (t532) holds a free noSnap sim-start marker at the
 * 80px edge gutter during a drag, and with the frozen viewBox + no refit the marker PINS there — the next drag can't leave
 * the fitted view, so it goes nowhere (the advisor's repro: the handle stuck at exactly 80px inside the canvas rect,
 * drags 3-4 moved ZERO px). FIX (featureCanvas, one consumer → all layout canvases inherit): on DROP, if the marker landed
 * in the gutter, REFIT (roomy margin) to include all markers so it sits well inside and the next drag continues.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('DEFAULT config: four consecutive away-drags each MOVE the handle on screen (no pin) + the world keeps growing negative', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.default3D = false; });
    await page.evaluate(() => window.openWiz('user_alignment_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.setView) p.setView('2d'); });
    await page.waitForSelector('#wiz_user svg [data-hid="__simstart0"]', { timeout: 8000 });
    await page.waitForTimeout(200);

    const handleScreen = () => page.evaluate(() => { const el = document.querySelector('#wiz_user svg [data-hid="__simstart0"]'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const worldX = () => page.evaluate(() => { const s = window.ddcsStudio.wizardManager._activePanel.getPassStarts() || []; return s[0] ? s[0].x : null; });

    const deltas = [], xs = [await worldX()];
    for (let d = 0; d < 4; d++) {
        const before = await handleScreen();
        await page.mouse.move(before.x, before.y); await page.mouse.down();
        await page.mouse.move(before.x - 200, before.y + 160, { steps: 12 }); await page.mouse.up();   // the advisor's exact away-drag
        await page.waitForTimeout(250);
        const after = await handleScreen();
        deltas.push(Math.hypot(after.x - before.x, after.y - before.y));
        xs.push(await worldX());
    }
    console.log('REFIT deltas=' + JSON.stringify(deltas.map((d) => +d.toFixed(0))) + ' worldXs=' + JSON.stringify(xs.map((v) => v == null ? null : +v.toFixed(1))));
    // (a) NO PIN — every drag visibly relocated the handle (the canvas accommodated it), not stuck at the gutter
    deltas.forEach((dl, i) => expect(dl, `drag ${i + 1} moved the handle ${dl.toFixed(0)}px on screen (no pin)`).toBeGreaterThan(100));
    // (b) the WORLD keeps growing negative (each drag pushed A further out — the value never saturates)
    for (let i = 1; i < xs.length; i++) expect(xs[i], `drag ${i} pushed world X further negative`).toBeLessThan(xs[i - 1] - 1);
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/alignment_canvas_refit_732.png', clip: _b }); }
});

test('MILL TWIN spot-check: the pocket POS handle drags far off-stock with the same freedom (moves, not pinned)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.default3D = false; });
    await page.evaluate(() => window.openWiz('user_pocket_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.setView) p.setView('2d'); });
    await page.waitForSelector('#wiz_user svg [data-hid="pk_pos"]', { timeout: 8000 });
    await page.waitForTimeout(200);
    // the pocket POS handle is a FEATURE move handle (not a _followHandle-held sim marker), so it was never pinned — it
    // follows the cursor freely. Assert the same freedom: an away-drag moves it far, and the placement grows off-stock.
    const posScreen = () => page.evaluate(() => { const el = document.querySelector('#wiz_user svg [data-hid="pk_pos"]'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const before = await posScreen();
    await page.mouse.move(before.x, before.y); await page.mouse.down();
    await page.mouse.move(before.x - 200, before.y + 160, { steps: 12 }); await page.mouse.up();
    await page.waitForTimeout(250);
    const after = await posScreen();
    const moved = Math.hypot(after.x - before.x, after.y - before.y);
    console.log('POCKET pos moved ' + moved.toFixed(0) + 'px');
    expect(moved, 'the pocket pos handle drags freely (moves > 100px, not pinned)').toBeGreaterThan(100);
});
