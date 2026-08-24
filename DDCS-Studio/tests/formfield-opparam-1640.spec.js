import { test, expect } from '@playwright/test';
import { waitReady } from './_boot.js';

/**
 * t1640 — THE FORMFIELD GAINS AN OP PARAM MODE. t1636 measured this is not a fork: `deriveBindings`'s matcher
 * already supports `match:{type:atomType},key:param` with zero engine changes — every shipped twin that binds a
 * real op atom already uses exactly that shape (surfacingData.js's `SURFACING_BINDING_SPECS` bind w/h/toolDia via
 * `match:{type:'surfaceraster'}`). The gap was purely the `formfield` block's authoring UI, which hard-coded
 * `match:{type:'assign',var:matchvar}` and offered no way to target a leaf atom's own param — so a form authored
 * over an ordinary op's params (not a macro var) derived ZERO bindings.
 *
 * The fix: a second declared `bindMode` on the formfield block — 'assign' (today, byte-identical default) vs
 * 'opparam' (atomType + key instead of matchvar). No new disambiguation machinery for two atoms of the same type:
 * `match:{type}` already requires exactly one hit (deriveBindings throws else) — the correct authoring error, and
 * a spec worth building only if a real third case ever needs it (rule-of-three).
 */
const OPTYPE = 'user_ff_opparam_1640';
const RASTER_PARAMS = { x: 0, y: 0, z0: 0, w: 100, h: 80, inset: 0, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5, strategy: 'parallel', direction: 'bothways', rowAxis: 'x', entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1, confirmEvery: 0 };

test('MODEL: an Op Param formfield over a real op atom derives a binding — deriveBindings\' existing {type} matcher, zero engine changes', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio || true);
    const r = await page.evaluate((raster) => {
        return import('/blocks/userOps.js').then((U) => {
            const specs = [{ param: 'width', type: 'number', default: undefined, label: 'Width', match: { type: 'surfaceraster' }, key: 'w' }];
            const stack = [{ type: 'surfaceraster', params: raster }];
            const flat = U.flattenBlocks(stack);
            return import('/blocks/dataOps/deriveBindings.js').then(({ deriveBindings }) => {
                const bindings = deriveBindings(flat, specs);
                return { bindings, w: bindings[0] && bindings[0].default, key: bindings[0] && bindings[0].key };
            });
        });
    }, RASTER_PARAMS);
    expect(r.bindings.length, 'one binding derived').toBe(1);
    expect(r.key, 'the socket key is the atom\'s own param').toBe('w');
    expect(r.w, 'the default read from the matched socket (no explicit default given)').toBe(100);
});

test('LOSSLESS reverse round-trip: bindingsToBlocks renders an op-param spec as an Op Param formfield, bindingsFromStack reads it back byte-identical', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio || true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        // the exact match:{type} shape surfacingData.js's own (private) SURFACING_BINDING_SPECS uses for w/h/toolDia
        const opParamSpecs = [{ param: 'w', type: 'number', default: 100, label: 'Width', match: { type: 'surfaceraster' }, key: 'w' }];
        const blocks = U.bindingsToBlocks(opParamSpecs);
        const back = U.bindingsFromStack(blocks);
        return { opParamSpecs, back, bindMode: blocks[0] && blocks[0].params.bindMode, atomType: blocks[0] && blocks[0].params.atomType, matchvar: blocks[0] && blocks[0].params.matchvar };
    });
    expect(r.bindMode, 'renders as Op Param, not the misleading assign default').toBe('opparam');
    expect(r.atomType, 'the atom type carries through').toBe('surfaceraster');
    expect(r.matchvar, 'matchvar is left at its harmless placeholder — unused in opparam mode').toBe('#1');
    expect(r.back, 'round-trips byte-identical to the original spec (match/key/param/type all preserved)').toEqual(r.opParamSpecs);
});

test.use({ viewport: { width: 1400, height: 1000 } });

test('REAL APP: an Op Param field authored over surfaceraster saves, survives reload, renders its baked default, and editing it drives the built stack\'s own atom param', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.showApp && window.ddcsRefreshWizardBar);
    await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });

    // author: a bare surfaceraster leaf (no assign blocks at all — the exact shape that derived ZERO bindings pre-fix)
    // + ONE Op Param formfield naming its own 'w' param directly.
    await page.evaluate(async (raster) => {
        const U = await import('/blocks/userOps.js');
        const ff = { type: 'formfield', params: { param: 'width', widget: 'number', label: 'Width', dflt: '100', bindMode: 'opparam', matchvar: '#1', atomType: 'surfaceraster', key: 'w', type: 'number', section: '', help: '', optional: false, readonly: false, readonlyhint: '', whenparam: '', whenis: '', options: '', nmin: '', nmax: '', nstep: '', units: 'mm', derived: '', writes: '' } };
        const stack = [{
            type: 'user_root', params: {},
            uiChildren: [{ type: 'panel', params: { panel: 'form' } }, { type: 'param_group', params: { group: 'Geometry' }, children: [ff] }],
            children: [{ type: 'surfaceraster', params: raster }],
        }];
        window.ddcsLoadBlockStack(stack);
    }, RASTER_PARAMS);
    await page.evaluate(() => window.showApp('blocks'));
    await waitReady(page, () => window.__blkws && window.__blkws.getAllBlocks().length > 0);
    await page.waitForTimeout(500);

    // save via the real button + real dialog — must NOT refuse (the pre-fix shape of this exact stack refused / derived nothing)
    await page.waitForSelector('.blk-dev-savebtn', { state: 'visible' });
    await page.evaluate(() => window.ddcsSaveAsWizard());
    await page.waitForSelector('.blk-dev-savedlg', { state: 'visible', timeout: 3000 });
    await page.fill('.blk-dev-savedlg .blk-dev-opname', 'FF OpParam 1640');
    await page.click('.blk-dev-savedlg .blk-dev-save');
    await page.waitForTimeout(300);

    const savedOpType = await page.evaluate(() => {
        const arr = JSON.parse(localStorage.getItem('ddcs_user_ops') || '[]');
        const found = arr.find((o) => o.label === 'FF OpParam 1640');
        return found ? found.opType : null;
    });
    expect(savedOpType, 'the save dialog opened and the wizard persisted — no false refusal').toBeTruthy();

    await page.reload();
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1' && window.openWiz);
    const registered = await page.evaluate(async (opType) => {
        const U = await import('/blocks/userOps.js');
        const op = U.listUserOps().find((o) => o.opType === opType);
        return op ? { found: true, errs: U.validateUserOp(op), bindingsCount: (op.bindings || []).length, widthDefault: (op.bindings.find((b) => b.param === 'width') || {}).default } : { found: false };
    }, savedOpType);
    expect(registered.found, 'survives a fresh page reload').toBe(true);
    expect(registered.errs, 'validates clean').toEqual([]);
    expect(registered.bindingsCount, 'exactly the one authored binding').toBe(1);
    expect(registered.widthDefault, 'the declared default derived from the block').toBe(100);

    await page.evaluate((opType) => window.openWiz(opType), savedOpType);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    const field = await page.evaluate(() => {
        const el = document.querySelector('#wiz_user_form [data-param="width"]');
        return el ? { present: true, value: el.value } : { present: false };
    });
    expect(field.present, 'the "width" field renders in the live form').toBe(true);
    expect(field.value, 'seeded with the declared default').toBe('100');

    // THE LOAD-BEARING CLAIM: editing the form must drive the SAME socket the surfaceraster block reads at build
    // time — assert the built stack's own atom param, not a proxy (a `#` var doesn't exist here to regex for).
    await page.evaluate(() => {
        const el = document.querySelector('#wiz_user_form [data-param="width"]');
        el.value = '150';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    const built = await page.evaluate(async (opType) => {
        const U = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const reg = U.listUserOps().find((o) => o.opType === opType);
        const params = { ...U.defaultParams(reg), width: 150 };
        const stack = builderOf(opType)(params);
        const raster = U.flattenBlocks(stack).find((b) => b && b.type === 'surfaceraster');
        return { w: raster && raster.params && raster.params.w };
    }, savedOpType);
    expect(built.w, 'overriding the form field lands the new value on the surfaceraster leaf\'s own w param').toBe(150);

    await page.evaluate(async (opType) => {
        const U = await import('/blocks/userOps.js');
        try { U.deleteUserOp(opType); } catch (_) { /* already gone */ }
        localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout');
    }, savedOpType);
});

test('the t1636 loud refusal still fires in Op Param mode: a dangling atomType, and an AMBIGUOUS same-type-twice stack', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
    await page.goto('http://localhost:3211');
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.showApp && window.ddcsRefreshWizardBar);
    await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });

    // Op Param naming an atom type that ISN'T in the stack at all — 0 hits.
    await page.evaluate((raster) => {
        const ff = { type: 'formfield', params: { param: 'w', widget: 'number', label: 'Width', dflt: '', bindMode: 'opparam', matchvar: '#1', atomType: 'no_such_atom_type', key: 'w', type: 'number', section: '', help: '', optional: false, readonly: false, readonlyhint: '', whenparam: '', whenis: '', options: '', nmin: '', nmax: '', nstep: '', units: '', derived: '', writes: '' } };
        const stack = [{
            type: 'user_root', params: {},
            uiChildren: [{ type: 'panel', params: { panel: 'form3d+2d' } }, { type: 'param_group', params: { group: 'Pilot' }, children: [ff] }],
            children: [{ type: 'surfaceraster', params: raster }],
        }];
        window.ddcsLoadBlockStack(stack);
    }, RASTER_PARAMS);
    await page.evaluate(() => window.showApp('blocks'));
    await waitReady(page, () => window.__blkws && window.__blkws.getAllBlocks().length > 0);
    await page.waitForTimeout(500);
    await page.waitForSelector('.blk-dev-savebtn', { state: 'visible' });
    await page.evaluate(() => window.ddcsSaveAsWizard());
    await page.waitForTimeout(300);

    expect(dialogs.length, 'refused instead of silently deriving zero bindings').toBeGreaterThan(0);
    expect(dialogs[0], 'names the field count').toMatch(/1 field declared, 0 matched/);
    expect(dialogs[0], 'names it as an Op Param target').toMatch(/Op Param no_such_atom_type\.w/);
    const saved1 = await page.evaluate(() => JSON.parse(localStorage.getItem('ddcs_user_ops') || '[]').length);
    expect(saved1, 'nothing saved').toBe(0);

    // AMBIGUOUS: two atoms of the SAME type in the stack — {type} alone can no longer identify a sole target.
    dialogs.length = 0;
    await page.evaluate((raster) => {
        const ff = { type: 'formfield', params: { param: 'w', widget: 'number', label: 'Width', dflt: '', bindMode: 'opparam', matchvar: '#1', atomType: 'surfaceraster', key: 'w', type: 'number', section: '', help: '', optional: false, readonly: false, readonlyhint: '', whenparam: '', whenis: '', options: '', nmin: '', nmax: '', nstep: '', units: '', derived: '', writes: '' } };
        const stack = [{
            type: 'user_root', params: {},
            uiChildren: [{ type: 'panel', params: { panel: 'form3d+2d' } }, { type: 'param_group', params: { group: 'Pilot' }, children: [ff] }],
            children: [{ type: 'surfaceraster', params: raster }, { type: 'surfaceraster', params: { ...raster, w: 200 } }],
        }];
        window.ddcsLoadBlockStack(stack);
    }, RASTER_PARAMS);
    await page.evaluate(() => window.showApp('blocks'));
    await waitReady(page, () => window.__blkws && window.__blkws.getAllBlocks().length > 0);
    await page.waitForTimeout(500);
    await page.waitForSelector('.blk-dev-savebtn', { state: 'visible' });
    await page.evaluate(() => window.ddcsSaveAsWizard());
    await page.waitForTimeout(300);

    expect(dialogs.length, 'an AMBIGUOUS 2-hit match refuses too — no silent bind to the wrong instance').toBeGreaterThan(0);
    expect(dialogs[0], 'shows the ambiguous hit count, not a false "0 matched"').toMatch(/1 field declared, 0 matched/);
    const saved2 = await page.evaluate(() => JSON.parse(localStorage.getItem('ddcs_user_ops') || '[]').length);
    expect(saved2, 'nothing saved for the ambiguous case either').toBe(0);
});
