import { test, expect } from '@playwright/test';

/**
 * t2143 — MACHINE-SAFETY/DATA-LOSS: `loadSettings()` (ui/settingsPanel.js) rebuilds the persisted object from an
 * EXPLICIT WHITELIST of top-level keys. Any key set on the live settings object that is not in that whitelist
 * survives `saveSettings()` (a plain `JSON.stringify(_ddcsSettings)`) but is silently dropped the next time
 * `loadSettings()` runs — i.e. on reload. `systemHooks` (the user's hand-written tool-change/error macro text,
 * ui/macrosApp.js:607-626) is the user-visible instance: write a macro, save, reload, the field is blank, with
 * no error and no warning. A code sweep (grepping every top-level `getSettings().<key> =` / `_ddcsSettings.<key> =`
 * assignment against the whitelist) found FOUR such keys, not just the one that was noticed: `systemHooks`,
 * `macrosSynced` (macrosApp.js:798/864/1001), `units` (settingsPanel.js — declared in SETTINGS_DEFAULTS but never
 * carried through the loadSettings() merge), and `toolChange` (settingsPanel.js:3609, the tool-change-mode
 * selector, t772 P2b).
 *
 * This spec drives the REAL gesture: set each key through the exposed globals the app itself uses, save, RELOAD
 * the page (not just re-call a function — a reload is what actually re-runs the module-level `loadSettings()`),
 * then read the value back. Written to FAIL against the pre-fix tree (the whole point: prove the bug exists as a
 * running symptom before touching the fix), then re-run to prove the fix.
 */

test('all four persisted-then-dropped keys survive a reload (systemHooks, macrosSynced, units, toolChange)', async ({ page }) => {
    await page.goto('http://localhost:3211', { timeout: 30000 });
    await page.waitForFunction(() => window.ddcsGetSettings);

    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.systemHooks = { T: '(hand-written tool-change macro)\nG0 Z5', error: '(hand-written error macro)', T_unlocked: true, error_unlocked: true };
        s.macrosSynced = true;
        s.units = 'inch';
        s.toolChange = { mode: 'atc' };
        window.ddcsSaveSettings();
    });

    await page.reload();
    await page.waitForFunction(() => window.ddcsGetSettings);

    const back = await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        return {
            systemHooks: s.systemHooks,
            macrosSynced: s.macrosSynced,
            units: s.units,
            toolChange: s.toolChange,
        };
    });

    expect(back.systemHooks, 'the hand-written tool-change/error macro text must survive a reload').toEqual(
        { T: '(hand-written tool-change macro)\nG0 Z5', error: '(hand-written error macro)', T_unlocked: true, error_unlocked: true }
    );
    expect(back.macrosSynced, 'the macros-synced flag must survive a reload').toBe(true);
    expect(back.units, 'the display-unit choice must survive a reload').toBe('inch');
    expect(back.toolChange, 'the tool-change mode must survive a reload').toEqual({ mode: 'atc' });
});

test('a RETIRED key (legacy indentStyle) is still dropped, not resurrected, by the pass-through', async ({ page }) => {
    await page.goto('http://localhost:3211', { timeout: 30000 });
    await page.waitForFunction(() => window.ddcsGetSettings);

    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.indentStyle = 'indented';   // simulate a pre-t2139 save file carrying the retired key
        window.ddcsSaveSettings();
    });

    await page.reload();
    await page.waitForFunction(() => window.ddcsGetSettings);

    const back = await page.evaluate(() => window.ddcsGetSettings().indentStyle);
    expect(back, 'a RETIRED key must not resurrect through a blanket pass-through — t2139 relies on this').toBeUndefined();
});
