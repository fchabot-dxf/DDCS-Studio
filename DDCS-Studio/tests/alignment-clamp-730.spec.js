import { test, expect } from '@playwright/test';

/**
 * t730 — the alignment marker CLAMP root-cause (the advisor's repro, disproving the earlier "already unclamped" claim).
 * On a FRESH boot the machine ships a 300×300 envelope with workOrigin {0,0,0} and wcs.table === null. The OLD
 * machineReachXY read that PLACEHOLDER as "the stock's datum corner is jammed at machine travel-0", so the reach box was
 * [0,300]×[0,300] with LOWER bounds of 0. An alignment fence marker legitimately sits in front of / left of the stock
 * (A seats at y<0 by design), so dragging it into the −X/−Y quadrant SATURATED at (0,0): drag 1 stopped short, drags 2-4
 * did not move at all — pinned. FIX: the reach binds ONLY when the stock's placement is DECLARED (a real WCS table row
 * backs workOrigin); the shipped default is a placeholder → reach null → markers position ANYWHERE. Acceptance below.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('DEFAULT config: 4 consecutive away-drags each MOVE marker A (no pin) — it crosses the machine-origin corner freely', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    // the advisor's repro: default machine (300×300, workOrigin 0, wcs.table null), stock 200×150 — NO declared placement
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.default3D = false; });
    await page.evaluate(() => window.openWiz('user_alignment_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.setView) p.setView('2d'); });
    await page.waitForSelector('#wiz_user svg [data-hid="__simstart0"]', { timeout: 8000 });
    await page.waitForTimeout(200);

    const markerAx = () => page.evaluate(() => { const s = window.ddcsStudio.wizardManager._activePanel.getPassStarts() || []; return s[0] ? s[0].x : null; });
    const handle = () => page.evaluate(() => { const el = document.querySelector('#wiz_user svg [data-hid="__simstart0"]'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });

    const xs = [await markerAx()];   // start world x (~60 for ax=0.3×200)
    // FOUR successive drags, each pulling the handle a fixed step to the LEFT (screen −X → world −X). If the reach still
    // pinned at xMin=0, world x would saturate at 0 and drags 2-4 would not move it. Unbounded → it keeps following left.
    for (let d = 0; d < 4; d++) {
        const h = await handle();
        await page.mouse.move(h.x, h.y); await page.mouse.down();
        await page.mouse.move(h.x - 95, h.y, { steps: 8 }); await page.mouse.up();
        await page.waitForTimeout(250);
        xs.push(await markerAx());
    }

    // (a) strictly MOVING: every successive drag lowered world x (no saturation / pin)
    for (let i = 1; i < xs.length; i++) expect(xs[i], `drag ${i} moved marker A further left (xs=${JSON.stringify(xs.map((v) => v == null ? null : +v.toFixed(1)))})`).toBeLessThan(xs[i - 1] - 1);
    // (b) it CROSSED the machine-origin corner (x<0) — the exact region the old clamp pinned at 0
    expect(xs[xs.length - 1], 'marker A dragged PAST the machine-origin corner into negative world X (the old clamp forbade this)').toBeLessThan(0);

    // (c) params ROUND-TRIP: the recorded op carries the dragged ax (negative fraction), and opSimStarts re-derives A there
    const rt = await page.evaluate(async () => {
        const { getLastOp } = await import('/blocks/opRecord.js');
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const o = getLastOp();
        const s = opSimStarts('user_alignment_data', o.params, window.ddcsGetSettings().stock) || [];
        return { ax: o.params.ax, markX: s[0] ? s[0].x : null };
    });
    expect(rt.ax, 'the dragged ax fraction round-trips into the recorded op (negative → past the origin)').toBeLessThan(0);
    // "emit follows" for alignment = the SIM marker follows: ax/ay are A's SIM-ONLY anchor (t544 — never emitted; AUTO probes
    // where the machine is), so the emit is correctly invariant to A's drag; opSimStarts (what the preview probe-start reads)
    // is the surface that follows. The shared machineReachXY fix means emitting-marker ops inherit the same unclamp.
    expect(Math.abs(rt.markX - xs[xs.length - 1]), 'opSimStarts re-derives marker A at the dragged world (the one source the sim reads)').toBeLessThan(1.5);
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/alignment_clamp_730.png', clip: _b }); }
});
