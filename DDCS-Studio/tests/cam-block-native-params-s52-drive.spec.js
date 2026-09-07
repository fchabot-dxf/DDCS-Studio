import { test, expect } from '@playwright/test';

const SCRATCH = 'scratchpad';

// BLOCK-NATIVE CAM PARAMS S5.2 — the wizard FORM renderer CONSUMES paramFieldsFromStack (the FORM analog of S2+S4a).
// formBindings(def): when the def carries a param_group, its param_field ROWS drive the form (order = row order;
// label/widget/type/default from the row; the BINDING supplies the wiring); when absent (every op today), the bindings are
// returned UNCHANGED → byte-identical form. The wizard form is a pure FILL surface (no field-declaration write-back — the
// param_field block is the SOLE edit surface), so this is a clean ONE-WAY consume.
//
// Split from cam-block-native-params-s52.spec.js at the tier migration work package 4; its two sibling tests (the pure
// formBindings order/edit checks) moved to tests/node/cam-block-native-params-s52.test.mjs. This one stayed: it renders
// a real form into a `document.createElement('div')` host appended to `document.body` and reads back `.innerText()` —
// a genuine DOM dependency.

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
