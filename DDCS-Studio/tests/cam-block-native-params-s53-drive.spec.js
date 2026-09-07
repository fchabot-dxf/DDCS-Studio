import { test, expect } from '@playwright/test';

const SCRATCH = 'scratchpad';

// Split from cam-block-native-params-s53.spec.js at the TIER MIGRATION WORK PACKAGE 3 pass; the 4 pure tests
// moved to tests/node/cam-block-native-params-s53.test.mjs. This one stayed because it drives
// `window.ddcsEditWizardDef` and reads a live Blockly workspace (`window.__blkws.getAllBlocks(false)`) — a genuine
// app+DOM+Blockly dependency.

// a PILL-based op with a CANVAS group (x0/y0 = an xy-pad) + a plain feed — the byte-neutral trap.
const canvasDef = () => ({
    opType: 'user_s53canvas', label: 'S53 Canvas',
    template: [{ type: 'user_root', params: {}, children: [
        { type: 'move', params: { mode: 'cut', x: { type: 'param', params: { name: 'x0', value: 0 } }, y: { type: 'param', params: { name: 'y0', value: 0 } }, z: -3, feed: 500 } },
        { type: 'feed', params: { rate: { type: 'param', params: { name: 'frate', value: 200 } } } },
    ] }],
    bindings: [
        { param: 'x0', blockIndex: 1, key: 'x', type: 'number', default: 0, label: 'X', group: 'pg1', role: 'x', widget: 'xy-pad' },
        { param: 'y0', blockIndex: 1, key: 'y', type: 'number', default: 0, label: 'Y', group: 'pg1', role: 'y' },
        { param: 'frate', blockIndex: 2, key: 'rate', type: 'number', default: 200, label: 'Feed', units: 'mm/min' },
    ],
});

test.describe(() => {
    test.use({ viewport: { width: 1400, height: 1000 } });
    test('S5.3 integration — editWizardDef materializes BOTH a cam_table AND a param_group (composed) in the workspace', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsEditWizardDef && window.showApp);
        await page.evaluate(async (mk) => {
            const { registerUserOp } = await import('/blocks/userOps.js');
            const def = new Function('return ' + mk)()();
            registerUserOp(def);
            localStorage.setItem('ddcs_user_ops', JSON.stringify([def]));   // editWizardDef reads listUserOps (the store)
        }, canvasDef.toString());
        // t2543 (BACKLOG #71 owner ruling) — SEPARATE SLOT: materialize's own canvas target is `param_table`,
        // never `param_group` (the twin's own form-layout declaration, which this op never even carries — it's
        // a pill-authored canvas op, no group_box structure). See paramTable.js's own header for the full account.
        await page.evaluate(() => window.ddcsEditWizardDef('user_s53canvas'));
        await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).some((b) => b.type === 'param_table'), { timeout: 8000 });
        await page.waitForTimeout(300);
        const r = await page.evaluate(() => {
            const all = window.__blkws.getAllBlocks(false);
            return { camTable: all.filter((b) => b.type === 'cam_table').length, paramTable: all.filter((b) => b.type === 'param_table').length, paramFields: all.filter((b) => b.type === 'param_field').length };
        });
        // the FORM half (param_table) materialized; the PENDANT half (cam_table) too since a pill fork routes universal — composed
        expect(r.paramTable, 'a param_table materialized on customize-open').toBe(1);
        expect(r.paramFields, 'with a param_field per value binding (x0/y0/frate)').toBe(3);
        expect(r.camTable, 'and the cam_table composed in (pill fork routes universal)').toBe(1);
    });
});
