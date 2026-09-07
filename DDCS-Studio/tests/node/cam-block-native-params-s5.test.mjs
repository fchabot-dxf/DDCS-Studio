import { test, expect } from './support/harness.mjs';

// BLOCK-NATIVE CAM PARAMS S5.1 — the FORM half, mirroring the pendant S1+S3. A DEDICATED param_field block (Fork B: formfield's
// var-identity match cannot address a (blockIndex,key) value socket), paramFieldsFromStack reader, paramGroupFromBindings
// materializer. Both param_group and param_field EMIT [] → byte-neutral. The FORM family (param_group/param_field) shares one
// colour distinct from the CAM-pendant pink and the Wizard-UI fuchsia. S5.1 = schema + reader + materializer only (no consumer).
//
// TIER MIGRATION WORK PACKAGE 4 — moved browser→node: both tests are plain page.evaluate calls that import app modules,
// build local block-stack literals, and assert on plain returned data — no DOM read, no click, no screenshot. The file's
// third test (round-trip through the real Blockly workspace + block colours) depends on window.showApp/ddcsLoadBlockStack/
// window.__blkws and a screenshot — a genuine app+DOM dependency, not a candidate for this tier. Split into
// tests/cam-block-native-params-s5-drive.spec.js.

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
    // t2543 (BACKLOG #71 owner ruling) — SEPARATE SLOT: paramGroupFromBindings now returns a `param_table`
    // node (materialize's own separate target), never `param_group` (a twin's own form-layout declaration).
    expect(r.type).toBe('param_table');
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
