import { test, expect } from '@playwright/test';

/**
 * t726 P2b — THE MILL START PROMOTION. The 7 mill twins drop the sim-only jog circle and gain a DECLARED emitting entry
 * point (the entry marker + entryX/entryY on an `entry` block). Semantics: UNSET → byte-identical (the cut owns its entry);
 * MOVED beyond ε → one `G0 X Y` waypoint at clearance before the cut. Probe/homing/ATC keep their circle (negative control).
 */
test.use({ viewport: { width: 1300, height: 980 } });

const MILL = [
    ['user_contour_data', 'contourDataDef'], ['user_drill_data', 'drillDataDef'], ['user_bore_data', 'boreDataDef'],
    ['user_slot_data', 'slotDataDef'], ['user_pocket_data', 'pocketDataDef'], ['user_surfacing_data', 'surfacingDataDef'],
    ['user_text_data', 'textDataDef'],
];

// (1) per mill twin: UNSET emit has NO waypoint (byte-identical class); MOVED emit routes the opening rapid through the
// declared XY (assert the actual G0 line), at clearance, before the cut's first G0 X Y.
test('(1) every mill twin: unset → no waypoint; moved → G0 through the declared XY before the cut', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async (MILL) => {
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const mods = {
            contourDataDef: (await import('/blocks/dataOps/contourData.js')).contourDataDef,
            drillDataDef: (await import('/blocks/dataOps/drillData.js')).drillDataDef,
            boreDataDef: (await import('/blocks/dataOps/boreData.js')).boreDataDef,
            slotDataDef: (await import('/blocks/dataOps/slotData.js')).slotDataDef,
            pocketDataDef: (await import('/blocks/dataOps/pocketData.js')).pocketDataDef,
            surfacingDataDef: (await import('/blocks/dataOps/surfacingData.js')).surfacingDataDef,
            textDataDef: (await import('/blocks/dataOps/textData.js')).textDataDef,
        };
        const out = {};
        for (const [op, mk] of MILL) {
            registerUserOp(mods[mk]());
            const bld = builderOf(op);
            const unset = emitMapped(bld({})).text;
            const moved = emitMapped(bld({ entryX: 77, entryY: -33 })).text;
            const movedLines = moved.split('\n');
            const wi = movedLines.findIndex((l) => /G0 X77 Y-33\s+\( entry \)/.test(l));
            const firstCut = movedLines.findIndex((l) => /\bG0\b/.test(l) && /X-?\d/.test(l) && /Y-?\d/.test(l) && !/\( entry \)/.test(l));
            out[op] = { unsetNoWaypoint: !/\( entry \)/.test(unset), movedHasWaypoint: wi >= 0, waypointBeforeCut: wi >= 0 && firstCut >= 0 && wi < firstCut };
        }
        return out;
    }, MILL);
    for (const [op] of MILL) {
        expect(r[op].unsetNoWaypoint, `${op}: unset → byte-identical (no waypoint)`).toBe(true);
        expect(r[op].movedHasWaypoint, `${op}: moved → G0 X77 Y-33 ( entry )`).toBe(true);
        expect(r[op].waypointBeforeCut, `${op}: the waypoint precedes the cut entry`).toBe(true);
    }
});

// (2) the jog circle is GONE from the mill twins but PRESENT on corner/homing (the negative control).
test('(2) the jog ○ is gone from mill twins, kept on corner/homing', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; });
    const simCount = async (op) => {
        await page.evaluate((o) => window.openWiz(o), op);
        await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
        await page.waitForTimeout(600);
        return page.evaluate(() => document.querySelectorAll('#wiz_user .fc-handle-sim').length);
    };
    for (const op of ['user_contour_data', 'user_drill_data', 'user_pocket_data']) {
        expect(await simCount(op), `${op}: no sim-only jog ○`).toBe(0);
    }
    expect(await simCount('user_corner_data'), 'corner keeps its ○').toBeGreaterThanOrEqual(1);
    expect(await simCount('user_homing_data'), 'homing keeps its ○').toBeGreaterThanOrEqual(1);
});

// (3) dragging the entry square WRITES entryX/entryY (Blocks round-trips them) → the emit routes through it (form↔emit).
test('(3) dragging the entry square writes entryX/entryY and the emit follows', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; });
    await page.evaluate(() => window.openWiz('user_contour_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(700);
    // Move the entry OFF the cut entry first (the default sits on the pos handle for an origin op, where the pos wins the
    // hit-test — the correct yield). Now the entry square is clear of the pos and independently draggable.
    for (const [k, v] of [['entryX', 45], ['entryY', -25]]) await page.evaluate(([k2, v2]) => { const f = document.querySelector(`#wiz_user_form [data-param="${k2}"]`); f.value = v2; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); }, [k, v]);
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => Number(document.querySelector('#wiz_user_form [data-param="entryX"]').value));
    const bb = await page.locator('#wiz_user [data-hid="__simstart0"]').first().boundingBox();
    expect(bb, 'the entry marker renders').toBeTruthy();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.width / 2 - 55, bb.y + bb.height / 2 - 35, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const res = await page.evaluate(() => {
        const ex = document.querySelector('#wiz_user_form [data-param="entryX"]');
        const code = (document.querySelector('#wiz_user_code') || {}).textContent || '';
        return { entryX: Number(ex.value), hasWaypoint: /\( entry \)/.test(code) };
    });
    expect(res.entryX !== before, `the drag WROTE entryX (${before} → ${res.entryX})`).toBe(true);
    expect(res.hasWaypoint, 'the emit routes through the entry').toBe(true);
});
