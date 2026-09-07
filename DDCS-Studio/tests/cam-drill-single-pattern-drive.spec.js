import { test, expect } from '@playwright/test';

const SCRATCH = 'scratchpad';

// Split from cam-drill-single-pattern.spec.js at the TIER MIGRATION WORK PACKAGE 3 pass; the 4 pure tests moved to
// tests/node/cam-drill-single-pattern.test.mjs. This one stayed because it drives the real macrosApp/CAM
// authoring modal DOM (`window.ddcsOpenCamAuthoring`), waits on a real selector, and takes a screenshot — a
// genuine app+DOM dependency.
test.describe(() => {
    test.use({ viewport: { width: 1400, height: 1000 } });
    test('t1089 REAL SYMPTOM — a DEFAULT drill twin now shows exposable knobs in the CAM modal', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsGetBlockProgram);
        await page.evaluate(async () => {
            const { getUserDef, defaultParams } = await import('/blocks/userOps.js');
            const d = getUserDef('user_drill_data');
            window.ddcsGetBlockProgram = () => ([{ id: 'd1', type: 'op', opType: 'user_drill_data', label: 'Drill', params: defaultParams(d) }]);
            (await import('/ui/macrosApp.js')).initMacrosApp();
            window.ddcsOpenCamAuthoring();
        });
        await page.waitForSelector('.cam-auth-overlay .cbm-eb');
        await page.screenshot({ path: `${SCRATCH}/t1089-drill-single-modal.png` });   // VIEWED
        const rows = await page.evaluate(() => {
            const all = [...document.querySelectorAll('.cam-auth-overlay input.cbm-eb[data-mode="expose"]')];
            return { total: all.length, enabled: all.filter((e) => !e.disabled).length,
                enabledKeys: all.filter((e) => !e.disabled).map((e) => e.dataset.fkey) };
        });
        expect(rows.enabled, 'the default drill twin now has EXPOSABLE params (was 0 of 34)').toBeGreaterThan(0);
        expect(rows.enabledKeys, 'and depth + peck are among them — the knobs the universal arm could never expose')
            .toEqual(expect.arrayContaining(['depth', 'peck']));
    });
});
