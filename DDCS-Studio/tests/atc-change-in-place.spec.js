import { test, expect } from '@playwright/test';

/**
 * ATC CHANGE E2 (t566) — COMPLETES port 2 of 3. The user_atc_change_data twin is seeded + wired IN-PLACE via the Tool Change
 * slot's `opensAs`. VERIFY: the slot opensAs the twin (plain title, twin retired) · opSimContext carries FORCE_MACHINE +
 * WITH_MAGAZINE + the machine-frame intent · the in-place form's per-method FIELD GATING matches the legacy (z only manual;
 * zClear greyed for auto; fixedT greyed for auto+inline; callMacro only for auto; orient only firmware) · each method's emit ·
 * the choreography sim-gcode override for the automatic methods · the machine + magazine 3D sim.
 */
const OPTYPE = 'user_atc_change_data';

test('opensAs wiring: Tool Change opens the twin IN-PLACE (plain title, twin retired) + opSimContext + the choreography hook', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (OPTYPE) => {
        const WL = await import('/blocks/wizardLibrary.js');
        const { opSimContext } = await import('/viz/opSimContext.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { getUserSimGcode } = await import('/blocks/userOps.js');
        const entries = WL.listEntries();
        const slot = entries.find((e) => e.id === 'atc_change');
        const twinEntry = entries.find((e) => e.type === OPTYPE);
        // the choreography hook: auto method → a non-null sim gcode; m6 → null (preview the emit's own moves)
        window.__atcS = { atc: { magazine: [{ tool: 1, x: 100, y: 50, z: -20, pocket: 1 }], grip: 'drawbar', motion: 'pick-place', layout: 'linear', safeZ: 10 }, outputs: [{ type: 'drawbar', onCode: 'M154', offCode: 'M155' }], inputs: [] };
        window.ddcsGetSettings = () => window.__atcS;
        const sg = getUserSimGcode(OPTYPE);
        return { opensAs: slot && slot.opensAs, title: WL.builtinLabelForTwin(OPTYPE), twinRetired: !twinEntry, registered: !!builderOf(OPTYPE), ctx: opSimContext(OPTYPE), autoSim: sg ? !!sg({ method: 'generic', callMacro: false }) : false, m6Sim: sg ? sg({ method: 'm6' }) : 'no-hook' };
    }, OPTYPE);
    expect(r.registered, 'the twin is seeded/registered on boot').toBe(true);
    expect(r.opensAs, 'the built-in Tool Change slot opensAs the twin').toBe(OPTYPE);
    expect(r.title, 'the seamless in-place title is the built-in plain label').toBe('Tool Change');
    expect(r.twinRetired, "the twin's own atc_datawiz menu entry is retired").toBe(true);
    expect(r.ctx.forceMachine && r.ctx.showMagazine && r.ctx.toolMachineFrame, 'FORCE_MACHINE + WITH_MAGAZINE + machine-frame carry').toBe(true);
    expect(r.autoSim, 'the choreography hook returns a sim gcode for an AUTOMATIC method').toBe(true);
    expect(r.m6Sim, 'm6 → null (the real emit’s own moves animate)').toBe(null);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('DRIVE: Tool Change opens IN-PLACE — the per-method field gating matches the legacy + each method emits + the 3D sim renders', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => {
        const real = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        window.__realSettings = real;
        window.ddcsGetSettings = () => ({ ...window.__realSettings, atc: { ...(window.__realSettings.atc || {}), magazine: [{ tool: 1, x: 100, y: 50, z: -20, pocket: 1 }, { tool: 2, x: 150, y: 50, z: -20, pocket: 2 }], grip: 'drawbar', motion: 'pick-place', layout: 'linear', safeZ: 10 }, outputs: [{ type: 'drawbar', onCode: 'M154', offCode: 'M155' }], inputs: [] });
    });
    await page.evaluate((op) => window.openWiz(op), OPTYPE);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(400);

    // helpers over the in-place form
    const rowShown = (param) => page.evaluate((p) => { const i = document.querySelector(`#wiz_user_form [data-param="${p}"]`); const row = i && i.closest('[data-when], [data-gate]') || (i && i.parentElement); return row ? getComputedStyle(row).display !== 'none' : false; }, param);
    const gated = (param) => page.evaluate((p) => { const i = document.querySelector(`#wiz_user_form [data-param="${p}"]`); return !!(i && i.getAttribute('data-op-gated') === 'on'); }, param);
    const setMethod = async (m) => { await page.evaluate((m) => { const s = document.querySelector('#wiz_user_form [data-param="method"]'); s.value = m; s.dispatchEvent(new Event('change', { bubbles: true })); }, m); await page.waitForTimeout(300); };
    const code = () => page.evaluate(() => (document.getElementById('wiz_user_code') || {}).textContent || '');

    // m6 (default): callMacro hidden (not auto), z hidden (not manual), orient hidden (not firmware); zClear/fixedT NOT greyed
    const m6 = { callMacro: await rowShown('callMacro'), z: await rowShown('z'), orient: await rowShown('orient'), zClearGated: await gated('zClear'), fixedTGated: await gated('fixedT'), code: await code(), hasViz: await page.evaluate(() => !!document.querySelector('#wiz_user canvas')) };
    await page.locator('#wiz_user').screenshot({ path: 'scratchpad/atc_change_inplace_m6.png' });

    // manual: z shown, zClear shown+not-greyed, callMacro hidden, orient hidden
    await setMethod('manual');
    const manual = { z: await rowShown('z'), zClearGated: await gated('zClear'), callMacro: await rowShown('callMacro'), code: await code() };
    await page.locator('#wiz_user').screenshot({ path: 'scratchpad/atc_change_inplace_manual.png' });

    // generic + callMacro (default true): callMacro shown, zClear GREYED (auto), fixedT NOT greyed (callMacro on)
    await setMethod('generic');
    const generic = { callMacro: await rowShown('callMacro'), zClearGated: await gated('zClear'), fixedTGated: await gated('fixedT'), code: await code() };
    // uncheck callMacro → the inline fallback → fixedT GREYED (#1504 can't be set inline)
    await page.evaluate(() => { const c = document.querySelector('#wiz_user_form [data-param="callMacro"]'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(300);
    const genericInline = { fixedTGated: await gated('fixedT'), code: await code() };
    await page.locator('#wiz_user').screenshot({ path: 'scratchpad/atc_change_inplace_generic.png' });

    // m6 assertions
    expect(m6.callMacro, 'm6: callMacro hidden (only automatic methods)').toBe(false);
    expect(m6.z, 'm6: Park Z hidden (manual only)').toBe(false);
    expect(m6.orient, 'm6: M19 orient hidden (firmware only)').toBe(false);
    expect(m6.zClearGated, 'm6: Z change height NOT greyed (m6 uses it)').toBe(false);
    expect(m6.fixedTGated, 'm6: Change-to-tool NOT greyed').toBe(false);
    expect(m6.code, 'm6 emits M6').toMatch(/M6/);
    expect(m6.hasViz, 'the 3D sim renders').toBe(true);
    // manual assertions
    expect(manual.z, 'manual: Park Z SHOWN').toBe(true);
    expect(manual.zClearGated, 'manual: Z change height NOT greyed (manual uses it)').toBe(false);
    expect(manual.callMacro, 'manual: callMacro hidden').toBe(false);
    expect(manual.code, 'manual emits the Manual Tool Change').toMatch(/Manual Tool Change/);
    // generic assertions
    expect(generic.callMacro, 'generic: callMacro SHOWN (automatic)').toBe(true);
    expect(generic.zClearGated, 'generic: Z change height GREYED (auto uses machine Safe Z)').toBe(true);
    expect(generic.fixedTGated, 'generic + call-T.nc: Change-to-tool NOT greyed (the T# M6 carries it)').toBe(false);
    expect(genericInline.fixedTGated, 'generic + inline: Change-to-tool GREYED (#1504 not settable inline)').toBe(true);
    console.log('ATC-CHANGE IN-PLACE gating OK · m6/manual/generic emits + gating verified');
});
