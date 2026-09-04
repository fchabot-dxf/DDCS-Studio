import { test, expect } from '@playwright/test';

/**
 * HOMING E3 (t554) — the in-place completion: the machine-frame 2D LAYOUT (envelope + declared HOME glyph + draggable Start) +
 * the 'Homing Setup…' button (opens the setup modal) + the unset-travel HINT. VERIFY the button opens the modal, an unset
 * travel shows the in-place hint, and the 2D layout is the machine frame. Screenshot the completed in-place homing.
 */
test.use({ viewport: { width: 1300, height: 980 } });

async function openHoming(page, mutate) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate((src) => { const s = window.ddcsGetSettings(); (new Function('s', src))(s); s.preview = s.preview || {}; s.preview.autoLoop = false; }, `(${mutate.toString()})(s)`);
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
}

test('the Homing Setup… button renders in-place + opens the setup modal', async ({ page }) => {
    await openHoming(page, (s) => {
        s.machine = { x: 600, y: 400, z: 500, show: false, workOrigin: { x: 0, y: 0, z: 0 } };
        s.homing = { axes: { z: { enable: true, order: 1 }, x: { enable: true, order: 2 }, y: { enable: true, order: 3 } } };
        s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true };
    });
    const btn = await page.evaluate(() => { const b = document.querySelector('#wiz_user_form [data-param="_setup"]'); return { present: !!b, text: b ? b.textContent : '' }; });
    expect(btn.present, 'the Homing Setup button renders in the in-place form').toBe(true);
    expect(btn.text.toLowerCase()).toContain('homing setup');
    // click → t624: the gear opens Settings → Machine → Homing (over the wizard), where the config now lives
    await page.click('#wiz_user_form [data-param="_setup"]');
    await page.waitForSelector('#settings-overlay.active #set_homing_section', { timeout: 6000 });
    const opened = await page.evaluate(() => ({
        machVisible: !!document.getElementById('set_tab_machine') && document.getElementById('set_tab_machine').offsetParent !== null,
        rows: document.querySelectorAll('#set_homing_axes .homing-axis-row').length,
    }));
    expect(opened.machVisible, 'the gear lands on the Machine tab').toBe(true);
    expect(opened.rows, 'the per-axis homing config rows render there').toBeGreaterThan(0);
    await page.screenshot({ path: 'scratchpad/homing_inplace_setup_modal.png' });
});

test('an unset axis travel shows the in-place unset-travel HINT (the t540 behaviour)', async ({ page }) => {
    await openHoming(page, (s) => {
        s.machine = { x: 600, y: 400, z: 0, show: false, workOrigin: { x: 0, y: 0, z: 0 } };   // Z travel UNSET
        s.homing = { axes: { z: { enable: true, order: 1 }, x: { enable: true, order: 2 }, y: { enable: true, order: 3 } } };
        s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true };
    });
    // t2601 — homing_data now migrates onto the declared uiChildren tree, whose status element carries a
    // `_tree`-suffixed id (formWidgets.js's own `nsId(...)`), not the classic shell's fixed `userVizStatus` —
    // several id variants can coexist (classic/tree/mini-preview), only one populated, so pick the non-empty one.
    const status = await page.evaluate(() => {
        const els = [...document.querySelectorAll('[id*="userVizStatus"]')];
        const withText = els.find((e) => (e.textContent || '').trim());
        return withText ? withText.textContent : (els[0] ? els[0].textContent : '');
    });
    expect(status.toLowerCase(), 'the panel status shows the unset-travel hint for Z').toContain('set z');
    expect(status.toLowerCase()).toContain('travel');
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/homing_inplace_unset_hint.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
});

test('the completed in-place homing: form + 3D + the 2D MACHINE layout (envelope + home + Start) — screenshot', async ({ page }) => {
    await openHoming(page, (s) => {
        s.machine = { x: 600, y: 400, z: 500, show: false, workOrigin: { x: 0, y: 0, z: 0 } };
        s.homing = { axes: { z: { enable: true, order: 1, backoff: 5 }, x: { enable: true, order: 2 }, y: { enable: true, order: 3 } } };
        s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true };
        s.stock = { show: true, x: 100, y: 100, z: 25, datum: 'nnp' };
    });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(400);
    // play the real emit so the tool + trail render. t2601 — `.wiz-viz3d` queried directly (not via a fixed
    // `#userViz3dContainer` id, which now carries a `_tree` suffix under the migrated tree render).
    await page.evaluate(() => { const host = document.querySelector('.wiz-viz3d'); const run = host.querySelector('.pp-run'); if (run) run.click(); const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.engine) p.engine.simSpeed = 60; });
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.engine && !p.engine.running; }, null, { timeout: 25000 });
    await page.waitForTimeout(200);
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/homing_inplace_complete.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    // the 2D is the machine frame (a HOME glyph text is present in the layout SVG). t2601 — `[id*="userVizContainer"]`
    // (id-substring, several instances can coexist) rather than the classic shell's fixed id.
    const hasHome = await page.evaluate(() => [...document.querySelectorAll('[id*="userVizContainer"] text')].some((t) => /HOME/.test(t.textContent)));
    expect(hasHome, 'the 2D machine layout shows the HOME glyph label').toBe(true);
});
