import { test, expect } from '@playwright/test';

/**
 * WCS E1 — the user_wcs_data twin (static-shape over the dialect-aware wcszero atom) emits BYTE-IDENTICAL to the built-in
 * wcsStack across EVERY dialect (the atom resolves the active post at emit) + a param sweep; opens IN-PLACE (opensAs) with
 * a non-empty form. INDEPENDENT truth = wcsStack (a separate path). Covers M350 register / rs274·grbl G10 L20 / v41 #1506 /
 * dm500 #804 — all through the ONE atom, so the twin inherits them for free.
 */
test('user_wcs_data == wcsStack byte-identical across all dialects + opensAs in-place', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { wcsStack } = await import('/wizards/wcsWizard.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { getDialect } = await import('/wizards/dialects/index.js');
        const WL = await import('/blocks/wizardLibrary.js');
        const build = builderOf('user_wcs_data');
        if (!build) return { registered: false };
        const emit = (stack, id) => emitMapped(stack, { dialect: getDialect(id) }).text;
        const DIALECTS = ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500', 'rs274ngc', 'grbl'];
        // FULL params (all 6 fields) — the form always sets each toggle explicitly; a bool omitted → built-in !!undefined=false
        // vs the binding default, so the realistic comparison passes complete params (as the form's read() does).
        const sweep = [
            { sys: '0', axisX: true, axisY: true, axisZ: false, sync: false, slave: '3' },
            { sys: '54', axisX: true, axisY: true, axisZ: true, sync: false, slave: '3' },
            { sys: '55', axisX: false, axisY: true, axisZ: false, sync: false, slave: '3' },
            { sys: '0', axisX: true, axisY: false, axisZ: false, sync: true, slave: '3' },
            { sys: '59', axisX: true, axisY: true, axisZ: true, sync: true, slave: '4' },
        ];
        let diffs = 0, first = null;
        for (const id of DIALECTS) for (const p of sweep) {
            const a = emit(build(p), id), b = emit(wcsStack(p), id);
            if (a !== b) { diffs++; if (!first) first = { id, p, a: a.slice(0, 600), b: b.slice(0, 600) }; }
        }
        const entry = WL.listEntries().find((e) => e.id === 'wcs');
        return { registered: true, diffs, first, opensAs: entry && entry.opensAs, title: WL.builtinLabelForTwin('user_wcs_data') };
    });
    expect(r.registered, 'user_wcs_data seeded on boot').toBe(true);
    if (r.first) console.log('WCS TWIN DIFF [' + r.first.id + '] @ ' + JSON.stringify(r.first.p) + '\n--TWIN--\n' + r.first.a + '\n--BUILTIN--\n' + r.first.b);
    expect(r.diffs, 'the twin == wcsStack byte-identical across ALL dialects + the sweep (ZERO)').toBe(0);
    expect(r.opensAs, 'the WCS slot opensAs the twin').toBe('user_wcs_data');
    expect(r.title, 'the seamless in-place title is the built-in label').toBe('WCS / work offsets');
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('DRIVE: WCS opens IN-PLACE with a non-empty form (the WCS system + axes render)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => window.openWiz('user_wcs_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(400);
    const form = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const params = [...f.querySelectorAll('[data-param]')].map((e) => e.getAttribute('data-param'));
        return { count: params.length, params, hasSys: params.includes('sys'), hasX: params.includes('axisX'), hasSync: params.includes('sync') };
    });
    await page.locator('#wiz_user').screenshot({ path: 'scratchpad/wcs_inplace.png' });
    console.log('WCS FORM: ' + form.count + ' → ' + form.params.join(','));
    expect(form.count, 'the in-place form is non-empty').toBeGreaterThan(3);
    expect(form.hasSys, 'the WCS System field renders').toBe(true);
    expect(form.hasX, 'the Zero X toggle renders').toBe(true);
});
