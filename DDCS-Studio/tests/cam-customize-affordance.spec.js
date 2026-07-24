import { test, expect } from '@playwright/test';

const SCRATCH = 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad';

// t1073 S4-Part2 — the CUSTOMIZE AFFORDANCE: fork a recognized CAM-generator twin (surfacing/pocket/corner/edge/slot/drill/
// bore/middle) into editable blocks (editWizardDef wraps a recognized-at-default op in an opunit sub-stack boundary) from
// (A) the op right-click menu, (B) the wizard library (Blocks/Library manager), (B2) the MACRO CAM Pack Builder toolbar.

test('A — op menu: a placed CAM twin shows "Customize as blocks" → routes to ddcsEditWizardDef; a universal custom op does not', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { showOpMenu, hideOpMenu } = await import('/ui/opContextMenu.js');
        const { userOpFromStack, registerUserOp } = await import('/blocks/userOps.js');
        // a recognized CAM twin (surfacing, seeded at boot) + a genuine universal custom op
        registerUserOp(userOpFromStack('cust_uni', 'Custom', [{ type: 'user_root', params: {}, children: [{ type: 'feed', params: { rate: 200 } }] }], []));
        const surfOp = { id: 's1', type: 'op', opType: 'user_surfacing_data', label: 'Surface', params: {} };
        const custOp = { id: 'c1', type: 'op', opType: 'user_cust_uni', label: 'Custom', params: {} };
        window.ddcsGetBlockProgram = () => [surfOp, custOp];
        let called = null; window.ddcsEditWizardDef = (t) => { called = t; };
        const labelsFor = (op) => { showOpMenu(op, 100, 100); const ls = [...document.querySelectorAll('.op-ctx-item')].map((b) => b.textContent); return ls; };
        const surfLabels = labelsFor(surfOp);
        const custLabels = labelsFor(custOp);
        showOpMenu(surfOp, 100, 100);   // leave the surfacing menu open for the VIEWED screenshot
        return {
            surfLabels,
            surfHasCustomize: surfLabels.some((l) => /Customize as blocks/.test(l)),
            custHasCustomize: custLabels.some((l) => /Customize as blocks/.test(l)),
        };
    });
    await page.screenshot({ path: `${SCRATCH}/cam-customize-opmenu.png` });   // VIEWED — the op menu with Customize as blocks
    const called = await page.evaluate(async () => {
        const { showOpMenu, hideOpMenu } = await import('/ui/opContextMenu.js');
        let c = null; window.ddcsEditWizardDef = (t) => { c = t; };
        showOpMenu({ id: 's1', type: 'op', opType: 'user_surfacing_data', label: 'Surface', params: {} }, 100, 100);
        const btn = [...document.querySelectorAll('.op-ctx-item')].find((b) => /Customize as blocks/.test(b.textContent));
        if (btn) btn.click();
        hideOpMenu();
        return c;
    });
    expect(r.surfHasCustomize, 'a recognized CAM twin shows Customize as blocks').toBe(true);
    expect(r.custHasCustomize, 'a universal custom op does NOT (not a CAM-generator twin)').toBe(false);
    expect(called, 'clicking Customize routes to ddcsEditWizardDef with the twin opType').toBe('user_surfacing_data');
});

// Door B (unhide the recognized twins in the Blocks "Define Custom Wizard" list) was DROPPED (user t1073 amendment):
// redundant with A (STUDIO) + the MACRO-tab entry (both already take you into Blocks) and it clutters the build-a-new-wizard
// list. The customize doors are A (op menu) + the MACRO-tab Customize-op button + C (the placed-op Save fork route wrap).

test('B2 — MACRO CAM builder: the Customize-op button + picker lists recognized program ops → ddcsEditWizardDef', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.showApp);
    await page.evaluate(async () => {
        window.ddcsGetBlockProgram = () => [{ id: 's1', type: 'op', opType: 'user_surfacing_data', label: 'Surface', params: {} }];
        (await import('/ui/macrosApp.js')).initMacrosApp();
        window.showApp('macros');
        window.__ewd = null; window.ddcsEditWizardDef = (t) => { window.__ewd = t; };
    });
    await page.waitForSelector('#cam_customize_op', { state: 'attached' });
    await page.evaluate(() => document.getElementById('cam_customize_op').click());   // DOM click (bypasses sub-tab visibility)
    await page.waitForSelector('.cam-sim-overlay #cbm_custsel');
    await page.screenshot({ path: `${SCRATCH}/cam-customize-picker.png` });   // VIEWED — the MACRO Customize-op picker
    const opts = await page.evaluate(() => [...document.querySelectorAll('#cbm_custsel option')].map((o) => o.value));
    await page.click('.cam-sim-overlay [data-cbm="ok"]');
    const ewd = await page.evaluate(() => window.__ewd);
    expect(opts, 'the picker lists the recognized surfacing twin from the program').toContain('user_surfacing_data');
    expect(ewd, 'selecting an op → ddcsEditWizardDef with its opType').toBe('user_surfacing_data');
});

test.describe(() => {
    test.use({ viewport: { width: 1400, height: 1000 } });
    test('VIEWED — Customize a surfacing op (via ddcsEditWizardDef, the contract A/B/B2 all trigger) opens Blocks WITH the opunit chip', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsEditWizardDef && window.showApp && window.ddcsLoadBlockStack);
        await page.evaluate(() => window.ddcsEditWizardDef('user_surfacing_data'));   // editWizardDef switches to Blocks + loads the opunit-wrapped op
        await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).some((b) => b.type === 'opunit'), { timeout: 12000 });
        await page.waitForTimeout(500);
        const chip = await page.evaluate(() => {
            const b = window.__blkws.getAllBlocks(false).find((x) => x.type === 'opunit');
            const lf = b && b.getField('OPUNIT_LABEL');
            return { hasOpunit: !!b, chipLabel: lf ? lf.getText() : null, opType: b && b.getFieldValue('OPTYPE') };
        });
        await page.screenshot({ path: `${SCRATCH}/cam-customize-blocks.png` });   // VIEWED (ACCEPT, gated to the advisor)
        expect(chip.hasOpunit, 'Customize opens Blocks with the opunit boundary chip (the standard part stays live in CAM)').toBe(true);
        expect(chip.chipLabel, 'the chip shows the friendly Surfacing label').toMatch(/unit$/i);
        expect(chip.opType, 'the opunit wraps the surfacing twin').toBe('user_surfacing_data');
    });
});
