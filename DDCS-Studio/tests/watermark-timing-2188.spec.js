import { test, expect } from '@playwright/test';

/**
 * t2188 — the watermark-timing bug diagnosed at t2186: data/backup.js's `settings` BACKUP_STORES row read
 * `undefined` (and was SKIPPED from workspaceSignature's own accumulator) until the FIRST time
 * ui/settingsPanel.js's saveSettings() ever ran in a session — at which point ddcs_studio_settings
 * materialized in localStorage and the store stopped being skipped. That shape change ALONE (never any real
 * edit — confirmed live: calling saveSettings() with the in-memory object completely untouched reproduced it)
 * permanently flipped isWorkspaceDirtyToFile() for the rest of the session.
 *
 * ROOT FIX (not a wouldLoseWork()-side compensation — "a predicate compensating for a lying input is two
 * bugs"): ui/settingsPanel.js persists `_ddcsSettings` to localStorage immediately at module load (this runs at
 * BOOT — settingsPanel.js is statically imported before ui/fileSaveState.js in app.js — never lazily on first
 * Settings interaction) IF the key has never been written. The workspace's boot watermark then sees the real
 * value from day one; nothing later "materializes" out from under it.
 *
 * ACCEPTANCE BAR (direct instruction): the dirty flag is true IF AND ONLY IF something actually changed —
 * assert BOTH sides. A `saveSettings()` call with the in-memory object completely untouched is the clean,
 * unconfounded no-op case; a genuine field edit is the real-change case. (Switching THEME was the original
 * repro but is a confound, not a clean test: opening that specific settings panel ALSO lazily backfills
 * unrelated fields — a real, separate, pre-existing finding reported in WORK-LOG, not this bug and not fixed
 * here — so it isn't used as the two-sided assertion's vector.)
 *
 * t2188 amendment 2 — the human independently reported the same class of symptom from the open side: "on open
 * it shouldnt be dirty why is it always dirty". The test below asserts that acceptance bar directly (a truly
 * fresh browser opening a workspace as its first action reads clean) and it's HONEST about what it does and
 * doesn't prove: reverting the settingsPanel.js fix and re-running it, the test still PASSED — restoreBackup()'s
 * own write-then-mark ordering (the settings store is WRITTEN during restore, and markWorkspaceSavedToFile's
 * signature read happens strictly AFTER) is safe by construction against the exact undefined→populated
 * mechanism this turn fixed, so this specific synthetic repro was never vulnerable to it either way. It stays
 * in the suite as a real, valuable acceptance guard (this property SHOULD hold, and the fix doesn't break it),
 * not as proof of having found and fixed the open-path trigger — if the human's real symptom persists, its
 * actual trigger differs from what this test reproduces and needs its own investigation (see WORK-LOG).
 */
async function ready(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.waitForTimeout(2500);   // let the watermark-settle poll finish (fileSaveState.js)
}

test('the settings key is persisted at boot, not lazily on first Settings interaction', async ({ page }) => {
    await ready(page);
    const exists = await page.evaluate(() => localStorage.getItem('ddcs_studio_settings') != null);
    expect(exists, 'ddcs_studio_settings exists before any Settings interaction').toBe(true);
});

test('CLEAN: a saveSettings() call with nothing changed leaves the workspace NOT dirty', async ({ page }) => {
    await ready(page);
    const before = await page.evaluate(() => window.ddcsFileSaveState.isDirty());
    expect(before, 'sanity: clean before').toBe(false);

    const after = await page.evaluate(async () => {
        const m = await import('/ui/settingsPanel.js');
        m.saveSettings();   // no field touched — the SAME in-memory object, re-persisted verbatim
        return window.ddcsFileSaveState.isDirty();
    });
    expect(after, 'a no-op settings write must not flip dirty').toBe(false);
});

test('DIRTY: a genuine settings field edit DOES flip the workspace dirty', async ({ page }) => {
    await ready(page);
    const after = await page.evaluate(async () => {
        const m = await import('/ui/settingsPanel.js');
        const s = m.getSettings();
        s.units = s.units === 'mm' ? 'in' : 'mm';   // a real, tracked field, genuinely changed
        m.saveSettings();
        return window.ddcsFileSaveState.isDirty();
    });
    expect(after, 'a real field edit must still flip dirty — this is not a "never dirty" regression').toBe(true);
});

test('CLEAN ON OPEN: a truly fresh browser, opening a workspace as its very first action, reads NOT dirty', async ({ browser }) => {
    const context = await browser.newContext();   // guaranteed empty localStorage — never booted before
    const page = await context.newPage();
    try {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
        await page.waitForTimeout(2500);

        // build a "file" from the current (post-boot) state, then open it — the same restore + reload shape
        // ui/workspaceManager.js's own openWorkspaceObject uses, via its window.__ddcsNoReload-free real path.
        await page.evaluate(async () => {
            const backup = await import('/data/backup.js');
            window.__probeObj = await backup.buildBackup();
        });
        await page.evaluate(async () => {
            const backup = await import('/data/backup.js');
            await backup.restoreBackup(window.__probeObj);
            backup.markWorkspaceSavedToFile('probe.ddcs', 'local');
        });
        await page.reload();
        await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
        await page.waitForTimeout(1500);

        const isDirty = await page.evaluate(() => window.ddcsFileSaveState.isDirty());
        expect(isDirty, 'opening a workspace must read clean immediately, not dirty-until-touched').toBe(false);
    } finally {
        await context.close();
    }
});
