import { test, expect } from '@playwright/test';

const SCRATCH = 'scratchpad';

// Split from cam-block-native-params-s4b.spec.js at the TIER MIGRATION WORK PACKAGE 3 pass; the 3 pure tests
// moved to tests/node/cam-block-native-params-s4b.test.mjs. This one stayed because it drives
// `window.ddcsEditWizardDef` and reads a live Blockly workspace (`window.__blkws`), plus a screenshot — a genuine
// app+DOM+Blockly dependency.

// a PILL-BASED universal op: execution atoms with `{type:'param'}` socket pills + matching value bindings; opType routes universal.
const pillDef = () => ({
    opType: 'user_pillfork_data', label: 'Pill Fork',
    template: [{ type: 'user_root', params: {}, children: [
        { type: 'feed', params: { rate: { type: 'param', params: { name: 'frate', value: 200 } } } },
        { type: 'move', params: { mode: 'cut', x: 10, y: 20, z: { type: 'param', params: { name: 'mz', value: -3 } }, feed: 500 } },
    ] }],
    bindings: [
        { param: 'frate', blockIndex: 1, key: 'rate', type: 'number', default: 200, label: 'Feed rate', units: 'mm/min' },
        { param: 'mz', blockIndex: 2, key: 'z', type: 'number', default: -3, label: 'Plunge Z', units: 'mm' },
    ],
});

test.describe(() => {
    test.use({ viewport: { width: 1400, height: 1000 } });
    test('S4b integration — opening a pill-based universal op in editWizardDef materializes the cam_table in the workspace', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsEditWizardDef && window.showApp);
        await page.evaluate(async (mk) => {
            const { registerUserOp } = await import('/blocks/userOps.js');
            const def = new Function('return ' + mk)()();
            registerUserOp(def);   // the LIVE registry (getUserDef)
            localStorage.setItem('ddcs_user_ops', JSON.stringify([def]));   // the STORE (listUserOps, which editWizardDef reads)
        }, pillDef.toString());
        await page.evaluate(() => window.ddcsEditWizardDef('user_pillfork_data'));
        // the workspace loads the op with the materialized cam_table (round-trips through Blockly)
        await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).some((b) => b.type === 'cam_table'), { timeout: 8000 });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SCRATCH}/s4b-editwizard-materialized.png` });   // VIEWED — the cam_table appears on customize-open
        const r = await page.evaluate(() => {
            const camTable = window.__blkws.getAllBlocks(false).filter((b) => b.type === 'cam_table').length;
            const camFields = window.__blkws.getAllBlocks(false).filter((b) => b.type === 'cam_field').length;
            return { camTable, camFields };
        });
        expect(r.camTable, 'a cam_table materialized in the workspace on customize-open').toBe(1);
        expect(r.camFields, 'with a cam_field per value binding (frate + mz)').toBe(2);
    });
});
