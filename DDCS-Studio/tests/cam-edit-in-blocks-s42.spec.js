import { test, expect } from '@playwright/test';

/**
 * S4-2 (corrected model, t1147) — "loading IS editing". There is NO separate button: the existing ✎ Edit opens the
 * pendant MODAL (icon + expose/bake) for EVERY slot, and for a single-op UNIVERSAL slot it ALSO loads the reconstructed
 * op into the editor so the Blocks tab shows its STRUCTURE — guarded by the S4-1 destructive-load guard (a dirty editor
 * gets ONE confirm; a clean one loads straight in). GENERATORS are modal-only (parametric — nothing to load; the editor
 * is untouched). Substack = S4-4, multi-op = S4-5.
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function seedPack(page, slots) {
    await page.evaluate((s) => localStorage.setItem('ddcs_campack', JSON.stringify({ meta: { name: 't', baseSlot: 22 }, slots: s })), slots);
}
async function registerUniv(page) {
    const reg = await page.evaluate(async () => {
        try {
            const U = await import('/blocks/userOps.js');
            const cam = await import('/data/opCamMap.js');
            localStorage.removeItem('ddcs_user_ops');
            // an EXPOSED param (a knob) → a valid UNIVERSAL CAM op with value bindings (a bare op has "no bindings to expose")
            const t = [{ type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', value: -5 } } } }];
            U.createUserOp(U.userOpFromStack('univ', 'My Universal', t, U.extractParamBlocks(t)));
            const seed = cam.seedFromOp({ opType: 'user_univ', params: {} });
            return { ok: true, has: !!U.getUserDef('user_univ'), universal: !!(seed && seed.universal) };
        } catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
    });
    expect(reg.ok && reg.has && reg.universal, 'universal user op registered with bindings: ' + JSON.stringify(reg)).toBe(true);
}
async function openCamTab(page) {
    await page.evaluate(async () => { (await import('/ui/macrosApp.js')).initMacrosApp(); });
    await page.waitForFunction(() => window.showApp && window.ddcsGetBlockProgram && window.ddcsLoadBlockStack);
    await page.evaluate(() => window.showApp('macros'));
    await page.waitForSelector('#macros-app .settings-tab[data-target="macros_panel_cam"]');
    await page.evaluate(() => document.querySelector('#macros-app .settings-tab[data-target="macros_panel_cam"]').click());
    await page.waitForSelector('#cam_slots .cam-slot [data-act="editslot"]', { state: 'visible' });
}
const UNIV_SLOT = { slot: 22, name: 'Custom', ops: [{ type: 'universal', variant: '', values: {}, exposed: {}, baked: {}, opType: 'user_univ', defV: 1 }] };
const POCKET_SLOT = { slot: 22, name: 'Pocket', ops: [{ type: 'pocket', variant: 'x', values: {}, exposed: {}, baked: {}, opType: 'pocket' }] };

test('Edit a UNIVERSAL slot (clean editor): the modal opens AND the op loads into the editor (Blocks structure), no confirm', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await seedPack(page, [UNIV_SLOT]);
    await registerUniv(page);
    await page.waitForFunction(() => window.showApp && window.ddcsEditWizardDef);
    await page.evaluate(() => window.showApp('blocks'));   // make sure the editor starts EMPTY (clean → no confirm)
    await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await openCamTab(page);

    await page.click('#cam_slots .cam-slot [data-act="editslot"]');
    await page.waitForSelector('.cam-auth-overlay', { timeout: 8000 });                                    // the pendant modal opens
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).some((b) => b.type === 'op'), { timeout: 10000 });  // + the op is in the editor
    expect(await page.evaluate(() => !!document.querySelector('.cam-auth-overlay')), 'the pendant modal is open').toBe(true);
    expect(await page.evaluate(() => (window.ddcsGetBlockProgram() || []).some((b) => b.type === 'op')), 'the universal op loaded into the editor (Blocks structure)').toBe(true);
    expect(await page.evaluate(() => !!document.querySelector('.app-dialog')), 'a clean editor raised NO confirm').toBe(false);

    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test('Edit a GENERATOR slot (non-empty editor): the modal opens ONLY — the editor is UNTOUCHED, no load, no confirm', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await seedPack(page, [POCKET_SLOT]);
    await page.evaluate(async () => { (await import('/ui/macrosApp.js')).initMacrosApp(); });
    await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram);
    // seed a KNOWN program — editing a generator must NOT touch it
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'move', params: { x: 7, y: 7, z: 7 } }]));
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).length > 0);
    const progBefore = await page.evaluate(() => JSON.stringify(window.ddcsGetBlockProgram()));
    await page.evaluate(() => window.showApp('macros'));
    await page.waitForSelector('#macros-app .settings-tab[data-target="macros_panel_cam"]');
    await page.evaluate(() => document.querySelector('#macros-app .settings-tab[data-target="macros_panel_cam"]').click());
    await page.waitForSelector('#cam_slots .cam-slot [data-act="editslot"]', { state: 'visible' });

    await page.click('#cam_slots .cam-slot [data-act="editslot"]');
    await page.waitForSelector('.cam-auth-overlay', { timeout: 8000 });   // the modal opens
    expect(await page.evaluate(() => JSON.stringify(window.ddcsGetBlockProgram())), 'a generator Edit does NOT touch the editor (no load)').toBe(progBefore);
    expect(await page.evaluate(() => !!document.querySelector('.app-dialog')), 'no destructive-load confirm for a generator (nothing loads)').toBe(false);
});

test('Edit a UNIVERSAL slot on a DIRTY editor: the S4-1 guard CONFIRMS; Cancel keeps the program AND the modal still opens', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await seedPack(page, [UNIV_SLOT]);
    await registerUniv(page);
    await page.waitForFunction(() => window.showApp && window.ddcsEditWizardDef && window.ddcsLoadBlockStack);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'move', params: { x: 9, y: 9, z: 9 } }]));
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).length > 0);
    const progBefore = await page.evaluate(() => JSON.stringify(window.ddcsGetBlockProgram()));
    await openCamTab(page);

    await page.click('#cam_slots .cam-slot [data-act="editslot"]');
    await page.waitForSelector('.app-dialog', { timeout: 8000 });   // loading a universal slot into a DIRTY editor confirms first
    await page.click('.app-dialog button:has-text("Cancel")');
    await page.waitForFunction(() => !document.querySelector('.app-dialog'));
    await page.waitForSelector('.cam-auth-overlay', { timeout: 8000 });   // the pendant modal still opens (it is program-independent)
    expect(await page.evaluate(() => JSON.stringify(window.ddcsGetBlockProgram())), 'Cancel kept the editor program (no wipe)').toBe(progBefore);

    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
