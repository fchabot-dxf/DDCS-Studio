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

test('SCRATCH BUILD: ax naming an existing form param re-resolves against WHATEVER live params layoutSpecFromOp is called with -- the handle actually MOVES; a plain literal number is unaffected', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
        const real = [
            { param: 'boxw', type: 'number', match: { type: 'progstart' }, key: 'clearance', default: 40, blockIndex: 0 },
            { param: 'boxh', type: 'number', match: { type: 'progend' }, key: 'retractZ', default: 30, blockIndex: 1 },
        ];
        // NAMED: ax follows boxh's own LIVE value (a real author move -- "this rect's anchor tracks another
        // already-bound param"), not a fixed literal.
        const fcNamed = { type: 'feature_canvas', params: {}, children: [
            { type: 'rect_handle', params: { field: 'boxw', fieldH: 'boxh', ax: 'boxh', ay: 0, sx: '1', sy: '1', minw: '', maxw: '', minh: '', maxh: '', valueField: 'field', cornerParam: '', label: 'W×H' } },
        ] };
        const anchorsN = U.handleBindingsFromStack([fcNamed], real);
        if (anchorsN.some((h) => h.anchorUnresolved)) throw new Error('named scratch def: rect_handle target unresolved -- ' + JSON.stringify(anchorsN));
        const defN = { opType: 'scratch_rect_named_ax', bindings: U.mergeHandleAnchors(real, anchorsN) };
        const handleOf = (spec) => (spec.handles || []).find((h) => h.kind === 'size') || null;
        const hLow = handleOf(layoutSpecFromOp(defN, { boxw: 40, boxh: 30 }));
        const hHigh = handleOf(layoutSpecFromOp(defN, { boxw: 40, boxh: 99 }));

        // LITERAL (baseline): ax stays a plain number, the pre-t2679 shape.
        const fcLiteral = { type: 'feature_canvas', params: {}, children: [
            { type: 'rect_handle', params: { field: 'boxw', fieldH: 'boxh', ax: 5, ay: 3, sx: '1', sy: '1', minw: '', maxw: '', minh: '', maxh: '', valueField: 'field', cornerParam: '', label: 'W×H' } },
        ] };
        const anchorsL = U.handleBindingsFromStack([fcLiteral], real);
        if (anchorsL.some((h) => h.anchorUnresolved)) throw new Error('literal scratch def: rect_handle target unresolved');
        const defL = { opType: 'scratch_rect_literal_ax', bindings: U.mergeHandleAnchors(real, anchorsL) };
        const hLit = handleOf(layoutSpecFromOp(defL, { boxw: 40, boxh: 30 }));

        return { hLowX: hLow && hLow.x, hHighX: hHigh && hHigh.x, hLitX: hLit && hLit.x, hLitY: hLit && hLit.y };
    });
    // handle.x = ax + ex*sx (sx=1) -- the SAME composition rect-handle-block.spec.js's own t2525 test already pins.
    expect(r.hLowX, 'ax follows boxh(30) live via the named search field: 30 (ax) + 40 (boxw, ex)').toBe(70);
    expect(r.hHighX, 'the SAME named field, re-resolved against DIFFERENT live params: 99 (ax) + 40 (boxw)').toBe(139);
    expect(r.hHighX - r.hLowX, 'the handle MOVED by exactly the live param delta (69) -- re-resolved fresh, not frozen at merge time').toBe(69);
    expect(r.hLitX, 'the LITERAL number is unaffected by the named-field mechanism: ax=5 + boxw(ex)=40').toBe(45);
    expect(r.hLitY, 'ay likewise stays the plain literal 3, plus boxh(ey)=30').toBe(33);
});

test('SCRATCH BUILD: ax naming an existing preview MARKER resolves via the SAME live sim-start lookup relToRow already uses (corner\'s own registered wall1 row, an INDEPENDENT truth)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsGetSettings);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
        const CD = await import('/blocks/dataOps/cornerData.js');
        const { opSimStarts, resolveRelToIndex } = await import('/viz/opSimStarts.js');
        localStorage.removeItem('ddcs_user_ops');
        const realDef = CD.cornerDataDef();
        U.createUserOp(realDef);   // registers CORNER_DATA_OPTYPE's own sim-start ROWS (incl. 'wall1') live

        // corner's OWN cross1_x/cross1_y bindings, group/role STRIPPED (t2677's own established precaution,
        // corner-relto-declared-parity-2677.spec.js) -- else the OLD role-tagged fallback branch renders ITS
        // OWN "reposition_pos" handle from the UNTOUCHED originals alongside the new point_handle's own, and
        // `.find(kind==='move')` silently grabs whichever rendered first, not the one this test means to probe.
        const stripped = realDef.bindings.map((b) => {
            if (b.param === 'cross1_x' || b.param === 'cross1_y') { const { group, role, ...rest } = b; return rest; }
            return b;
        });
        // fresh, ISOLATED params (markx/marky, default 0) for the handle's own fx/fy -- deliberately NOT
        // cross1_x/y (whose non-zero defaults would fold into the composed handle.x/y and hide whether ax/ay's
        // own marker resolution is what moved it).
        const bindings = [...stripped,
            { param: 'markx', type: 'number', match: { type: 'progstart' }, key: 'clearance', default: 0, blockIndex: 900 },
            { param: 'marky', type: 'number', match: { type: 'progend' }, key: 'retractZ', default: 0, blockIndex: 901 },
        ];
        const fc = { type: 'feature_canvas', params: {}, children: [
            { type: 'point_handle', params: { fx: 'markx', fy: 'marky', ax: 'wall1', ay: 'wall1', relToRow: '', label: 'pos' } },
        ] };
        const anchors = U.handleBindingsFromStack([fc], bindings);
        if (anchors.some((h) => h.anchorUnresolved)) throw new Error('marker scratch def: point_handle target unresolved -- ' + JSON.stringify(anchors));
        const scratchDef = { ...realDef, bindings: U.mergeHandleAnchors(bindings, anchors) };
        const p = { ...U.defaultParams(scratchDef), ...CD.CORNER_DEFAULTS, travelDist: 50 };
        const spec = layoutSpecFromOp(scratchDef, p);
        const h = (spec.handles || []).find((hh) => hh.kind === 'move');

        const idx = resolveRelToIndex(realDef.opType, p, { row: 'wall1' });
        const s = window.ddcsGetSettings().stock;
        const marks = opSimStarts(realDef.opType, p, s) || [];
        const m = marks[idx];

        localStorage.removeItem('ddcs_user_ops');
        return { hx: h && h.x, hy: h && h.y, mx: m && m.x, my: m && m.y, idx };
    });
    expect(r.idx, 'wall1 actually resolved to a real sim-start index').not.toBeNull();
    expect(r.mx, 'the independent marker lookup itself found a real position').not.toBeUndefined();
    // markx/marky both default 0, so handle.x/y === ax/ay's OWN resolved value exactly (no composition to strip).
    expect(r.hx, 'ax="wall1" resolves to the SAME world x the independent opSimStarts lookup finds').toBeCloseTo(r.mx, 6);
    expect(r.hy, 'ay="wall1" resolves to the SAME world y (both axes independently name the marker)').toBeCloseTo(r.my, 6);
});
