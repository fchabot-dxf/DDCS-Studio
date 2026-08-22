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

/**
 * t2129 (review) — a real audio-synthesis spy, installed BEFORE navigation so it wraps the page's OWN
 * AudioContext/HTMLAudioElement before sound.js's lazily-created singleton ever calls `new`. Without this,
 * "never throws" was the only thing any test here actually proved — deleting the master-mute check
 * entirely left the whole file green, because nothing asserted that muting silences real audio nodes.
 */
async function installAudioSpy(page) {
    await page.addInitScript(() => {
        window.__audioSpy = { synthCount: 0, sampleCount: 0 };
        const OrigCtx = window.AudioContext || window.webkitAudioContext;
        function SpyCtx(...args) {
            const ctx = new OrigCtx(...args);
            const origOsc = ctx.createOscillator.bind(ctx);
            ctx.createOscillator = (...a) => { window.__audioSpy.synthCount++; return origOsc(...a); };
            const origBuf = ctx.createBufferSource.bind(ctx);
            ctx.createBufferSource = (...a) => { window.__audioSpy.synthCount++; return origBuf(...a); };
            return ctx;
        }
        window.AudioContext = SpyCtx;
        window.webkitAudioContext = SpyCtx;
        const origPlay = HTMLAudioElement.prototype.play;
        HTMLAudioElement.prototype.play = function (...a) {
            window.__audioSpy.sampleCount++;
            return origPlay.apply(this, a).catch(() => {});
        };
    });
}
async function resetSpy(page) { await page.evaluate(() => { window.__audioSpy = { synthCount: 0, sampleCount: 0 }; }); }
async function spyCounts(page) { return page.evaluate(() => window.__audioSpy); }

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

test('sfx() actually silences synthesis when the master is OFF, and actually produces it when ON', async ({ page }) => {
    // t2129 (review) — the central claim of the whole feature, previously asserted nowhere: deleting
    // `!masterOn() || ` from sfx() left this file's OLD test suite fully green. Proven here by counting
    // REAL AudioContext node creation, not by checking for the absence of a thrown error.
    await installAudioSpy(page);
    await boot(page);
    await resetSpy(page);

    await page.evaluate(async () => {
        const { sfx } = await import('/ui/sound.js');
        window.ddcsGetSettings().sound.enabled = false;
        sfx('ui.click');
    });
    const off = await spyCounts(page);
    expect(off.synthCount, 'master OFF must create ZERO audio nodes').toBe(0);

    // a DIFFERENT action name than the OFF check above — sfx()'s own 60ms debounce is keyed per action
    // name and module state (the lastFired Map) persists across these two evaluate() round trips, so
    // reusing 'ui.click' here risks a false negative if the two calls land inside that window.
    await page.evaluate(async () => {
        const { sfx } = await import('/ui/sound.js');
        const s = window.ddcsGetSettings();
        s.sound.enabled = true; s.sound.off = [];
        sfx('ui.toggle');
    });
    const on = await spyCounts(page);
    expect(on.synthCount, 'master ON, nothing silenced, must actually synthesize').toBeGreaterThan(0);
});

test('sfx() silences ONLY the per-action off-listed sound, not its siblings', async ({ page }) => {
    await installAudioSpy(page);
    await boot(page);
    await resetSpy(page);

    await page.evaluate(async () => {
        const { sfx } = await import('/ui/sound.js');
        const s = window.ddcsGetSettings();
        s.sound.enabled = true; s.sound.off = ['ui.click'];
        sfx('ui.click');   // silenced
    });
    expect((await spyCounts(page)).synthCount, "the specifically-silenced action must create nothing").toBe(0);

    await page.evaluate(async () => {
        const { sfx } = await import('/ui/sound.js');
        sfx('ui.toggle');   // a DIFFERENT action, never silenced
    });
    expect((await spyCounts(page)).synthCount, 'a sibling action must be unaffected').toBeGreaterThan(0);
});

test('the preview button plays a silenced sound regardless of its own toggle or the master switch', async ({ page }) => {
    // t2129 (review) — the old assertion was only "does not throw", which a version of previewSfx that
    // silently did nothing (killing the ▶ button for every muted sound) would also satisfy. Now proves
    // audio is ACTUALLY produced despite both toggles being off.
    await installAudioSpy(page);
    await boot(page);
    await openSoundTab(page);
    await resetSpy(page);

    const threw = await page.evaluate(async () => {
        const { previewSfx } = await import('/ui/sound.js');
        const s = window.ddcsGetSettings();
        s.sound.enabled = false;             // master OFF
        s.sound.off = ['ui.click'];          // AND this specific action silenced
        try { previewSfx('ui.click'); return null; } catch (e) { return String(e); }
    });
    expect(threw, 'previewSfx must never throw').toBeNull();
    const counts = await spyCounts(page);
    expect(counts.synthCount + counts.sampleCount, 'previewSfx must actually play — a silently-no-op preview button is the exact defect this test exists to catch').toBeGreaterThan(0);
});

test('previewSfx also plays a SAMPLE-kind action (job.arrived) despite both toggles', async ({ page }) => {
    await installAudioSpy(page);
    await boot(page);
    await resetSpy(page);
    await page.evaluate(async () => {
        const { previewSfx } = await import('/ui/sound.js');
        const s = window.ddcsGetSettings();
        s.sound.enabled = false;
        s.sound.off = ['job.arrived'];
        previewSfx('job.arrived');
    });
    expect((await spyCounts(page)).sampleCount, 'a sample-kind preview must invoke real Audio.play()').toBeGreaterThan(0);
});

test('the gateway Setup toggle is gone — enable_chime is not part of the config payload', async ({ page }) => {
    // t2125 ruling: "THE GATEWAY OWN SETUP TOGGLE MUST GO" -- no second, independently-settable switch
    // anywhere in Studio's own surface. t2129 (review): the original 3-module list was never where such a
    // checkbox would actually live (web/ui/gateway/views/admin.js — which renders the sibling enable_slave
    // checkbox — wasn't even in it), so this passed at the parent commit and on a full revert alike; the
    // ONE real guard of the ⛔ ruling is bridge/bridge-app/tests/test_sound_toggle_2125.py's
    // test_enable_chime_is_fully_retired. This is now an honest best-effort sweep of every UI module
    // (broad enough to include admin.js) rather than a hand-picked list that happened to be wrong.
    await boot(page);
    const stillReferenced = await page.evaluate(async () => {
        const modules = [
            '/ui/settingsPanel.js', '/ui/gatewayStatus.js', '/ui/gatewayPanel.js',
            '/ui/gateway/views/admin.js', '/ui/gateway/views/status.js', '/ui/gateway/service.js',
            '/ui/sound.js',
        ];
        const hits = [];
        for (const m of modules) {
            try {
                const txt = await (await fetch(m)).text();
                if (txt.includes('enable_chime')) hits.push(m);
            } catch (_) { /* module may not exist under this name -- fine */ }
        }
        return hits;
    });
    expect(stillReferenced, 'no shipped module still references the retired enable_chime toggle').toEqual([]);
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

test('the WHERE-split is real: job.arrived/delivered/failed have NO browser sfx() call site, job.sent has exactly one', async ({ page }) => {
    // t2129 (review) — "the client/gateway split is in the title, asserted nowhere". job.arrived/delivered/
    // failed are declared in ACTION (so the Settings preview button works) but must NEVER be triggered
    // from this browser's own code — they're the gateway's chime.py's job, per JOB-RULES.md §7. Checks the
    // SERVED source, not just the declaration, since a stray sfx('job.arrived') call site elsewhere in the
    // app would double-fire it on a one-box setup and this ACTION-shape test alone would never catch that.
    await boot(page);
    const counts = await page.evaluate(async () => {
        const files = [
            '/app.js', '/wizardManager.js', '/ui/gateway/views/send.js', '/blocks/blockly/tokenGuard.js',
            '/ui/gatewayPanel.js', '/ui/gateway/views/status.js', '/ui/gateway/views/jobs.js', '/ui/gateway/views/tracker.js',
        ];
        const texts = await Promise.all(files.map((f) => fetch(f).then((r) => r.text()).catch(() => '')));
        const all = texts.join('\n');
        const count = (needle) => (all.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        return {
            arrived: count("sfx('job.arrived')"), delivered: count("sfx('job.delivered')"), failed: count("sfx('job.failed')"),
            sent: count("sfx('job.sent')"),
        };
    });
    expect(counts.arrived, 'job.arrived must never be fired from the browser').toBe(0);
    expect(counts.delivered, 'job.delivered must never be fired from the browser').toBe(0);
    expect(counts.failed, 'job.failed must never be fired from the browser').toBe(0);
    expect(counts.sent, 'job.sent must be fired from exactly the one real send point').toBe(1);
});
