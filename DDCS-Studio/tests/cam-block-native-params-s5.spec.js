import { test, expect } from '@playwright/test';

const SCRATCH = 'scratchpad';

// BLOCK-NATIVE CAM PARAMS S5.1 — the FORM half, mirroring the pendant S1+S3. A DEDICATED param_field block (Fork B: formfield's
// var-identity match cannot address a (blockIndex,key) value socket), paramFieldsFromStack reader, paramGroupFromBindings
// materializer. Both param_group and param_field EMIT [] → byte-neutral. The FORM family (param_group/param_field) shares one
// colour distinct from the CAM-pendant pink and the Wizard-UI fuchsia. S5.1 = schema + reader + materializer only (no consumer).

test('S5.1 — paramFieldsFromStack reads the param_field rows IN ORDER; the emit is BYTE-IDENTICAL (param_field emits [])', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { paramFieldsFromStack } = await import('/blocks/userOps.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');
        const withGroup = [{ type: 'user_root', params: {}, uiChildren: [
            { type: 'param_group', params: { group: 'Cut' }, children: [
                { type: 'param_field', params: { param: 'feed', label: 'Feed rate', widget: 'number', type: 'number', dflt: '200', units: 'mm/min', nmin: '1', nmax: '9999', section: '', help: '', options: '', nstep: '' } },
                { type: 'param_field', params: { param: 'shape', label: 'Shape', widget: 'dropdown', type: 'enum', dflt: '', options: 'Rect=0, Circle=1', units: '', nmin: '', nmax: '', nstep: '', section: '', help: '' } },
            ] },
        ], children: [
            { type: 'feed', params: { rate: 300 } },
            { type: 'move', params: { mode: 'cut', x: 10, y: 20, z: -3, feed: 500 } },
        ] }];
        const noGroup = JSON.parse(JSON.stringify(withGroup)); noGroup[0].uiChildren = [];
        return {
            rows: paramFieldsFromStack(withGroup),
            emitWith: emitMapped(withGroup, activeDialectOpts()).text,
            emitNo: emitMapped(noGroup, activeDialectOpts()).text,
        };
    });
    expect(r.rows.length, 'two param_field rows in mouth order').toBe(2);
    expect(r.rows[0], 'row 1 = feed, number widget, with the form label + range').toEqual({ param: 'feed', widget: 'number', type: 'number', label: 'Feed rate', default: 200, widgetConfig: { min: 1, max: 9999, units: 'mm/min' } });
    // t1607 — EXPECTATION CHANGED WITH THE RULED CODEC (called out, not smuggled): an ENUM row keeps its declared
    // STRING values through the options parse — numeric coercion belongs to numeric types only (the GUI pill's
    // socket contract, asserted unchanged in gui-param-typed-widgets + enum-options-codec-1607). '0'/'1' here were
    // 0/1 before; the select is behaviourally identical (option values and reads pass through String both ways),
    // and the old coercion is what corrupted every string-valued enum (stockAttach's ['Follow stock datum','']
    // parsed to a single [label, 0] entry and DROPPED the other nine options).
    expect(r.rows[1], 'row 2 = shape, dropdown widget with parsed options (enum → string values)').toEqual({ param: 'shape', widget: 'dropdown', type: 'enum', label: 'Shape', widgetConfig: { options: [['Rect', '0'], ['Circle', '1']] } });
    // BYTE-NEUTRAL: param_group is transparent and param_field emits [] → adding the form blocks changes nothing
    expect(r.emitWith, 'the FORM blocks change not one byte of G-code').toBe(r.emitNo);
    expect(r.emitWith, 'and the real atoms still emit').toContain('F300');
});

test('S5.1 — paramGroupFromBindings: one param_field per value-binding in PRE-ORDER, label/default/widget from the binding', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { userOpFromStack, paramGroupFromBindings, paramFieldsFromStack } = await import('/blocks/userOps.js');
        const def = userOpFromStack('user_s5form', 'S5 Form', [{ type: 'user_root', params: {}, children: [
            { type: 'feed', params: { rate: 200 } },
            { type: 'move', params: { mode: 'cut', x: 10, y: 20, z: -3, feed: 500 } },
        ] }], [
            { param: 'frate', blockIndex: 1, key: 'rate', type: 'number', default: 200, label: 'Feed rate', units: 'mm/min' },
            { param: 'mz', blockIndex: 2, key: 'z', type: 'number', default: -3, label: 'Plunge Z', units: 'mm' },
        ]);
        const pg = paramGroupFromBindings(def);
        // and the reader round-trips the materializer output
        const back = paramFieldsFromStack([{ type: 'user_root', params: {}, uiChildren: [pg], children: [] }]);
        // t1562 — the CONTROL each read-back row resolves to, named via the app's own registry (no parallel table here)
        const FW = await import('/ui/formWidgets.js');
        const nameOf = (fn) => (Object.entries(FW.FORM_WIDGETS).find(([, v]) => v === fn) || ['<unregistered>'])[0];
        const control = back.map((row) => nameOf(FW.resolveFormWidget(row)));
        return { type: pg.type, rows: pg.children.map((c) => ({ type: c.type, param: c.params.param, label: c.params.label, widget: c.params.widget, dflt: c.params.dflt })), back, control };
    });
    expect(r.type).toBe('param_group');
    // t1562 — these two bindings declare NO `widget` (only `type: 'number'`), so the materialized row carries '' —
    // INHERIT — and the control is derived from the type. This used to read 'number', which is what the assertion
    // pinned; that literal fallback WAS the t1562 defect (an explicit widget beats the type-derived default in
    // resolveFormWidget, so baking it flattened every enum/bool/string binding into a number box). Nothing observable
    // changed for THIS case — type 'number' still resolves to the number widget — which is why the assertion below now
    // pins the resolved CONTROL rather than the internal spelling, the property the spec actually cares about.
    expect(r.rows, 'one param_field per binding, in pre-order, label/default/widget from the binding (empty widget = inherit from type)').toEqual([
        { type: 'param_field', param: 'frate', label: 'Feed rate', widget: '', dflt: '200' },
        { type: 'param_field', param: 'mz', label: 'Plunge Z', widget: '', dflt: '-3' },
    ]);
    expect(r.control, 'an inheriting row still RENDERS as a number box for a number-typed binding').toEqual(['number', 'number']);
    expect(r.back.map((x) => x.param), 'the reader reads the materialized rows back in order').toEqual(['frate', 'mz']);
    expect(r.back[0].default, 'and their form defaults').toBe(200);
});

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
            const back = workspaceToStack(window.__blkws);
            let pg = null; const walk = (bs) => { for (const b of (bs || [])) { if (!b) continue; if (b.type === 'param_group') pg = b; if (b.uiChildren) walk(b.uiChildren); if (b.children) walk(b.children); } };
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
