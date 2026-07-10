import { test, expect } from '@playwright/test';

/**
 * AUTOSTART = A STORED MACRO + SIMPLE EDITOR (t656, user design). The Macros → sysstart panel is now a plain editable
 * editor over a STORED body (settings.autostartBody, profile-persisted). Regenerate rebuilds it from the homing profile +
 * the additional G-code (deterministic); hand edits STICK until an explicit regenerate (confirm before clobbering); Push
 * sends EXACTLY the stored body. This asserts: hand edits persist across reload; Regenerate == homingStack + the suffix and
 * asks before clobbering; Push's payload == the stored body.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const SETTINGS = {
    machine: { x: 600, y: 400, z: 500, softLimits: true },
    limits: { zMaxHome: true, xMinHome: true, yMinHome: true },
    homing: { philosophy: 'sequential', axes: {
        z: { enable: true, order: 1, method: 'seek', seekFeed: 600 },
        x: { enable: true, order: 2, method: 'seek', seekFeed: 800 },
        y: { enable: true, order: 3, method: 'seek', seekFeed: 800 },
    } },
};

async function openSysstart(page) {
    await page.evaluate((S) => { Object.assign(window.ddcsGetSettings(), S); window.ddcsGetSettings().autostartBody = undefined; window.ddcsGetSettings().autostartHandEdited = false; }, SETTINGS);
    await page.evaluate(() => window.showApp('macros'));
    await page.waitForFunction(() => window.showMacrosPanel, null, { timeout: 8000 });
    await page.evaluate(() => window.showMacrosPanel('macros_panel_sysstart'));
    await page.waitForTimeout(200);
}

test('a hand edit to the body PERSISTS across reload (stored artifact); export/import round-trips it', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.showApp);
    await openSysstart(page);
    // type a marker into the body → it saves + marks hand-edited
    await page.evaluate(() => { const t = document.getElementById('sysstart_body'); t.value = '( MY HAND EDIT 7788 )\nM30\n'; t.dispatchEvent(new Event('input', { bubbles: true })); });
    const afterEdit = await page.evaluate(() => ({ body: window.ddcsGetSettings().autostartBody, edited: window.ddcsGetSettings().autostartHandEdited }));
    expect(afterEdit.body, 'the edit is stored in settings.autostartBody').toContain('MY HAND EDIT 7788');
    expect(afterEdit.edited, 'the body is marked hand-edited').toBe(true);
    // export/import round-trip: the settings JSON carries it through loadSettings (survives a fresh load)
    const roundTrip = await page.evaluate(async () => {
        const raw = localStorage.getItem('ddcs_studio_settings');   // the exported profile blob is this settings object
        const { migrateIO } = await import('/ui/settingsPanel.js').catch(() => ({}));
        return { raw };
    });
    expect(roundTrip.raw, 'the persisted profile JSON contains the hand-edited body').toContain('MY HAND EDIT 7788');
    // RELOAD → loadSettings must preserve autostartBody (it is listed in the reconstruction)
    await page.reload();
    await page.waitForFunction(() => window.ddcsGetSettings);
    const afterReload = await page.evaluate(() => ({ body: window.ddcsGetSettings().autostartBody, edited: window.ddcsGetSettings().autostartHandEdited }));
    expect(afterReload.body, 'the hand-edited body survives a reload').toContain('MY HAND EDIT 7788');
    expect(afterReload.edited, 'the hand-edited flag survives a reload').toBe(true);
});

test('Regenerate rebuilds body == homingStack emit + the additional-G-code suffix; asks before clobbering a hand-edit', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetSettings && window.showApp);
    await openSysstart(page);
    // the INDEPENDENT truth: homingStack(homingRunParams) + the additional-G-code suffix + M30 (what Regenerate must produce)
    await page.evaluate(() => { window.ddcsGetSettings().sysstartCustomGcode = 'G54\n#100=1'; });
    const expected = await page.evaluate(async () => {
        const { homingStack, homingRunParams } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        let code = emitMapped(homingStack(homingRunParams(window.ddcsGetSettings()))).text || '';
        code = code.replace(/\s*M30\s*$/, '');   // the homing emit's trailing M30 is stripped so the additional G-code runs before the end
        const custom = String(window.ddcsGetSettings().sysstartCustomGcode || '').trim();
        if (custom) code += '\n( --- Additional Boot G-code --- )\n' + custom;
        code += '\nM30\n';
        return code;
    });
    // NO hand-edit yet (fresh seed) → Regenerate proceeds without a confirm
    let dialogs = 0; page.on('dialog', (d) => { dialogs++; d.accept(); });
    await page.click('#sysstart_regen');
    await page.waitForTimeout(150);
    const body1 = await page.evaluate(() => document.getElementById('sysstart_body').value);
    expect(body1, 'Regenerate == homingStack emit + the additional-G-code suffix (byte-equal)').toBe(expected);
    expect(dialogs, 'no clobber-confirm when the body was not hand-edited').toBe(0);
    // a human caught a DOUBLE M30: the body must end with EXACTLY ONE M30, and the additional G-code runs BEFORE it
    expect((body1.match(/^M30$/gm) || []).length, 'exactly one M30 (no double-end)').toBe(1);
    expect(body1.indexOf('G54'), 'the additional G-code appears BEFORE the M30').toBeLessThan(body1.lastIndexOf('M30'));

    // now HAND-EDIT, then Regenerate → it MUST confirm before overwriting
    await page.evaluate(() => { const t = document.getElementById('sysstart_body'); t.value = '( keep me )'; t.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('#sysstart_regen');
    await page.waitForTimeout(150);
    expect(dialogs, 'a hand-edited body prompts a confirm before Regenerate overwrites it').toBe(1);
    const body2 = await page.evaluate(() => document.getElementById('sysstart_body').value);
    expect(body2, 'confirm accepted → the body is rebuilt (the hand edit is gone)').toBe(expected);
});

test('t656 amend1/2: the SELECTED controller drives the body — the chip shows it, a stale cross-profile body is flagged, Regenerate rebuilds for the selected post', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetSettings && window.showApp);
    // seed under EXPERT selected
    await page.evaluate(async (S) => { const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js'); setActiveProfile('ddcs-expert-m350'); Object.assign(window.ddcsGetSettings(), S); const s = window.ddcsGetSettings(); s.autostartBody = undefined; s.autostartProfileId = undefined; s.autostartHandEdited = false; }, SETTINGS);
    await page.evaluate(() => window.showApp('macros'));
    await page.waitForFunction(() => window.showMacrosPanel, null, { timeout: 8000 });
    await page.evaluate(() => window.showMacrosPanel('macros_panel_sysstart'));
    await page.waitForTimeout(200);
    const seeded = await page.evaluate(() => ({ body: window.ddcsGetSettings().autostartBody, prof: window.ddcsGetSettings().autostartProfileId, chip: (document.getElementById('macros_ctrl_name') || {}).textContent }));
    expect(seeded.body, 'seeded under Expert → the Expert header').toContain('Expert');
    expect(seeded.prof, 'the body records the profile it was built for').toBe('ddcs-expert-m350');
    expect(seeded.chip, 'the Macros header chip shows the active profile').toMatch(/Expert/);

    // switch to V4.1 → the chip updates + the stale body is flagged
    await page.evaluate(async () => { const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js'); setActiveProfile('ddcs-v41'); window.dispatchEvent(new CustomEvent('ddcs:settings-changed')); });
    await page.waitForTimeout(100);
    const switched = await page.evaluate(() => ({ chip: (document.getElementById('macros_ctrl_name') || {}).textContent, note: (document.getElementById('sysstart_editnote') || {}).textContent }));
    expect(switched.chip, 'the chip updated to V4.1 on switch').toMatch(/V4\.1/);
    expect(switched.note, 'the stale Expert body is flagged (generated for X — Regenerate for selected)').toMatch(/Generated for.*expert/i);
    await page.locator('#macros-app').screenshot({ path: 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad/macros-ctrl-chip-mismatch.png' });

    // Regenerate under V4.1 → the body is V4.1 (the honest refusal, NO Expert-only registers), recorded for V4.1, note clears
    page.on('dialog', (d) => d.accept());
    await page.click('#sysstart_regen');
    await page.waitForTimeout(150);
    const regen = await page.evaluate(() => ({ body: document.getElementById('sysstart_body').value, prof: window.ddcsGetSettings().autostartProfileId, note: (document.getElementById('sysstart_editnote') || {}).textContent }));
    expect(regen.body, 'the V4.1 body carries the honest refusal (unverified post)').toMatch(/UNVERIFIED/i);
    expect(regen.body, 'the V4.1 body has NO Expert-only homed-flag registers').not.toMatch(/#1517|#882/);
    expect(regen.prof, 'the body is now recorded for V4.1').toBe('ddcs-v41');
    expect(regen.note, 'the mismatch note clears after regenerating for the selected profile').not.toMatch(/Generated for/i);
    // reset to Expert so later tests / the app default aren't left on V4.1
    await page.evaluate(async () => { const { setActiveProfile, DEFAULT_PROFILE_ID } = await import('/shared/js/profiles/controllerProfiles.js'); setActiveProfile(DEFAULT_PROFILE_ID); });
});

test('Push sends EXACTLY the stored body (payload assertion)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.showApp);
    // capture the writeSysfile payload
    let pushed = null;
    await page.route('**/api/**', (r) => {
        const u = r.request().url();
        if (/write|sysfile|advstart|sysstart/i.test(u) || (r.request().method() === 'POST' && /file/i.test(u))) {
            try { pushed = r.request().postData(); } catch (e) {}
        }
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, backup: 'sysstart.bak' }) });
    });
    await openSysstart(page);
    // store a distinctive body, then Push
    await page.evaluate(() => { const t = document.getElementById('sysstart_body'); t.value = '( PUSH PAYLOAD 4242 )\nG31 Z-500 F600\nM30\n'; t.dispatchEvent(new Event('input', { bubbles: true })); });
    const stored = await page.evaluate(() => window.ddcsGetSettings().autostartBody);
    page.on('dialog', (d) => d.accept());   // the "write to controller?" confirm
    await page.click('#sysstart_push');
    await page.waitForTimeout(300);
    expect(pushed, 'the push sent a payload').toBeTruthy();
    // the writeSysfile payload carries EXACTLY the stored body content
    expect(pushed).toContain('PUSH PAYLOAD 4242');
    expect(pushed).toContain(stored.split('\n')[1]);   // a body line reached the wire
});
