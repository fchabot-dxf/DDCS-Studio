import { test, expect } from '@playwright/test';

/**
 * ATC-TABLE E2 (t568) — COMPLETES port 3 of 3 AND the WHOLE PORT CAMPAIGN (every wizard is now a data twin). The
 * user_atc_table_data twin is seeded + wired IN-PLACE via the Tool Table slot's `opensAs`. VERIFY: the slot opensAs the twin
 * (plain title, twin retired) · the in-place form = the two include toggles + the 'Edit table…' action button + the emit
 * preview (NO second table editor — the edit UI stays Settings → Tool table) · the machine + magazine 3D sim.
 */
const OPTYPE = 'user_atc_table_data';

test('opensAs wiring: Tool Table opens the twin IN-PLACE (plain title, twin retired) + opSimContext machine+magazine', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (OPTYPE) => {
        const WL = await import('/blocks/wizardLibrary.js');
        const { opSimContext } = await import('/viz/opSimContext.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const entries = WL.listEntries();
        const slot = entries.find((e) => e.id === 'atc_table');
        const twinEntry = entries.find((e) => e.type === OPTYPE);
        return { opensAs: slot && slot.opensAs, title: WL.builtinLabelForTwin(OPTYPE), twinRetired: !twinEntry, registered: !!builderOf(OPTYPE), ctx: opSimContext(OPTYPE) };
    }, OPTYPE);
    expect(r.registered, 'the twin is seeded/registered on boot').toBe(true);
    expect(r.opensAs, 'the built-in Tool Table slot opensAs the twin').toBe(OPTYPE);
    expect(r.title, 'the seamless in-place title is the built-in plain label').toBe('Tool Table');
    expect(r.twinRetired, "the twin's own atc_datawiz menu entry is retired").toBe(true);
    expect(r.ctx.forceMachine && r.ctx.showMagazine, 'FORCE_MACHINE + WITH_MAGAZINE carry to the twin').toBe(true);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('DRIVE: Tool Table opens IN-PLACE — the two include toggles + the Edit-table button + the live-view emit + the 3D sim', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => {
        const real = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        window.__realSettings = real;
        window.ddcsGetSettings = () => ({ ...window.__realSettings, atc: { ...(window.__realSettings.atc || {}), tools: [{ num: 1, length: 42, name: 'endmill' }, { num: 2, length: 55, name: 'drill' }], magazine: [{ pocket: 1, x: 100, y: 50, z: -20 }, { pocket: 2, x: 150, y: 50, z: -20 }] } });
    });
    await page.evaluate((op) => window.openWiz(op), OPTYPE);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
        const f = document.getElementById('wiz_user_form');
        const params = [...new Set(Array.from(f.querySelectorAll('[data-param]')).map((e) => e.getAttribute('data-param')))];
        const editBtn = f.querySelector('[data-param="_setup"]');
        const code = (document.getElementById('wiz_user_code') || {}).textContent || '';
        return { params, hasEditBtn: !!(editBtn && editBtn.textContent.includes('Edit')), code, hasViz: !!document.querySelector('#wiz_user canvas') };
    });
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/atc_table_inplace.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    expect(r.params.includes('includeLengths'), 'the "Write tool lengths" toggle renders').toBe(true);
    expect(r.params.includes('includePockets'), 'the "Write pocket positions" toggle renders').toBe(true);
    expect(r.hasEditBtn, 'the "Edit table…" action button renders (no second table editor)').toBe(true);
    expect(r.code, 'the emit unrolls T1 from the live table (#1430 = 42)').toMatch(/#1430=42/);
    expect(r.code, 'the emit unrolls T2 (#1431 = 55)').toMatch(/#1431=55/);
    expect(r.hasViz, 'the 3D machine-frame sim renders').toBe(true);
    console.log('ATC-TABLE IN-PLACE: ' + r.params.join(',') + ' | ' + r.code.split('\n').length + ' lines');
});
