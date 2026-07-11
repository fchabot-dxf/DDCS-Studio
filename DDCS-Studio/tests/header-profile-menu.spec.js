import { test, expect } from '@playwright/test';
import { autoAppDialog } from './_appDialog.js';

/**
 * t688 b2 — the header quick-menu's "Generate for" (dialect) section is REPLACED by a PROFILE section: a read-only
 * current profile+controller line, up to 3 recents (one-click full-swap), and [Profiles…] [Save as…] [Pull from
 * controller]. NO dialect/controller switching in the menu (that stays on the Settings controller dropdown).
 */
const openMenu = async (page) => { await page.click('#hdrPostBtn'); await page.waitForSelector('#hdrPostMenu:not([hidden])', { timeout: 4000 }); };

test('the header menu shows the PROFILE section (current + recents + doors), NOT the dialect list', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsProfileLib && window.ddcsGetSettings && document.getElementById('hdrPostBtn'));
    // two profiles: Rig A (x=700), Rig B (active, x=320); Rig A seeded as a recent
    await page.evaluate(() => {
        localStorage.removeItem('ddcs_profile_library');
        const L = window.ddcsProfileLib;
        window.ddcsGetSettings().machine = { x: 700, y: 500, z: 300, show: true };
        L.renameProfile(L.activeProfileId(), 'Rig A'); L.saveActiveSnapshot();
        const idA = L.activeProfileId();
        L.createProfile({ from: 'baseline', controllerId: 'ddcs-expert-m350', name: 'Rig B' });   // active = Rig B
        window.ddcsGetSettings().machine.x = 320; L.saveActiveSnapshot();
        localStorage.setItem('ddcs_profile_recents', JSON.stringify([idA]));
    });
    await openMenu(page);
    const menu = await page.evaluate(() => {
        const m = document.getElementById('hdrPostMenu');
        return {
            hasProfileHead: [...m.querySelectorAll('.hdr-quick-head')].some((h) => /Profile/.test(h.textContent)),
            current: (m.querySelector('.hdr-quick-cur') || {}).textContent || '',
            recentCount: m.querySelectorAll('[data-profswitch]').length,
            recentText: [...m.querySelectorAll('[data-profswitch]')].map((b) => b.textContent).join(' '),
            hasBrowse: !!m.querySelector('[data-profact="browse"]'),
            hasSaveas: !!m.querySelector('[data-profact="saveas"]'),
            hasPull: !!m.querySelector('[data-profact="pull"]'),
            dialectItems: m.querySelectorAll('[data-post]').length,   // dialect switching → must be GONE
            hasGenerateFor: /Generate for/.test(m.textContent),
        };
    });
    expect(menu.hasProfileHead, 'a Profile section heading').toBe(true);
    expect(menu.current, 'line 1 = the current profile + controller').toMatch(/Rig B/);
    expect(menu.current, 'line 1 names the controller').toMatch(/Expert/);
    expect(menu.recentCount, 'one recent (Rig A) — one-click switch').toBe(1);
    expect(menu.recentText, 'the recent names Rig A').toMatch(/Rig A/);
    expect(menu.hasBrowse && menu.hasSaveas && menu.hasPull, '[Profiles…] [Save as…] [Pull from controller]').toBe(true);
    expect(menu.dialectItems, 'NO dialect list in the menu (no data-post items)').toBe(0);
    expect(menu.hasGenerateFor, 'the "Generate for" label is gone').toBe(false);
});

test('a recent row full-swaps; Profiles… / Save as… open the modal; Pull opens the pull flow', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsProfileLib && window.ddcsGetSettings && document.getElementById('hdrPostBtn'));
    await page.evaluate(() => {
        localStorage.removeItem('ddcs_profile_library');
        const L = window.ddcsProfileLib;
        window.ddcsGetSettings().machine = { x: 700, y: 500, z: 300, show: true };
        L.renameProfile(L.activeProfileId(), 'Rig A'); L.saveActiveSnapshot();
        const idA = L.activeProfileId();
        L.createProfile({ from: 'baseline', controllerId: 'ddcs-expert-m350', name: 'Rig B' });
        window.ddcsGetSettings().machine.x = 320; L.saveActiveSnapshot();
        localStorage.setItem('ddcs_profile_recents', JSON.stringify([idA]));
    });
    // RECENT → full-swap: clicking Rig A swaps the envelope back to 700
    await openMenu(page);
    await page.click('[data-profswitch]');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.ddcsGetSettings().machine.x), 'a recent one-click FULL-SWAPS the envelope to 700').toBe(700);
    // PROFILES… opens the browser modal
    await openMenu(page);
    await page.click('[data-profact="browse"]');
    await expect(page.locator('.profile-modal')).toHaveCount(1);
    await page.click('.profile-modal [data-pa="done"]');
    // SAVE AS… opens the modal in save mode (a dlgPrompt for the name)
    await openMenu(page);
    await page.click('[data-profact="saveas"]');
    await expect(page.locator('.app-dialog input')).toHaveCount(1);
    await page.keyboard.press('Escape');
    // PULL opens the pull flow (the review/import modal)
    await autoAppDialog(page, { accept: true });
    await openMenu(page);
    await page.click('[data-profact="pull"]');
    await expect(page.locator('#import-close'), 'Pull opened the review/import modal').toBeVisible({ timeout: 6000 });
});
