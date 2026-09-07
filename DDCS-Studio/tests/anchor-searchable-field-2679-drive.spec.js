import { test, expect } from '@playwright/test';

/**
 * t2679 (Phase 2 board, proposal (a), owner-designed authoring face, FINAL scope = amendment 3) — PROVING
 * THE MECHANISM. `point_handle`/`rect_handle`'s own `ax`/`ay` is a SEARCHABLE VALUE FIELD
 * (`anchorValueField.js`, `field_anchor_value` — its own header carries the full design): type a number, it
 * commits as a number; type letters, it searches THIS DEF'S OWN bound form params (shown by their own FORM
 * LABEL) plus THIS DEF'S OWN preview markers (`simstart` rows, t2585's own `id`), and commits ONLY from that
 * closed list — no controller `#N` var, no stock/setup world, by construction (neither is ever offered).
 *
 * TWO things proven here, matching the dispatch's own VERIFY checklist (re-scoped from the earlier, now-
 * shelved reporter-block design — see `pointHandle.js`/`rectHandle.js`'s own headers for what changed and
 * why): the field round-trips on a real def (a REAL Blockly workspace, `value-fidelity-1520.spec.js`'s own
 * `stackToWorkspace`/`workspaceToStack` pattern), and BOTH offers (a literal number, a named form param, a
 * named marker) actually drive a live handle in a scratch build.
 *
 * See the sibling tests/node/anchor-searchable-field-2679.test.mjs for the two "SCRATCH BUILD" tests (pure
 * `layoutSpecFromOp` logic, no Blockly workspace) moved to the node tier at tier-migration work package B.
 * The two tests below stay here — both read a REAL Blockly workspace's rendered field text
 * (`getField().getText()`), which requires a real SVG render the node tier's stub cannot provide.
 */

test.use({ viewport: { width: 1400, height: 950 } });

const inBlocks = async (page) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForTimeout(2200);
};

test('a rect_handle whose AX field names an existing form param round-trips through a REAL Blockly workspace, twice, showing the FORM LABEL not the raw name', async ({ page }) => {
    await inBlocks(page);
    const r = await page.evaluate(async () => {
        const SB = await import('/blocks/blockly/stackBridge.js');
        const ws = Blockly.getMainWorkspace();
        // a real formfield ('boxw', form label 'Width') elsewhere in the stack -- the SAME candidate the
        // field's own search offers -- PLUS the rect_handle naming it directly (bypassing the popup UI, same
        // programmatic-construction convention value-fidelity-1520.spec.js's own roundTrip() helper uses).
        const stack = [
            { type: 'feature_canvas', params: {}, children: [
                { type: 'rect_handle', params: { field: 'boxw', fieldH: 'boxh', ax: 'boxw', ay: 12, sx: '1', sy: '1', minw: '', maxw: '', minh: '', maxh: '', valueField: 'field', cornerParam: '', label: 'W×H' } },
            ] },
            { type: 'param_group', params: { group: 'Test' }, children: [
                { type: 'formfield', params: { param: 'boxw', label: 'Width', dflt: '40', bindMode: 'opparam', atomType: 'progstart', key: 'clearance', type: 'number' } },
            ] },
        ];
        ws.clear();
        SB.stackToWorkspace(stack, ws);
        const rh1 = ws.getAllBlocks(false).find((b) => b.type === 'rect_handle');
        const axField1 = rh1.getField('AX');
        const round1 = {
            axValue1: axField1.getValue(), axText1: axField1.getText(),
            ayValue1: rh1.getField('AY').getValue(),
        };
        const back1 = SB.workspaceToStack(ws);

        // a SECOND pass -- the real save -> close -> reopen shape (mirrors the form_variable-era test's own
        // structure, which caught a disposal-order bug there; reading round1 values BEFORE this clear avoids it).
        ws.clear();
        SB.stackToWorkspace(back1, ws);
        const rh2 = ws.getAllBlocks(false).find((b) => b.type === 'rect_handle');
        const round2 = { axValue2: rh2.getField('AX').getValue(), axText2: rh2.getField('AX').getText() };
        const back2 = SB.workspaceToStack(ws);

        return { ...round1, ...round2, back1Ax: back1[0].children[0].params.ax, back1Ay: back1[0].children[0].params.ay, back2Ax: back2[0].children[0].params.ax };
    });
    expect(r.axValue1, 'the AX field commits the RAW param NAME (a string), not a re-derived number').toBe('boxw');
    expect(r.axText1, 'the block FACE shows the param\'s own FORM LABEL ("Width"), not the raw name ("boxw")').toBe('Width');
    expect(r.ayValue1, 'AY stays a plain literal NUMBER, unaffected by the searchable field on the OTHER axis').toBe(12);
    expect(r.back1Ax, 'workspaceToStack (save) re-serializes the SAME name string').toBe('boxw');
    expect(r.back1Ay, 'AY serializes back to the plain number').toBe(12);
    expect(r.axValue2, 'RELOADING the saved record still commits the same name (stable across repeat round-trips)').toBe('boxw');
    expect(r.axText2, 'and still resolves the SAME form label on reload').toBe('Width');
    expect(r.back2Ax).toBe('boxw');
});

test('a point_handle whose AX field names an existing sim-start MARKER round-trips as the marker id, showing it as its own face text', async ({ page }) => {
    await inBlocks(page);
    const r = await page.evaluate(async () => {
        const SB = await import('/blocks/blockly/stackBridge.js');
        const ws = Blockly.getMainWorkspace();
        const stack = [{ type: 'feature_canvas', params: {}, children: [
            { type: 'point_handle', params: { fx: 'px', fy: 'py', ax: 'wall1', ay: 0, relToRow: '', label: 'pos' } },
            { type: 'simstart', params: { id: 'wall1', anchor: 'centre' } },
        ] }];
        ws.clear();
        SB.stackToWorkspace(stack, ws);
        const ph = ws.getAllBlocks(false).find((b) => b.type === 'point_handle');
        const axField = ph.getField('AX');
        const out = { axValue: axField.getValue(), axText: axField.getText() };
        const back = SB.workspaceToStack(ws);
        out.backAx = back[0].children[0].params.ax;
        return out;
    });
    expect(r.axValue, 'a marker id commits as its own string, same shape as a param name').toBe('wall1');
    expect(r.axText, 'the face shows the marker\'s own id (markers have no separate "form label")').toBe('wall1');
    expect(r.backAx).toBe('wall1');
});
