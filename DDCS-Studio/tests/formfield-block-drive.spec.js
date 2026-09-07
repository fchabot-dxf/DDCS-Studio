import { test, expect } from '@playwright/test';
import { waitReady } from './_boot.js';

/**
 * COMPOSABLE-WIZARD-AUTHORING PILOT 1 (t397) — the FORM value-field BLOCK. A `formfield` block in the user_root
 * PRESENTATION mouth is the blocks-native twin of a deriveBindings SPEC row: bindingsFromStack (forward) + bindingsToBlocks
 * (reverse) round-trip def.bindingSpecs ⇄ blocks LOSSLESSLY (mirrors simStartsFromStack/ToBlocks). resolveBindingsMeta in
 * registerUserOp derives def.bindingSpecs (emit) + def.bindings (form) from the blocks; isMaintainedAsData lifts once every
 * spec is authored as a block.
 *
 * t1512 (tier migration): the 4 pure round-trip/derive tests split out to tests/node/formfield-block.test.mjs. This one
 * remains here — it drives a real wizard form + the real Blockly workspace and queries rendered DOM (Class-B render
 * guard), which the node tier's structural-only document stub cannot answer.
 */

const PILOT_OPTYPE = 'user_ff_pilot';

test.use({ viewport: { width: 1400, height: 1000 } });
test('DRIVE THE APP: a formfield-authored op RENDERS its fields in the live form (renderOpForm) + the block RENDERS in Blocks (Class-B guard)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.showApp);
    // register the pilot op
    await page.evaluate(async (OPTYPE) => {
        const U = await import('/blocks/userOps.js');
        localStorage.removeItem('ddcs_user_ops');
        try { U.deleteUserOp(OPTYPE); } catch (_) {}
        const specs = [
            { param: 'dist',    type: 'number', default: 30, label: 'Max Probe Dist', help: 'how far the stylus travels', section: 'CUT', match: { type: 'assign', var: '#1' }, key: 'value' },
            { param: 'retract', type: 'number', default: 2,  label: 'Retract',        section: 'CUT', match: { type: 'assign', var: '#2' }, key: 'value' },
        ];
        const template = [{
            type: 'user_root', params: {},
            uiChildren: [{ type: 'feature_canvas', params: { panel: 'form' } }, { type: 'param_group', params: { group: 'Pilot' }, children: U.bindingsToBlocks(specs) }],
            children: [{ type: 'assign', params: { var: '#1', value: 30 } }, { type: 'assign', params: { var: '#2', value: 2 } }],
        }];
        U.createUserOp(U.userOpFromStack(OPTYPE, 'FF Pilot', template, [], 'form'));
    }, PILOT_OPTYPE);
    // open its wizard → the form renders the authored fields
    await page.evaluate((OPTYPE) => window.openWiz(OPTYPE), PILOT_OPTYPE);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    const form = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const labels = Array.from(f.querySelectorAll('label, .wiz-field-label, span')).map((e) => (e.textContent || '').trim());
        return {
            hasDist: !!f.querySelector('[data-param="dist"]'),
            hasRetract: !!f.querySelector('[data-param="retract"]'),
            distVal: (f.querySelector('[data-param="dist"]') || {}).value,
            labelText: labels.filter(Boolean).join(' | '),
        };
    });
    expect(form.hasDist, 'the authored "dist" field renders in the live form (renderOpForm reads the derived bindings)').toBe(true);
    expect(form.hasRetract, 'the authored "retract" field renders').toBe(true);
    expect(form.distVal, 'the field seeds the authored default').toBe('30');
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/formfield_pilot_form.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    // Class-B render guard (blockly skill): the formfield block actually DRAWS in the Blocks workspace (not a phantom model)
    await page.evaluate(() => window.showApp('blocks'));
    await waitReady(page, () => window.__blkws && window.__blkws.getAllBlocks().length > 0);
    await page.waitForTimeout(500);
    const render = await page.evaluate(() => {
        const ws = window.__blkws;
        const ff = ws.getAllBlocks().filter((b) => b.type === 'formfield');
        return { count: ff.length, drawn: ff.filter((b) => { try { return b.getHeightWidth().height > 0; } catch (_) { return false; } }).length };
    });
    await page.evaluate((OPTYPE) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(OPTYPE); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, PILOT_OPTYPE);
    expect(render.count, 'the formfield blocks appear in the Blocks workspace').toBeGreaterThan(0);
    expect(render.drawn, 'Class-B guard: the formfield blocks actually RENDERED (height > 0), not phantom models').toBe(render.count);
});
