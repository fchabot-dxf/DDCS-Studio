import { test, expect } from '@playwright/test';

const SCRATCH = 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad';

// BLOCK-NATIVE CAM PARAMS S1 — the cam_table/cam_field SCHEMAS + camFieldsFromStack reader + round-trip. ENGINE ONLY: both
// blocks emit [] (metadata, like formfield) so emit is byte-identical; the reader mirrors bindingsFromStack; NOT yet consumed
// by the emit path or the modal (that is S2/S4). The advisor's own verify: a cam_table holding 2 cam_field blocks round-trips
// block→stack→block, camFieldsFromStack reads them IN ORDER with mode+label+param, the op emit is BYTE-IDENTICAL, and the
// block renders with the family colour + the read-only param chip.

// A user_root template with a cam_table (2 rows) in the PRESENTATION mouth + a real atom in EXECUTION.
const TEMPLATE = (withTable) => ([{
    type: 'user_root', id: 'ur1', params: {},
    uiChildren: withTable ? [{
        type: 'cam_table', id: 'ct1', params: {}, children: [
            { type: 'cam_field', id: 'cf1', params: { param: 'feed', label: 'Feed rate', mode: 'expose', baked: '', units: 'mm/min', dflt: '', nmin: '1', nmax: '9999' } },
            { type: 'cam_field', id: 'cf2', params: { param: 'depth', label: '', mode: 'bake', baked: '5', units: '', dflt: '', nmin: '', nmax: '' } },
        ],
    }] : [],
    children: [
        { type: 'feed', id: 'f1', params: { rate: 300 } },
        { type: 'move', id: 'm1', params: { mode: 'cut', x: 10, y: 20, z: -3, feed: 500 } },
    ],
}]);

test('S1 — camFieldsFromStack reads the cam_field rows IN ORDER with mode/param/label; and the emit is BYTE-IDENTICAL', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { camFieldsFromStack } = await import('/blocks/userOps.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');
        const withTable = new Function('return ' + mk)()(true);
        const noTable = new Function('return ' + mk)()(false);
        return {
            rows: camFieldsFromStack(withTable),
            emitWith: emitMapped(withTable, activeDialectOpts()).text,
            emitNo: emitMapped(noTable, activeDialectOpts()).text,
        };
    }, TEMPLATE.toString());
    // the reader returns the two rows in mouth order
    expect(r.rows.length, 'two cam_field rows').toBe(2);
    expect(r.rows[0], 'row 1 = feed, exposed, with the pendant label + range').toEqual({ param: 'feed', mode: 'expose', label: 'Feed rate', units: 'mm/min', min: 1, max: 9999 });
    expect(r.rows[1], 'row 2 = depth, baked to 5 (no pendant range)').toEqual({ param: 'depth', mode: 'bake', baked: '5' });
    // BYTE-IDENTICAL: the cam_table + its rows contribute NOTHING to the emit (metadata, like formfield)
    expect(r.emitWith, 'adding the cam_table does not change a single byte of G-code').toBe(r.emitNo);
    expect(r.emitWith, 'and the real atoms still emit').toContain('F300');
});

test('S1 — the reader ignores a mode that is not "bake" (defaults expose) and drops empty inherits', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { camFieldsFromStack } = await import('/blocks/userOps.js');
        const t = [{ type: 'cam_table', id: 't', params: {}, children: [
            { type: 'cam_field', id: 'a', params: { param: 'x', mode: '', label: '', baked: '9', units: '', dflt: '', nmin: '', nmax: '' } },   // empty mode → expose; baked ignored (not bake)
            { type: 'cam_field', id: 'b', params: { param: 'y', mode: 'bake', baked: '', label: '', units: '', dflt: '', nmin: '', nmax: '' } }, // bake but empty baked → no baked key
        ] }];
        return camFieldsFromStack(t);
    });
    expect(r[0], 'empty mode defaults to expose; a non-bake row drops baked').toEqual({ param: 'x', mode: 'expose' });
    expect(r[1], 'bake with empty baked → mode only, no baked key').toEqual({ param: 'y', mode: 'bake' });
});

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
            const back = workspaceToStack(window.__blkws);
            let table = null; const walk = (bs) => { for (const b of (bs || [])) { if (!b) continue; if (b.type === 'cam_table') table = b; if (b.uiChildren) walk(b.uiChildren); if (b.children) walk(b.children); } };
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
