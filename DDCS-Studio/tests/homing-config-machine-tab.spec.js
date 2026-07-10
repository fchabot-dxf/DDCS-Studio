import { test, expect } from '@playwright/test';

/**
 * HOMING CONFIG MOVES HOME (t624). The per-axis homing config GUI moved from Macros → sysstart into Settings → Machine
 * → Homing (it edits settings.homing = MACHINE PROFILE data). The wizard gear now opens Settings OVER the wizard (return
 * on close), landing on the Machine tab's Homing section. The Macros sysstart panel keeps its macro bits + a summary/link.
 * settings.homing shape is UNCHANGED (the wizard emit + pull-seeding still read it).
 */
test.use({ viewport: { width: 1300, height: 980 } });

test('the wizard gear opens Settings OVER the wizard at Machine → Homing, editing a feed flows to the homing emit, and closing returns to the wizard', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: 400, z: 500, show: false, workOrigin: { x: 0, y: 0, z: 0 } };
        s.homing = { philosophy: 'sequential', axes: { z: { enable: true, order: 1, method: 'seek', seekFeed: 600 }, x: { enable: true, order: 2, method: 'seek', seekFeed: 800 }, y: { enable: true, order: 3, method: 'seek', seekFeed: 800 } } };
        s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true };
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    });
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });

    // click the gear → Settings opens OVER the wizard at Machine → Homing
    await page.click('#wiz_user_form [data-param="_setup"]');
    await page.waitForSelector('#settings-overlay.active #set_homing_section', { timeout: 8000 });
    const over = await page.evaluate(() => {
        const machVisible = !!document.querySelector('#set_tab_machine') && document.getElementById('set_tab_machine').offsetParent !== null;
        const rows = document.querySelectorAll('#set_homing_axes .homing-axis-row').length;
        // Settings renders ON TOP of the wizard (hit-test the overlay panel centre)
        const panel = document.querySelector('#settings-app') || document.querySelector('#settings-overlay');
        const r = panel.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const wizStillMounted = !!document.querySelector('#wiz_user_form');   // the wizard stays mounted behind
        return { machVisible, rows, insideSettings: !!(top && top.closest('#settings-overlay')), wizStillMounted };
    });
    expect(over.machVisible, 'lands on the Machine tab').toBe(true);
    expect(over.rows, 'the per-axis homing rows render in the Machine tab').toBeGreaterThan(0);
    expect(over.insideSettings, 'Settings renders OVER the wizard (hit-test)').toBe(true);
    expect(over.wizStillMounted, 'the wizard is still mounted behind').toBe(true);
    await page.screenshot({ path: 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad/homing-settings-over-wizard.png' });

    // edit the Z seek feed in the Homing section → commitHoming → settings.homing.axes.z.seekFeed
    await page.evaluate(() => {
        const row = [...document.querySelectorAll('#set_homing_axes .homing-axis-row')].find((r) => r.getAttribute('data-axis') === 'z');
        const inp = row.querySelector('.hm-seekfeed');
        inp.value = '1234';
        inp.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const seek = await page.evaluate(() => window.ddcsGetSettings().homing.axes.z.seekFeed);
    expect(seek, 'the edited feed persisted to settings.homing').toBe(1234);
    // …and it flows into the homing EMIT (the wizard/sysstart read settings.homing → homingStack)
    const emit = await page.evaluate(async () => {
        const { homingStack } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const h = window.ddcsGetSettings().homing;
        return emitMapped(homingStack({ axes: ['z', 'x', 'y'], config: h.axes, machine: window.ddcsGetSettings().machine, limits: window.ddcsGetSettings().limits, softLimits: true })).text;
    });
    expect(emit, 'the new Z seek feed appears in the emitted homing G-code').toMatch(/1234/);

    // close Settings → the wizard is still there (return works)
    await page.evaluate(() => { const b = document.querySelector('#settings-app [data-close], #settings-overlay .set-close, #settings-close'); if (b) b.click(); else if (window.closeSettings) window.closeSettings(); });
    await page.waitForTimeout(200);
    const back = await page.evaluate(() => ({ wizThere: !!document.querySelector('#wiz_user_form'), settingsClosed: !document.querySelector('#settings-overlay.active') }));
    expect(back.settingsClosed, 'Settings closed').toBe(true);
    expect(back.wizThere, 'the wizard is still there after closing Settings (return)').toBe(true);
});

test('the Macros → sysstart panel is a STORED, editable boot-macro editor (t656) — the homing summary + link are GONE', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.showApp);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: 400, z: 500, softLimits: true };
        s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true };
        s.homing = { philosophy: 'sequential', axes: { z: { enable: true, order: 1, method: 'seek', seekFeed: 600 }, x: { enable: true, order: 2, method: 'seek', seekFeed: 800 }, y: { enable: true, order: 3, method: 'seek', seekFeed: 800 } } };
        s.autostartBody = undefined; s.autostartHandEdited = false;   // fresh → the panel migrates (seeds) the body on open
    });
    await page.evaluate(() => window.showApp('macros'));   // macros app inits lazily on first switch (seeds + wires the stored body)
    await page.waitForFunction(() => window.showMacrosPanel, null, { timeout: 8000 });
    await page.evaluate(() => window.showMacrosPanel('macros_panel_sysstart'));
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => ({
        body: (document.getElementById('sysstart_body') || {}).value || '',
        hasEditor: !!document.getElementById('sysstart_body'),
        hasRegen: !!document.getElementById('sysstart_regen'),
        droppedSection: !document.getElementById('sysstart_homing_summary') && !document.getElementById('sysstart_homing_link') && !document.getElementById('sysstart_gen'),
        noAxesEditor: !document.getElementById('set_homing_axes'),   // the editable per-axis GUI stays in Settings → Machine → Homing
    }));
    expect(info.hasEditor, 'the stored boot-macro editor is present').toBe(true);
    expect(info.hasRegen, 'the Regenerate button is present').toBe(true);
    // MIGRATED (seeded) with the REAL homing sequence, not empty
    expect(info.body, 'the body is seeded from the homing profile (G31 sequence)').toMatch(/G31 Z\S+ F600/);
    expect(info.body, 'the seeded body wraps with M30').toMatch(/M30/);
    // the dropped section: the homing summary + the Settings link + the old Generate are GONE
    expect(info.droppedSection, 'the homing-summary section + link + old Generate are removed').toBe(true);
    expect(info.noAxesEditor, 'the editable per-axis GUI never lived in Macros (one-source)').toBe(true);
    await page.locator('#macros_panel_sysstart').screenshot({ path: 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad/homing-macros-summary.png' });
});
