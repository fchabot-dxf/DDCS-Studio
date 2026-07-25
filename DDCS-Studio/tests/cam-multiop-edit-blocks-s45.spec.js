import { test, expect } from '@playwright/test';

/**
 * S4-5 (the last S4 slice) — MULTI-OP composed slots. Edit a slot with >1 block-able (universal/substack) op → reconstruct
 * EACH op + load the CONCAT into Blocks as one program (ddcsEditWizardDefs), guarded by the S4-1 destructive-load guard.
 * A MIXED slot (block-able + generator ops) loads ONLY the block-able ops + an "N of M" hint; the generator parts stay
 * parametric in the modal. The S4-3 round-trip applies per referenced def (edit an op via its op-menu → its def-save
 * rebuilds the slot). Deliberately NO single-op editing chrome for the concat (flagged — see WORK-LOG t1155).
 */
test.use({ viewport: { width: 1280, height: 900 } });

const mkUniv = (name, x) => ({ name, x });
async function registerUnivOps(page, ops) {
    await page.evaluate(async (list) => {
        const U = await import('/blocks/userOps.js');
        localStorage.removeItem('ddcs_user_ops');
        for (const o of list) {
            const t = [{ type: 'move', params: { x: o.x, y: 0, z: { type: 'param', params: { name: 'depth', value: -5 } } } }];
            U.createUserOp(U.userOpFromStack(o.name, o.name, t, U.extractParamBlocks(t)));
        }
    }, ops);
}
async function openCamTab(page) {
    await page.evaluate(async () => { (await import('/ui/macrosApp.js')).initMacrosApp(); });
    await page.waitForFunction(() => window.showApp && window.ddcsGetBlockProgram && window.ddcsEditWizardDef && window.ddcsEditWizardDefs);
    await page.evaluate(() => window.showApp('macros'));
    await page.waitForSelector('#macros-app .settings-tab[data-target="macros_panel_cam"]');
    await page.evaluate(() => document.querySelector('#macros-app .settings-tab[data-target="macros_panel_cam"]').click());
    await page.waitForSelector('#cam_slots .cam-slot [data-act="editslot"]', { state: 'visible' });
}
const uOp = (opType) => ({ type: 'universal', variant: '', values: {}, exposed: {}, baked: {}, opType, defV: 1 });

test('Edit a MULTI-op universal slot loads BOTH ops into Blocks (the composed slot as a concat)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await registerUnivOps(page, [mkUniv('opa', 1), mkUniv('opb', 2)]);
    await page.evaluate((slots) => localStorage.setItem('ddcs_campack', JSON.stringify({ meta: { name: 't', baseSlot: 22 }, slots })),
        [{ slot: 22, name: 'Composed', body: 'X', fields: [], ops: [uOp('user_opa'), uOp('user_opb')] }]);
    await page.goto('http://localhost:3211');   // reload → fresh boot reads the ops + campack
    await openCamTab(page);

    await page.click('#cam_slots .cam-slot [data-act="editslot"]');
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).filter((b) => b.type === 'op').length === 2, { timeout: 12000 });
    expect(await page.evaluate(() => (window.ddcsGetBlockProgram() || []).filter((b) => b.type === 'op').length),
        'both universal ops loaded into Blocks as a concat').toBe(2);
    expect(await page.evaluate(() => !!document.querySelector('.cam-auth-overlay')), 'the pendant modal opened too').toBe(true);

    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test('Edit a MIXED slot (universal + generator) loads ONLY the universal + shows an N-of-M hint', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await registerUnivOps(page, [mkUniv('opu', 1)]);
    await page.evaluate((slots) => localStorage.setItem('ddcs_campack', JSON.stringify({ meta: { name: 't', baseSlot: 22 }, slots })),
        [{ slot: 22, name: 'Mixed', body: 'X', fields: [], ops: [uOp('user_opu'), { type: 'pocket', variant: 'x', values: {}, exposed: {}, baked: {}, opType: 'pocket' }] }]);
    await page.goto('http://localhost:3211');
    await openCamTab(page);

    await page.click('#cam_slots .cam-slot [data-act="editslot"]');
    // only the universal loaded (1 op block); the generator stays parametric
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).filter((b) => b.type === 'op').length === 1, { timeout: 12000 });
    expect(await page.evaluate(() => (window.ddcsGetBlockProgram() || []).filter((b) => b.type === 'op').length),
        'only the block-able (universal) op loaded; the generator did not').toBe(1);
    // the "N of M" hint appears (the generator part stays parametric)
    await page.waitForSelector('.app-dialog', { timeout: 8000 });
    expect(await page.evaluate(() => { const d = document.querySelector('.app-dialog'); return d ? /of 2 ops/i.test(d.textContent) : false; }),
        'the "Loaded 1 of 2 ops" hint is shown').toBe(true);

    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
