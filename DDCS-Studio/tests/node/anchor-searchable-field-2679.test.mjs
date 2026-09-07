import { test, expect } from './support/harness.mjs';

/**
 * t2679 (Phase 2 board, proposal (a), owner-designed authoring face, FINAL scope = amendment 3) —
 * `point_handle`/`rect_handle`'s own `ax`/`ay` is a SEARCHABLE VALUE FIELD (`anchorValueField.js`,
 * `field_anchor_value` — its own header carries the full design): type a number, it commits as a number; type
 * letters, it searches THIS DEF'S OWN bound form params (shown by their own FORM LABEL) plus THIS DEF'S OWN
 * preview markers (`simstart` rows, t2585's own `id`), and commits ONLY from that closed list — no controller
 * `#N` var, no stock/setup world, by construction (neither is ever offered). See the sibling
 * tests/anchor-searchable-field-2679-drive.spec.js for the two tests that round-trip a REAL Blockly workspace
 * (rendered SVG field text) and its own full header comment.
 *
 * TIER MIGRATION WORK PACKAGE B: split out of tests/anchor-searchable-field-2679.spec.js — these are the two
 * "SCRATCH BUILD" tests in that 5-test file, which build a def object and call `layoutSpecFromOp` directly
 * (no Blockly workspace, no DOM) to prove the resolved handle position — pure logic. The other three all
 * construct/read a REAL Blockly workspace (`Blockly.getMainWorkspace()`, `getField().getText()` reading
 * rendered SVG) and stay in the drive file. `boot(page)`'s own `window.showApp('blocks')` +
 * `window.__blkws` wait is dropped here too — these two tests never touch the Blocks workspace, only
 * `page.goto()` (which the node tier needs to publish `window.ddcsGetSettings`).
 */

test('SCRATCH BUILD: ax naming an existing form param re-resolves against WHATEVER live params layoutSpecFromOp is called with -- the handle actually MOVES; a plain literal number is unaffected', async ({ page }) => {
    await page.goto('http://localhost:3211');
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
    await page.goto('http://localhost:3211');
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
