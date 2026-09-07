import { test, expect } from '@playwright/test';

const SCRATCH = 'scratchpad';

// Split from cam-block-native-params.spec.js (S1) at the TIER MIGRATION WORK PACKAGE 3 pass; the 2 pure tests
// moved to tests/node/cam-block-native-params.test.mjs. This one stayed because it drives a real Blockly
// workspace (`window.__blkws`), `window.ddcsLoadBlockStack`, `window.showApp`, and takes a screenshot — a
// genuine app+DOM+Blockly dependency.
test.describe(() => {
    test.use({ viewport: { width: 1400, height: 1000 } });
    test('S1 — a cam_table + 2 cam_field round-trip block→stack→block IN ORDER; param is READ-ONLY; family colour distinct', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsLoadBlockStack && window.showApp && window.ddcsGetBlockProgram);
        await page.evaluate(() => window.showApp('blocks'));
        await page.evaluate(() => {
            window.ddcsLoadBlockStack([
                { type: 'cam_table', id: 'ct1', params: {}, children: [
                    { type: 'cam_field', id: 'cf1', params: { param: 'feed', label: 'Feed rate', mode: 'expose', baked: '', units: 'mm/min', dflt: '', nmin: '1', nmax: '9999' } },
                    { type: 'cam_field', id: 'cf2', params: { param: 'depth', label: '', mode: 'bake', baked: '5', units: '', dflt: '', nmin: '', nmax: '' } },
                ] },
                { type: 'param_group', id: 'pg1', params: { group: 'Settings' }, children: [] },   // a Wizard-UI peer, to compare colours
            ]);
        });
        await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).some((b) => b.type === 'cam_table'));
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SCRATCH}/s1-cam-table.png` });   // VIEW how the family renders
        const r = await page.evaluate(async () => {
            const { workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
            const { childrenOf } = await import('/blocks/userOps.js');
            const back = workspaceToStack(window.__blkws);
            // t2339 — childrenOf, not a bare (bs||[]): a split_horizontal/split_vertical node's `.children` is
            // mouth-keyed, not a plain array (t2337's roundtrip-1319 finding).
            let table = null; const walk = (bs) => { for (const b of childrenOf(bs)) { if (!b) continue; if (b.type === 'cam_table') table = b; walk(b.uiChildren); walk(b.children); } };
            walk(back);
            const fields = (table && table.children || []).map((c) => ({ type: c.type, param: c.params.param, mode: c.params.mode, label: c.params.label, baked: c.params.baked }));
            const tblBlk = window.__blkws.getAllBlocks(false).find((b) => b.type === 'cam_table');
            const fldBlk = window.__blkws.getAllBlocks(false).find((b) => b.type === 'cam_field');
            const pgBlk = window.__blkws.getAllBlocks(false).find((b) => b.type === 'param_group');
            const paramField = fldBlk && fldBlk.getField('PARAM');
            return {
                hasTable: !!table, childCount: fields.length, fields,
                paramEditable: paramField ? !!paramField.EDITABLE : null,
                tableColour: tblBlk && tblBlk.getColour(), fieldColour: fldBlk && fldBlk.getColour(), pgColour: pgBlk && pgBlk.getColour(),
            };
        });
        // round-trip: the cam_table + its 2 rows survive, IN ORDER, with param/mode/label/baked intact
        expect(r.hasTable, 'the cam_table survives the workspace round-trip').toBe(true);
        expect(r.childCount, 'it keeps both cam_field rows (DO-mouth serialization)').toBe(2);
        expect(r.fields[0], 'row 1 = feed / expose / label').toMatchObject({ type: 'cam_field', param: 'feed', mode: 'expose', label: 'Feed rate' });
        expect(r.fields[1], 'row 2 = depth / bake / baked=5').toMatchObject({ type: 'cam_field', param: 'depth', mode: 'bake', baked: '5' });
        // the read-only param chip
        expect(r.paramEditable, 'the param routing key is READ-ONLY (a hand-edit dangles the binding)').toBe(false);
        // the family colour: cam_table and cam_field share ONE colour, DISTINCT from the Wizard-UI param_group
        expect(r.fieldColour, 'the family shares one colour').toBe(r.tableColour);
        expect(r.tableColour, 'and it is distinct from param_group (the Wizard-UI fuchsia)').not.toBe(r.pgColour);
    });
});
