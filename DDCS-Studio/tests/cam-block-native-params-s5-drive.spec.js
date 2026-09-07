import { test, expect } from '@playwright/test';

const SCRATCH = 'scratchpad';

// BLOCK-NATIVE CAM PARAMS S5.1 — the FORM half, mirroring the pendant S1+S3. A DEDICATED param_field block (Fork B: formfield's
// var-identity match cannot address a (blockIndex,key) value socket), paramFieldsFromStack reader, paramGroupFromBindings
// materializer. Both param_group and param_field EMIT [] → byte-neutral. The FORM family (param_group/param_field) shares one
// colour distinct from the CAM-pendant pink and the Wizard-UI fuchsia. S5.1 = schema + reader + materializer only (no consumer).
//
// Split from cam-block-native-params-s5.spec.js at the tier migration work package 4; its two sibling tests (the pure
// reader/materializer checks) moved to tests/node/cam-block-native-params-s5.test.mjs. This one stayed: it round-trips
// block→stack→block through the REAL Blockly workspace (window.showApp/ddcsLoadBlockStack/window.__blkws), reads block
// fields (EDITABLE, getColour()) off live block instances, and takes a screenshot — genuine app+DOM dependencies.

test.describe(() => {
    test.use({ viewport: { width: 1400, height: 1000 } });
    test('S5.1 — a param_group + 2 param_field round-trip block→stack→block; param READ-ONLY; FORM colour distinct from cam pink + opunit', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsLoadBlockStack && window.showApp && window.ddcsGetBlockProgram);
        await page.evaluate(() => window.showApp('blocks'));
        await page.evaluate(() => {
            window.ddcsLoadBlockStack([
                { type: 'param_group', id: 'pg1', params: { group: 'Cut' }, children: [
                    { type: 'param_field', id: 'pf1', params: { param: 'feed', label: 'Feed rate', widget: 'number', type: 'number', dflt: '200', units: 'mm/min', nmin: '1', nmax: '9999', section: '', help: '', options: '', nstep: '' } },
                    { type: 'param_field', id: 'pf2', params: { param: 'depth', label: 'Depth', widget: 'slider', type: 'number', dflt: '5', units: 'mm', nmin: '0', nmax: '50', section: '', help: '', options: '', nstep: '' } },
                ] },
                { type: 'cam_table', id: 'ct1', params: {}, children: [ { type: 'cam_field', id: 'cf1', params: { param: 'feed', label: '', mode: 'expose', baked: '', units: '', dflt: '', nmin: '', nmax: '' } } ] },   // a cam family peer, to compare colours
                { type: 'opunit', id: 'ou1', params: { opType: 'user_surfacing_data', defV: 0 }, children: [] },   // a Wizard-UI peer
            ]);
        });
        await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).some((b) => b.type === 'param_group'));
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SCRATCH}/s5-param-group.png` });   // VIEW the FORM family
        const r = await page.evaluate(async () => {
            const { workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
            const { childrenOf } = await import('/blocks/userOps.js');
            const back = workspaceToStack(window.__blkws);
            // t2339 — childrenOf, not a bare (bs||[]): a split_horizontal/split_vertical node's `.children` is
            // mouth-keyed, not a plain array (t2337's roundtrip-1319 finding).
            let pg = null; const walk = (bs) => { for (const b of childrenOf(bs)) { if (!b) continue; if (b.type === 'param_group') pg = b; walk(b.uiChildren); walk(b.children); } };
            walk(back);
            const fields = (pg && pg.children || []).map((c) => ({ type: c.type, param: c.params.param, label: c.params.label, widget: c.params.widget }));
            const B = (t) => window.__blkws.getAllBlocks(false).find((b) => b.type === t);
            const pgBlk = B('param_group'), pfBlk = B('param_field'), ctBlk = B('cam_table'), ouBlk = B('opunit');
            const paramField = pfBlk && pfBlk.getField('PARAM');
            return { hasGroup: !!pg, childCount: fields.length, fields,
                paramEditable: paramField ? !!paramField.EDITABLE : null,
                pgColour: pgBlk && pgBlk.getColour(), pfColour: pfBlk && pfBlk.getColour(), camColour: ctBlk && ctBlk.getColour(), opunitColour: ouBlk && ouBlk.getColour() };
        });
        expect(r.hasGroup, 'the param_group survives the round-trip').toBe(true);
        expect(r.childCount, 'both param_field rows survive').toBe(2);
        expect(r.fields[0], 'row 1 = feed / number').toMatchObject({ type: 'param_field', param: 'feed', label: 'Feed rate', widget: 'number' });
        expect(r.fields[1], 'row 2 = depth / slider').toMatchObject({ type: 'param_field', param: 'depth', label: 'Depth', widget: 'slider' });
        expect(r.paramEditable, 'the param routing key is READ-ONLY').toBe(false);
        // the FORM family shares ONE colour, distinct from the CAM pendant pink AND the opunit (Wizard-UI) fuchsia
        expect(r.pfColour, 'param_field shares param_group colour (one family)').toBe(r.pgColour);
        expect(r.pgColour, 'the FORM family is distinct from the CAM pendant').not.toBe(r.camColour);
        expect(r.pgColour, 'and distinct from opunit (Wizard UI)').not.toBe(r.opunitColour);
    });
});
