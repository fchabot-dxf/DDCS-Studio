import { test, expect } from '@playwright/test';

/**
 * t2679 (Phase 2 board, proposal (a)) — THE OWNER REVIEW GATE: per the standing cadence, no op migrates onto
 * this vocabulary this turn; the owner reviews the FACES first. This spec exists SOLELY to produce the real
 * screenshots the dispatch (amendment 3's own final scope) asked for — as a person sees them on the canvas,
 * not a mockup.
 */
test.use({ viewport: { width: 2200, height: 1000 } });

test('t2679 face screenshots: point_handle, rect_handle (a named form param on AX), and the search dropdown open flat with a tie-break hint', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.showApp);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    await page.waitForTimeout(300);

    // load a REAL stack via stackToWorkspace (the SAME mechanism the real save/load path uses, byte-identical
    // to opening a saved wizard like this): point_handle with relToRow set (t2677), rect_handle's own AX
    // naming an EXISTING form param ('originish', form label "Origin X") -- PLUS a sim-start marker
    // DELIBERATELY given the SAME label ("Origin X") so the search dropdown shot below has a genuine tie to
    // show its per-row source hint on (amendment 2's own explicit ask).
    const r = await page.evaluate(async () => {
        const SB = await import('/blocks/blockly/stackBridge.js');
        const ws = window.__blkws;
        const stack = [
            { type: 'feature_canvas', params: {}, children: [
                { type: 'point_handle', params: { fx: 'px', fy: 'py', x: '40', y: '60', ax: 0, ay: 0, relToRow: 'wall1', label: 'pos' } },
                { type: 'rect_handle', params: {
                    field: 'boxw', fieldH: 'boxh', ax: 'originish', ay: 12,
                    sx: '1', sy: '1', minw: '', maxw: '', minh: '', maxh: '', valueField: 'field', cornerParam: 'datumCorner', label: 'W×H',
                } },
            ] },
            { type: 'param_group', params: { group: 'Origin' }, children: [
                { type: 'formfield', params: { param: 'originish', label: 'Origin X', dflt: '0', bindMode: 'opparam', atomType: 'progstart', key: 'clearance', type: 'number' } },
            ] },
            { type: 'simstart', params: { id: 'Origin X', anchor: 'centre' } },
        ];
        ws.clear();
        SB.stackToWorkspace(stack, ws);
        return {
            pointHandleCount: ws.getAllBlocks(false).filter((b) => b.type === 'point_handle').length,
            rectHandleCount: ws.getAllBlocks(false).filter((b) => b.type === 'rect_handle').length,
            axText: ws.getAllBlocks(false).find((b) => b.type === 'rect_handle').getField('AX').getText(),
        };
    });
    expect(r.pointHandleCount, 'the point_handle block actually loaded onto the canvas').toBe(1);
    expect(r.rectHandleCount, 'the rect_handle block actually loaded onto the canvas').toBe(1);
    expect(r.axText, 'rect_handle\'s own AX shows the named param\'s FORM LABEL, not the raw param name').toBe('Origin X');
    await page.waitForTimeout(400);

    const VP = { width: 2200, height: 1000 };
    async function clipShotOfBlock(type, path, margin = 24) {
        await page.evaluate((t) => { const ws = window.__blkws; const blk = ws.getAllBlocks(false).find((b) => b.type === t); ws.centerOnBlock(blk.id, true); }, type);
        await page.waitForTimeout(600);
        const raw = await page.evaluate(({ t, margin }) => {
            const ws = window.__blkws;
            const blk = ws.getAllBlocks(false).find((b) => b.type === t);
            const r = blk.getSvgRoot().getBoundingClientRect();
            return { x: r.x - margin, y: r.y - margin, width: r.width + margin * 2, height: r.height + margin * 2 };
        }, { t: type, margin });
        const x = Math.max(52, raw.x), y = Math.max(0, raw.y);
        const width = Math.min(VP.width - x, raw.width - (x - raw.x));
        const height = Math.min(VP.height - y, raw.height - (y - raw.y));
        await page.screenshot({ path, clip: { x, y, width, height } });
    }
    await clipShotOfBlock('point_handle', 'verification/t2679-point-handle-face.png');
    await clipShotOfBlock('rect_handle', 'verification/t2679-rect-handle-face-named-ax.png', 32);

    // THE SEARCH DROPDOWN OPEN, flat, with a tie-break hint: click rect_handle's own AX field, type "origin"
    // (matching BOTH the form param's own label AND the marker's own id) -- amendment 2's own exact ask.
    async function fieldRect(blockType, fieldName) {
        return page.evaluate(({ blockType, fieldName }) => {
            const ws = window.__blkws;
            const blk = ws.getAllBlocks(false).find((b) => b.type === blockType);
            const f = blk.getField(fieldName);
            const group = f.fieldGroup_ || f.getSvgRoot();
            const el = (group && group.querySelector('text')) || (f.getClickTarget_ && f.getClickTarget_()) || group;
            const r = el.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }, { blockType, fieldName });
    }
    const rect = await fieldRect('rect_handle', 'AX');
    await page.mouse.click(rect.x, rect.y);
    await page.waitForTimeout(300);
    // t2679's own popup container is `.ddcs-field-popup` (dropdownPopup.js's own self-contained floating div —
    // NOT Blockly's native `.blocklyWidgetDiv`/`.blocklyDropDownDiv`, which the vendored UMD build doesn't
    // expose at all; pickerField.js's own popup rides the SAME container).
    await page.waitForSelector('.ddcs-field-popup', { state: 'visible', timeout: 3000 });
    await page.fill('.ddcs-field-popup input[type="text"]', 'origin');
    await page.waitForTimeout(200);
    const popupBox = await page.evaluate(() => {
        const el = document.querySelector('.ddcs-field-popup');
        const r = el.getBoundingClientRect();
        return { x: r.x - 6, y: r.y - 6, width: r.width + 12, height: r.height + 12 };
    });
    await page.screenshot({ path: 'verification/t2679-anchor-search-dropdown-tiebreak.png', clip: popupBox });

    const rowsText = await page.evaluate(() => Array.from(document.querySelectorAll('.ddcs-picker-row')).map((r) => r.textContent));
    expect(rowsText.some((t) => t.includes('·')), 'a genuine label tie (form param vs marker, both "Origin X") shows the per-row source hint').toBe(true);
});
