import { test, expect } from '@playwright/test';

/**
 * t1613 — the DERIVED `passes` field (derived/writes declarations), INCREMENT semantics user-ruled.
 *
 * `passes` has NO emit socket: its value derives from the two fields that do — `ceil(depth / stepdown)` —
 * and stepping it writes DEPTH back through the declared INCREMENT expression
 * `depth + (passes − ceil(depth/stepdown)) × stepdown`, adding/removing WHOLE stepdown bites so an adapted
 * final pass survives (1.6 @ 0.5 → 4 passes incl. the 0.1 finish; step to 5 → depth 2.1, the 0.1 preserved).
 * The rejected alternative (snap to passes × stepdown) would silently re-split the user's total.
 *
 * The execution rule under test: writes fire ONLY on a user gesture on the passes field; a write triggers
 * derives, never other writes. Errors are NAMED inline — never a silent zero. Every expected expression is
 * READ FROM THE IMPORTED DECLARATION in-page (PASSES_FIELD), so a drifted copy cannot pass.
 */

const TWINS = ['user_surfacing_data', 'user_pocket_data', 'user_slot_data', 'user_contour_data', 'user_text_data'];

const openModal = async (page, opType = 'user_surfacing_data') => {
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager, null, { timeout: 60000 });
    await page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), opType);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 30000 });
};
const setField = async (page, param, value) => {
    await page.evaluate(({ param, value }) => {
        const f = document.querySelector(`#wiz_user_form [data-param="${param}"]`);
        f.value = String(value);
        f.dispatchEvent(new Event('input', { bubbles: true }));
        f.dispatchEvent(new Event('change', { bubbles: true }));
    }, { param, value });
};
const fieldVal = (page, param, root = '#wiz_user_form') => page.evaluate(({ param, root }) => {
    const f = document.querySelector(`${root} [data-param="${param}"]`);
    return f ? f.value : null;
}, { param, root });

test('every depth+stepdown twin declares ONE passes field — the imported declaration, after stepdown, emit-neutral', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 60000 });
    const r = await page.evaluate(async (twins) => {
        const U = await import('/blocks/userOps.js');
        const { PASSES_FIELD } = await import('/blocks/dataOps/passesField.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');
        const out = {};
        for (const t of twins) {
            const def = U.getUserDef(t);
            const rows = (def.bindings || []).filter((b) => b && b.param === 'passes');
            const at = (def.bindings || []).findIndex((b) => b && b.param === 'passes');
            const params = U.defaultParams(def);
            const emitWith = emitMapped(U.instantiate(def, params), activeDialectOpts()).text;
            const emitWithout = emitMapped(U.instantiate(def, { ...params, passes: undefined }), activeDialectOpts()).text;
            out[t] = {
                count: rows.length,
                derived: rows[0] && rows[0].derived, writes: rows[0] && rows[0].writes, widget: rows[0] && rows[0].widget,
                prev: at > 0 ? def.bindings[at - 1].param : null,
                emitNeutral: emitWith === emitWithout,
                declDerived: PASSES_FIELD.derived, declWrites: PASSES_FIELD.writes,
            };
        }
        return out;
    }, TWINS);
    for (const t of TWINS) {
        const x = r[t];
        expect(x.count, `${t}: exactly one passes binding`).toBe(1);
        expect(x.derived, `${t}: the derived expr IS the declaration's`).toBe(x.declDerived);
        expect(x.writes, `${t}: the writes map IS the declaration's`).toEqual(x.declWrites);
        expect(x.widget, `${t}: stepper widget`).toBe('stepper');
        expect(x.prev, `${t}: spliced directly after stepdown`).toBe('stepdown');
        expect(x.emitNeutral, `${t}: passes reaches NO socket — emit byte-identical with or without it`).toBe(true);
    }
});

test('ceil is in the expression table — lowercase only, per the table doctrine', async ({ page }) => {
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 60000 });
    const r = await page.evaluate(async () => {
        const { evalExpr } = await import('/wizards/ops/expr.js');
        let upper = null;
        try { evalExpr('CEIL(1.2)'); } catch (e) { upper = e.message; }
        return { four: evalExpr('ceil(1.6 / 0.5)'), upper };
    });
    expect(r.four, 'ceil(1.6/0.5) counts 4 passes').toBe(4);
    expect(r.upper, 'CEIL refuses by name (two languages stay separate)').toContain('unknown function: CEIL');
});

test('INCREMENT semantics through the REAL modal: derive, step up, step down — the adapted last pass survives', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept());
    await openModal(page);
    await setField(page, 'depth', 1.6);
    await setField(page, 'stepdown', 0.5);
    await expect(page.locator('#wiz_user_form [data-param="passes"]'), '1.6 @ 0.5 → 4 passes (three 0.5 bites + the 0.1 finish)').toHaveValue('4');
    // Step UP via the real ▲ button (input.nextElementSibling in the stepper wrap): +1 pass = +1 whole bite.
    await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="passes"]').nextElementSibling.click());
    await expect(page.locator('#wiz_user_form [data-param="depth"]'), 'depth grew by ONE whole stepdown — 2.1, NOT a snap to 2.5 or 2.0 (the 0.1 finish survives)').toHaveValue('2.1');
    await expect(page.locator('#wiz_user_form [data-param="passes"]'), 'and passes re-derives consistently').toHaveValue('5');
    // Step DOWN via ▼: exactly reversible.
    await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="passes"]').previousElementSibling.click());
    await expect(page.locator('#wiz_user_form [data-param="depth"]'), 'stepping back removes the same whole bite — 1.6 again').toHaveValue('1.6');
    await expect(page.locator('#wiz_user_form [data-param="passes"]')).toHaveValue('4');
});

test('a NAMED inline error — never a silent zero — and editing another field never fires writes', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept());
    await openModal(page);
    await setField(page, 'depth', 1.6);
    await setField(page, 'stepdown', 0);
    const err = page.locator('#wiz_user_form .derived-err');
    await expect(err, 'stepdown 0 → the passes row carries a visible error').toHaveCount(1);
    await expect(err, 'the error NAMES the field').toContainText('passes');
    // The rule: editing another field recomputes derives but never runs writes — depth stays exactly as typed.
    await expect(page.locator('#wiz_user_form [data-param="depth"]'), 'depth untouched by the failed derive').toHaveValue('1.6');
    await setField(page, 'stepdown', 0.5);
    await expect(page.locator('#wiz_user_form .derived-err'), 'a good stepdown clears the error').toHaveCount(0);
    await expect(page.locator('#wiz_user_form [data-param="passes"]')).toHaveValue('4');
});

test('the BLOCKS Wizard View face: the stepper works there too, and the write reaches the canvas declaration', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept());
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsEditWizardDef, null, { timeout: 60000 });
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 60000 });
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.evaluate(() => window.ddcsEditWizardDef('user_surfacing_data'));
    let last = -1;
    for (let i = 0; i < 120; i++) {
        const n = await page.evaluate(() => window.__blkws.getAllBlocks().length);
        if (n === last) break;
        last = n;
        await page.waitForTimeout(250);
    }
    await expect(page.locator('#blk-form [data-param="passes"]'), 'the stepper renders on the blocks face').toHaveCount(1);
    // Defaults 0.5 @ 0.5 → 1 pass. Step ▲ → depth 1.0 (one more whole bite), and the write rides the t1605
    // writeback into the CANVAS param_field declaration — the two-way chain end to end.
    await expect(page.locator('#blk-form [data-param="passes"]')).toHaveValue('1');
    await page.evaluate(() => document.querySelector('#blk-form [data-param="passes"]').nextElementSibling.click());
    await expect(page.locator('#blk-form [data-param="depth"]'), 'the write lands in the depth field').toHaveValue('1');
    await page.waitForFunction(() => {
        const walk = (bs, out = []) => { for (const b of bs || []) { if (!b) continue; out.push(b); walk(Array.isArray(b.children) ? b.children : Object.values(b.children || {}).flat(), out); walk(Array.isArray(b.uiChildren) ? b.uiChildren : Object.values(b.uiChildren || {}).flat(), out); } return out; };
        const pf = walk(window.ddcsGetBlockProgram() || []).find((b) => b.type === 'param_field' && b.params && b.params.param === 'depth');
        return pf && Number(pf.params.dflt) === 1;
    }, null, { timeout: 10_000 });
});

test('the formfield authoring block carries the same two sockets into its spec', async ({ page }) => {
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 60000 });
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const stack = [
            { type: 'assign', params: { var: '#31', value: 5 } },
            { type: 'formfield', params: { param: 'reps', widget: 'number', label: '', dflt: '', matchvar: '#31', key: 'value', type: 'number', derived: 'ceil(total / size)', writes: 'total = total + (reps - ceil(total / size)) * size; size = size' } },
        ];
        const specs = U.bindingsFromStack(stack);
        const s = specs.find((x) => x.param === 'reps');
        return { derived: s && s.derived, writes: s && s.writes };
    });
    expect(r.derived, 'the derived socket rides verbatim').toBe('ceil(total / size)');
    expect(r.writes, 'the writes text parses to the declared map ("param = expr" lines)').toEqual({ total: 'total + (reps - ceil(total / size)) * size', size: 'size' });
});
