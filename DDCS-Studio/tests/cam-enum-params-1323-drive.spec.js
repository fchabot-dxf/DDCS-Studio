import { test, expect } from '@playwright/test';

// Split from cam-enum-params-1323.spec.js at the TIER MIGRATION WORK PACKAGE 3 pass; the 6 pure tests moved to
// tests/node/cam-enum-params-1323.test.mjs. This one stayed because it drives the real macrosApp/CAM authoring
// modal DOM — `window.ddcsSetBlockProgram`, `window.showApp('macros')`, `window.ddcsOpenCamAuthoring`,
// `document.querySelector('tr[data-fkey="zMode"]')`, a real `<select>`'s `.options` — a genuine app+DOM dependency.
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test('THE TABLE DRAWS IT — a dropdown in the Value column, BAKE preselected, branch offered with its reason', async ({ page }) => {
    await boot(page);
    // Drive the REAL surface: the op menu's "Build CAM slot" on a Surfacing op, exactly as the user did.
    await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const P = uo.defaultParams(uo.getUserDef('user_surfacing_data'));
        window.ddcsSetBlockProgram && window.ddcsSetBlockProgram([{ type: 'op', opType: 'user_surfacing_data', params: P, children: builderOf('user_surfacing_data')(P) }]);
    });
    await page.evaluate(() => window.showApp && window.showApp('macros'));
    await page.waitForTimeout(1200);
    const r = await page.evaluate(async () => {
        // the app's OWN entry point — the one the op menu's "Build CAM slot" item calls, with the real op record
        await import('/ui/macrosApp.js').then((m) => m.initMacrosApp());
        const uo = await import('/blocks/userOps.js');
        const P = uo.defaultParams(uo.getUserDef('user_surfacing_data'));
        window.ddcsOpenCamAuthoring({ opType: 'user_surfacing_data', params: P, label: 'Surfacing' });
        await new Promise((res) => setTimeout(res, 900));
        const row = document.querySelector('tr[data-fkey="zMode"]');
        if (!row) return { row: false, entry: !!window.ddcsOpenCamAuthoring, rows: Array.from(document.querySelectorAll('tr[data-fkey]')).map((t) => t.dataset.fkey) };
        const sel = row.querySelector('select.cbm-build');
        const expose = row.querySelector('input[data-mode="expose"]');
        const bake = row.querySelector('input[data-mode="bake"]');
        return {
            row: true,
            options: sel ? Array.from(sel.options).map((o) => o.value) : null,
            exposeDisabled: expose ? expose.disabled : null,
            exposeChecked: expose ? expose.checked : null,
            bakeChecked: bake ? bake.checked : null,
            exposeReason: expose ? (expose.closest('label') || {}).title : null,
            bakeDisabled: bake ? bake.disabled : null,
            slotCell: row.lastElementChild ? row.lastElementChild.textContent.trim() : null,
        };
    });
    expect(r.row, `the zMode row is drawn — the row the screenshot was missing: ${JSON.stringify(r)}`).toBe(true);
    expect(r.options, 'a dropdown of the def’s own modes, in the Value column').toEqual(['normal', 'skim']);
    // AMENDED (user, live): two arms fit the budget, so "Expose as branch" is OFFERED — but BAKE is preselected, so the
    // slot carries one shape until someone consciously opts into carrying both.
    expect(r.exposeDisabled, 'branch-expose is available for a 2-arm enum').toBe(false);
    expect(r.exposeReason, 'and the control explains what it does').toMatch(/branch/i);
    expect(r.bakeChecked, 'BAKE is the preselected default — the choice is visible and conscious').toBe(true);
    expect(r.exposeChecked, 'nothing carries possibility-space by default').toBe(false);
    expect(r.bakeDisabled, 'and bake stays available').toBe(false);
    expect(r.slotCell, 'the slot column names the shape being built').toMatch(/built as/i);
});
