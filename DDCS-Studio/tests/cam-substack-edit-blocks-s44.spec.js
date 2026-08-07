import { test, expect } from '@playwright/test';

/**
 * S4-4 — extend the S4-2 "Edit loads the op into the editor" to a single-op SUBSTACK slot (slot.ops[0].type ===
 * 'substack'). The SAME ddcsEditWizardDef path (getUserDef → makeOp) reconstructs it: the opunit boundary keeps the
 * standard sub-unit LIVE (parametric) while the custom atoms are editable. Generators + multi-op (S4-5) are NOT touched.
 * The S4-3 round-trip applies unchanged.
 */
test.use({ viewport: { width: 1280, height: 900 } });

test('Edit a SUBSTACK slot loads its opunit-wrapped op into the editor (Blocks shows the structure, standard part live)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsEditWizardDef);

    // Build a SUBSTACK user op: the surfacing twin's exec atoms WRAPPED in an opunit (the standard part stays live), then a
    // CAM slot referencing it (type 'substack'). The twin (user_surfacing_data) is a boot seed, so it survives clearing user ops.
    const setup = await page.evaluate(async () => {
        const dev = await import('/blocks/devMode.js');
        const U = await import('/blocks/userOps.js');
        localStorage.removeItem('ddcs_user_ops');
        const w = dev.wrapRecognizedForFork(U.getUserDef('user_surfacing_data'));   // → template: [user_root → opunit(...)]
        U.createUserOp(U.userOpFromStack('mysub', 'My Substack', w.template, []));   // the wrapped template (user_root → opunit) IS the new op's template
        localStorage.setItem('ddcs_campack', JSON.stringify({ meta: { name: 't', baseSlot: 22 }, slots: [
            { slot: 22, name: 'Sub', body: 'PLACEHOLDER', fields: [], ops: [{ type: 'substack', variant: '', values: {}, exposed: {}, baked: {}, opType: 'user_mysub', defV: U.defVOf('user_mysub') }] },
        ] }));
        const t = (U.getUserDef('user_mysub').template || []);
        const r = t.find((b) => b && b.type === 'user_root');
        return { hasDef: !!U.getUserDef('user_mysub'), hasOpunit: !!(r && (r.children || []).some((c) => c.type === 'opunit')) };
    });
    expect(setup.hasDef && setup.hasOpunit, 'the substack op registered with an opunit boundary: ' + JSON.stringify(setup)).toBe(true);

    // reload → a fresh boot reads the persisted op + campack; initMacrosApp renders from the campack (clean editor → no confirm)
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsEditWizardDef && window.showApp);
    await page.evaluate(async () => { (await import('/ui/macrosApp.js')).initMacrosApp(); });
    await page.evaluate(() => window.showApp('macros'));
    await page.waitForSelector('#macros-app .settings-tab[data-target="macros_panel_cam"]');
    await page.evaluate(() => document.querySelector('#macros-app .settings-tab[data-target="macros_panel_cam"]').click());
    await page.waitForSelector('#cam_slots .cam-slot [data-act="editslot"]', { state: 'visible' });

    await page.click('#cam_slots .cam-slot [data-act="editslot"]');
    // the substack op loads into Blocks: an op block in the program + the opunit boundary present (the standard sub-unit, LIVE)
    await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).some((b) => b.type === 'opunit'), { timeout: 12000 });
    expect(await page.evaluate(() => window.__blkws.getAllBlocks(false).some((b) => b.type === 'opunit')),
        'the opunit (standard sub-unit, kept LIVE) loaded in the Blocks workspace').toBe(true);
    expect(await page.evaluate(() => (window.ddcsGetBlockProgram() || []).some((b) => b.type === 'op')),
        'the substack op loaded into the editor program').toBe(true);
    // t1587 — AWAIT the modal, don't sample for it. `editCamSlot` does `await ddcsEditWizardDef(...)` and only THEN
    // `openCamAuthoring()`, so the overlay lands strictly after the Blocks load this test already waited on. Once the
    // palette grew (the wizards-as-data UI blocks), that load crossed the sampling instant and this read false — a
    // race in the assertion, not a break: measured, the overlay does appear, ~1-2s after the click.
    await expect(page.locator('.cam-auth-overlay'), 'the pendant modal opened too (Edit still opens the modal)')
        .toBeVisible({ timeout: 15000 });

    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
