import { test, expect } from '@playwright/test';

/**
 * HOMING PREVIEW — the PIN AUDIT (t576, increment 1). The human's screenshots showed the machine-frame layout's layers a few
 * INCHES apart: the envelope + HOME glyph + Start were in MACHINE coords, but the ROUTE was drawn in the PART frame
 * (machine − workOrigin — the recurring few-inch delta). FIX: a machine-frame (homing) route draws in MACHINE coords
 * (wcsOffset=0) so its G53/switch seeks land ON the envelope's home edges; and a homing SWITCH-SEEK ignores the workpiece (it
 * seeks the envelope-edge switch, not a stock face) so each seek reaches its declared home end. ACCEPTANCE: all layers share
 * ONE pin — the route's seek extremes == the declared machine home edges, INVARIANT to the workOrigin, at 2 WCS × both Z signs.
 */
test.use({ viewport: { width: 1300, height: 950 } });

async function openHoming(page, wo, mz) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(({ wo, mz }) => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: 400, z: mz, show: true, workOrigin: wo, wcs: { active: 1, table: [{ x: wo.x, y: wo.y, z: wo.z - 10 }] } };
        s.homing = { axes: { z: { enable: true, order: 1 }, x: { enable: true, order: 2 }, y: { enable: true, order: 3 } } };
        s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true };   // Z home = the top (max); X/Y home = the min (0)
        s.stock = { show: true, x: 100, y: 80, z: 25, datum: 'nnp', pin: 'G54' };
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    }, { wo, mz });
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(300);
    return page.evaluate(() => {
        const p = window.ddcsStudio.wizardManager._activePanel;
        const segs = p.getSegments();
        const ext = (a) => ({ min: Math.min(...a), max: Math.max(...a) });
        return { start: p.getPassStarts()[0], x: ext(segs.flatMap((g) => [g.x1, g.x2])), y: ext(segs.flatMap((g) => [g.y1, g.y2])), z: ext(segs.flatMap((g) => [g.z1, g.z2])) };
    });
}

for (const mz of [-120, 500]) {
    test(`the route seeks land on the machine home edges + are INVARIANT to the workOrigin (machine Z=${mz}, 2 WCS values)`, async ({ page }) => {
        const A = await openHoming(page, { x: 50, y: 30, z: 0 }, mz);   // an OFFSET workOrigin
        const B = await openHoming(page, { x: 0, y: 0, z: 0 }, mz);      // origin workOrigin
        // the declared home edges in MACHINE coords: X/Y home = the min (0); Z home (zMaxHome) = the max Z (0 for a −Z travel, mz for +Z)
        const zHome = Math.max(0, mz), zMid = mz / 2;
        // 1) the Start = mid-envelope (machine coords), invariant to the workOrigin
        expect(Math.abs(A.start.x - 300) + Math.abs(A.start.y - 200) + Math.abs(A.start.z - zMid), 'Start = mid-envelope (machine)').toBeLessThan(0.1);
        expect(Math.hypot(A.start.x - B.start.x, A.start.y - B.start.y, A.start.z - B.start.z), 'Start INVARIANT to the workOrigin').toBeLessThan(0.1);
        // 2) each seek's extreme TOUCHES its declared home edge (the route's min/max on that axis == the home coord)
        expect(Math.abs(A.x.min - 0), 'X seek touches the −X home (machine 0)').toBeLessThan(0.1);   // xMinHome
        expect(Math.abs(A.y.min - 0), 'Y seek touches the −Y home (machine 0)').toBeLessThan(0.1);   // yMinHome
        expect(Math.abs((mz < 0 ? A.z.max : A.z.max) - zHome), 'Z seek touches the declared Z home edge').toBeLessThan(0.1);   // zMaxHome
        // 3) the ROUTE is INVARIANT to the workOrigin — the mis-pin (machine − workOrigin) is GONE; all layers share ONE machine pin
        for (const ax of ['x', 'y', 'z']) {
            expect(Math.abs(A[ax].min - B[ax].min) + Math.abs(A[ax].max - B[ax].max), `route ${ax} INVARIANT to the workOrigin (< 0.1mm)`).toBeLessThan(0.1);
        }
        console.log(`Z=${mz}: start=(${Math.round(A.start.x)},${Math.round(A.start.y)},${Math.round(A.start.z)}) X→${A.x.min} Y→${A.y.min} Z→${A.z.max} (home 0/0/${zHome}); invariant ✓`);
    });
}
