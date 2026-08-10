import { test, expect } from '@playwright/test';

const SCRATCH = 'scratchpad';

// BLOCK-NATIVE CAM PARAMS S5.2 — the wizard FORM renderer CONSUMES paramFieldsFromStack (the FORM analog of S2+S4a).
// formBindings(def): when the def carries a param_group, its param_field ROWS drive the form (order = row order;
// label/widget/type/default from the row; the BINDING supplies the wiring); when absent (every op today), the bindings are
// returned UNCHANGED → byte-identical form. The wizard form is a pure FILL surface (no field-declaration write-back — the
// param_field block is the SOLE edit surface), so this is a clean ONE-WAY consume.

const defWithParamGroup = (rows) => ({
    opType: 'user_s52', label: 'S52',
    template: [{ type: 'user_root', params: {}, uiChildren: [
        { type: 'param_group', params: { group: 'Cut' }, children: rows.map((r) => ({ type: 'param_field', params: {
            param: r.param, label: r.label || '', widget: r.widget || 'number', type: r.type || 'number',
            dflt: r.dflt != null ? String(r.dflt) : '', units: r.units || '', nmin: r.nmin || '', nmax: r.nmax || '', nstep: '', section: '', help: '', options: '',
        } })) },
    ], children: [] }],
    bindings: [
        { param: 'frate', blockIndex: 3, key: 'rate', type: 'number', default: 200, label: 'Feed rate', units: 'mm/min' },
        { param: 'mz', blockIndex: 4, key: 'z', type: 'number', default: -3, label: 'Plunge Z' },
    ],
});

test('S5.2 — formBindings: a param_group drives order + label/widget/default (binding = wiring); NO param_group → unchanged', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { formBindings } = await import('/ui/formWidgets.js');
        const { userOpFromStack, getUserDef } = await import('/blocks/userOps.js');
        // WITH a param_group: mz reordered FIRST with a custom label+slider+default; frate keeps its binding default (empty row dflt)
        const withPg = new Function('return ' + mk)()([
            { param: 'mz', label: 'Depth (custom)', widget: 'slider', dflt: -5, nmin: -50, nmax: 0, units: 'mm' },
            { param: 'frate', label: 'Feed (custom)', widget: 'number', units: 'mm/min', nmin: 1, nmax: 9999 },
        ]);
        const fbWith = formBindings(withPg);
        // NO param_group: a plain def → formBindings returns the bindings UNCHANGED (same reference)
        const noPg = userOpFromStack('user_s52b', 'S52b', [{ type: 'user_root', params: {}, children: [{ type: 'feed', params: { rate: 200 } }] }], [
            { param: 'frate', blockIndex: 1, key: 'rate', type: 'number', default: 200, label: 'Feed rate' },
        ]);
        const fbNo = formBindings(noPg);
        // a REAL registered twin (no param_group) → unchanged (the byte-identity guarantee for every op today)
        const drill = getUserDef('user_drill_data');
        const fbDrill = drill ? formBindings(drill) : null;
        return {
            withOrder: fbWith.map((b) => ({ param: b.param, key: b.key, label: b.label, widget: b.widget, default: b.default })),
            noSame: fbNo === noPg.bindings,
            drillSame: fbDrill ? (fbDrill === drill.bindings) : true,
        };
    }, defWithParamGroup.toString());
    // order = row order (mz first), label/widget/default from the rows, wiring (key) from the binding
    expect(r.withOrder, 'param_group rows drive the form: mz first (row order), row label/widget, mz default -5, frate inherits 200').toEqual([
        { param: 'mz', key: 'z', label: 'Depth (custom)', widget: 'slider', default: -5 },
        { param: 'frate', key: 'rate', label: 'Feed (custom)', widget: 'number', default: 200 },
    ]);
    expect(r.noSame, 'NO param_group → the bindings are returned UNCHANGED (same reference) → byte-identical form').toBe(true);
    // t1632 — the real-twin claim FLIPPED with b95540d9 (t1111): every registered twin now carries a MATERIALIZED,
    // populated param_group (that was the commit's whole point — no more empty forms in Blocks), so formBindings
    // legitimately returns derived rows, not the same reference. The synthetic no-group case above still pins the
    // untouched fallback; the real twin now pins the NEW world: rows drive, and nothing is dropped doing it.
    expect(r.drillSame, 'a real registered twin is MATERIALIZED now (b95540d9) — rows drive, not the raw reference').toBe(false);
});

test('S5.2 — editing a param_field (label/widget/default) is reflected by formBindings; reordering rows reorders the form', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { formBindings } = await import('/ui/formWidgets.js');
        const { flattenBlocks } = await import('/blocks/userOps.js');
        const def = new Function('return ' + mk)()([
            { param: 'frate', label: 'Feed rate', widget: 'number', units: 'mm/min' },
            { param: 'mz', label: 'Plunge Z', widget: 'number' },
        ]);
        const before = formBindings(def).map((b) => ({ param: b.param, label: b.label, widget: b.widget }));
        // EDIT the frate param_field: change its label + widget (as authoring the block would)
        const row = flattenBlocks(def.template).find((b) => b.type === 'param_field' && b.params.param === 'frate');
        row.params.label = 'Cutting Feed'; row.params.widget = 'slider';
        const after = formBindings(def).map((b) => ({ param: b.param, label: b.label, widget: b.widget }));
        // REORDER: swap the two param_field rows in the param_group mouth
        const pg = def.template[0].uiChildren.find((b) => b.type === 'param_group');
        pg.children.reverse();
        const reordered = formBindings(def).map((b) => b.param);
        return { before, after, reordered };
    }, defWithParamGroup.toString());
    expect(r.before[0], 'before the edit').toMatchObject({ param: 'frate', label: 'Feed rate', widget: 'number' });
    expect(r.after[0], 'the label + widget edit is reflected in the form').toMatchObject({ param: 'frate', label: 'Cutting Feed', widget: 'slider' });
    expect(r.reordered, 'reordering the param_field blocks reorders the form fields').toEqual(['mz', 'frate']);
});

test.describe(() => {
    test.use({ viewport: { width: 1400, height: 1000 } });
    test('S5.2 — renderOpForm renders the block-driven labels for a def WITH a param_group', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsGetBlockProgram);
        await page.evaluate(async (mk) => {
            const { renderOpForm, formBindings } = await import('/ui/formWidgets.js');
            const def = new Function('return ' + mk)()([
                { param: 'mz', label: 'Depth (custom)', widget: 'number', dflt: -5 },
                { param: 'frate', label: 'Feed (custom)', widget: 'number' },
            ]);
            const host = document.createElement('div'); host.id = 'fh'; host.style.cssText = 'position:fixed; inset:0; z-index:99999; background:var(--bg,#0d1117); padding:24px;';
            document.body.appendChild(host);
            renderOpForm(host, formBindings(def));
        }, defWithParamGroup.toString());
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SCRATCH}/s52-form-from-blocks.png` });   // VIEWED — the form rendered from param_field blocks
        const txt = await page.locator('#fh').innerText();
        expect(txt, 'the form shows the block-driven custom labels').toContain('Depth (custom)');
        expect(txt).toContain('Feed (custom)');
    });
});
