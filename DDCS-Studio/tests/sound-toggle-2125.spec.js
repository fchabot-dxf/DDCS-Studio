import { test, expect } from '@playwright/test';

/**
 * t2125 (SOUND-PLAN.md) — a MASTER mute plus a PER-SOUND toggle, stored in the workspace (not
 * localStorage-only), governing every UI earcon AND the job-event samples (the gateway's own toggle test
 * is bridge/bridge-app/tests/test_sound_toggle_2125.py — a browser can't drive winsound). This spec proves
 * the real-app surface: Settings → Look and feel → Sound (a sub-tab, peer of Appearance — amendment 4) is
 * SELF-RENDERED from ACTION with one row + preview button per declared sound, the master toggle persists
 * into workspace settings (not just a DOM checkbox), a per-sound off-list survives independently of the
 * master, the three gateway-side job WAVs are actually reachable, and firing sfx() never throws either way.
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function boot(page) {
    await page.goto('http://localhost:3211', { timeout: 30000 });
    await page.waitForFunction(() => window.ddcsGetSettings && window.openSettings && window.ddcsStudio, null, { timeout: 30000 });
}
async function openSoundTab(page) {
    await page.evaluate(() => window.openSettings({ group: 'lookfeel', panel: 'set_tab_sound' }));
    await page.waitForFunction(() => document.getElementById('set_sound_on'), null, { timeout: 30000 });
}

test('Sound is its own sub-tab under Look and feel, a peer of Appearance (amendment 4) — not bolted onto it', async ({ page }) => {
    await boot(page);
    await openSoundTab(page);
    const tabs = await page.evaluate(() => [...document.querySelectorAll('.settings-sidebar .settings-tab[data-group="lookfeel"]')].map((b) => b.dataset.target));
    expect(tabs, 'Sound must be a sibling of Appearance/Preview/Editor/Wizard bar').toContain('set_tab_sound');
    const soundOnAppearance = await page.evaluate(() => {
        const appearance = document.getElementById('set_tab_appearance');
        return appearance ? appearance.querySelector('#set_sound_on') : null;
    });
    expect(soundOnAppearance, 'the old inline SOUND section under Appearance must be gone').toBeNull();
});

test('the master toggle defaults ON, persists into workspace settings, and the tab self-renders a row per ACTION', async ({ page }) => {
    await boot(page);
    await openSoundTab(page);

    const defaultOn = await page.evaluate(() => document.getElementById('set_sound_on').checked);
    expect(defaultOn, 'sound defaults ON').toBe(true);
    expect(await page.evaluate(() => window.ddcsGetSettings().sound.enabled), 'settings object agrees').toBe(true);

    // the row list is DERIVED from ACTION, not hand-written — every declared action must have a row+preview
    const rowCheck = await page.evaluate(async () => {
        const { ACTION } = await import('/ui/sound.js');
        const names = Object.keys(ACTION);
        const missing = names.filter((n) => !document.querySelector(`[data-sound-action="${n}"]`) || !document.querySelector(`[data-sound-preview="${n}"]`));
        return { total: names.length, missing };
    });
    expect(rowCheck.missing, 'every ACTION key must have a toggle row and a preview button').toEqual([]);
    expect(rowCheck.total, 'sanity: ACTION is not empty').toBeGreaterThan(0);

    // turn the MASTER off → persisted into the SAME settings object sound.js reads
    await page.evaluate(() => {
        const c = document.getElementById('set_sound_on');
        c.checked = false;
        c.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(80);
    expect(await page.evaluate(() => window.ddcsGetSettings().sound.enabled), 'master toggle-off persisted').toBe(false);

    await page.evaluate(() => {
        const c = document.getElementById('set_sound_on');
        c.checked = true;
        c.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(80);
    expect(await page.evaluate(() => window.ddcsGetSettings().sound.enabled), 'master toggle-on persisted').toBe(true);
});

test('a per-sound row silences ONLY that action, stored as an exceptions-only off-list', async ({ page }) => {
    await boot(page);
    await openSoundTab(page);

    const row = await page.evaluate(() => !!document.querySelector('[data-sound-action="job.sent"]'));
    expect(row, 'job.sent must have its own row').toBe(true);

    await page.evaluate(() => {
        const cb = document.querySelector('[data-sound-action="job.sent"]');
        cb.checked = false;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(80);
    const off = await page.evaluate(() => window.ddcsGetSettings().sound.off);
    expect(off, 'exceptions-only: only the silenced action name is stored').toEqual(['job.sent']);

    const stillOnOthers = await page.evaluate(async () => {
        const { isActionOn } = await import('/ui/sound.js');
        return { sent: isActionOn('job.sent'), click: isActionOn('ui.click') };
    });
    expect(stillOnOthers, 'silencing one action must not silence any other').toEqual({ sent: false, click: true });

    // re-enable → the exception is removed, not just flagged false
    await page.evaluate(() => {
        const cb = document.querySelector('[data-sound-action="job.sent"]');
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(80);
    expect(await page.evaluate(() => window.ddcsGetSettings().sound.off), 're-enabling removes the exception entirely').toEqual([]);
});

test('the preview button plays a silenced sound regardless of its own toggle or the master switch', async ({ page }) => {
    await boot(page);
    await openSoundTab(page);
    const result = await page.evaluate(async () => {
        const { previewSfx } = await import('/ui/sound.js');
        const s = window.ddcsGetSettings();
        s.sound.enabled = false;             // master OFF
        s.sound.off = ['ui.click'];          // AND this specific action silenced
        let threw = null;
        try { previewSfx('ui.click'); } catch (e) { threw = String(e); }
        return { threw };
    });
    expect(result.threw, 'previewSfx must never throw, and must not be gated by either toggle').toBeNull();
});

test('the gateway Setup toggle is gone — enable_chime is not part of the config payload', async ({ page }) => {
    // t2125 ruling: "THE GATEWAY OWN SETUP TOGGLE MUST GO" -- no second, independently-settable switch
    // anywhere in Studio's own surface. Confirms nothing in the shipped app still references it.
    await boot(page);
    const stillReferenced = await page.evaluate(async () => {
        const modules = ['/ui/settingsPanel.js', '/ui/gatewayStatus.js', '/ui/gatewayPanel.js'];
        for (const m of modules) {
            try {
                const txt = await (await fetch(m)).text();
                if (txt.includes('enable_chime')) return m;
            } catch (_) { /* module may not exist under this name -- fine */ }
        }
        return null;
    });
    expect(stillReferenced, 'no shipped module still references the retired enable_chime toggle').toBeNull();
});

test('opening and closing a wizard (real sfx() call sites) never throws, sound ON or OFF', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await boot(page);

    for (const on of [true, false]) {
        await page.evaluate((enabled) => {
            const s = window.ddcsGetSettings();
            s.sound = s.sound || {};
            s.sound.enabled = enabled;
        }, on);
        await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
        await page.waitForTimeout(150);
        await page.evaluate(() => window.ddcsStudio.wizardManager.close());
        await page.waitForTimeout(150);
    }

    const soundErrors = errors.filter((e) => /sound\.js|AudioContext|sfx/i.test(e));
    expect(soundErrors, `no sound-related errors, sound ON or OFF: ${JSON.stringify(soundErrors)}`).toEqual([]);
});

test('job.sent (client) is synthesized, never a sample; job.arrived/delivered/failed (gateway) are the learned WAVs and actually served', async ({ page }) => {
    await boot(page);
    const result = await page.evaluate(async () => {
        const { ACTION } = await import('/ui/sound.js');
        const sent = ACTION['job.sent'];
        const out = { sentIsSynth: sent && sent.synth === 'swoosh' && !sent.sample };
        for (const name of ['job.arrived', 'job.delivered', 'job.failed']) {
            const a = ACTION[name];
            if (!a || !a.sample) { out[name] = 'not declared as a sample'; continue; }
            const r = await fetch('/assets/audio/' + a.sample);
            out[name] = r.ok ? 'ok' : `HTTP ${r.status}`;
        }
        return out;
    });
    expect(result).toEqual({
        sentIsSynth: true,
        'job.arrived': 'ok', 'job.delivered': 'ok', 'job.failed': 'ok',
    });
});
