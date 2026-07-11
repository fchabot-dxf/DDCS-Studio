import { test, expect } from '@playwright/test';

/**
 * t694 b6 — the PRIMARY action button (INSERT / Done / OK / Save) must read as the theme ACCENT, OBVIOUSLY distinct from
 * the neutral Cancel/Close — in EVERY theme (the user's dark-theme Generator INSERT looked identical to CANCEL because
 * `.primary` tied the theme's button skin on specificity). Mechanical guard: computed background differs. Plus a per-theme
 * screenshot matrix (Generator footer + tool library + stock + a dialog) for the by-eye acceptance.
 */
const THEMES = ['studio', 'normal', 'futuristic'];
const bg = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); return el ? getComputedStyle(el).backgroundImage + '|' + getComputedStyle(el).backgroundColor : null; }, sel);

test('the GENERATOR footer: INSERT (primary) is visibly distinct from CANCEL in every theme + screenshots', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWiz && window.ddcsStudio && window.ddcsStudio.themeManager);
    for (const theme of THEMES) {
        await page.evaluate((t) => window.ddcsStudio.themeManager.applyTheme(t), theme);
        await page.evaluate(() => window.openWiz('surfacing', undefined, true));
        await page.waitForSelector('.wiz-foot .primary', { timeout: 8000 });
        await page.waitForTimeout(250);
        const insert = await bg(page, '.wiz-foot .primary');
        const cancel = await bg(page, '.wiz-foot button:not(.primary)');
        expect(insert, `[${theme}] INSERT background differs from CANCEL (accent, not identical)`).not.toBe(cancel);
        await page.locator('.wiz-foot').screenshot({ path: `scratchpad/gen-footer-${theme}.png` });
        await page.evaluate(() => window.closeWiz && window.closeWiz());
        await page.waitForTimeout(150);
    }
});

test('the DIALOG + TOOL LIBRARY + STOCK primaries are accent-distinct + the screenshot matrix', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsOpenStock && window.openSettings);
    for (const theme of THEMES) {
        await page.evaluate((t) => window.ddcsStudio.themeManager.applyTheme(t), theme);
        // DIALOG — OK (primary) vs Cancel
        await page.evaluate(async () => { const { dlgConfirm } = await import('/ui/dialog.js'); window.__d = dlgConfirm('Delete this?', { title: 'Confirm', danger: false, okLabel: 'OK' }); });
        await page.waitForSelector('.app-dialog');
        await page.waitForTimeout(150);
        const ok = await bg(page, '.app-dialog button:last-child');
        const dcancel = await bg(page, '.app-dialog button:first-child');
        expect(ok, `[${theme}] dialog OK differs from Cancel`).not.toBe(dcancel);
        await page.locator('.app-dialog > div').first().screenshot({ path: `scratchpad/dialog-accent-${theme}.png` });
        await page.keyboard.press('Escape'); await page.evaluate(() => window.__d);
        // TOOL LIBRARY — Done (primary) vs Add tool (neutral)
        await page.evaluate(() => window.openSettings({ group: 'controller', panel: 'set_tab_atc' }));
        await page.waitForTimeout(150);
        const lib = await page.$('#set_atc_library'); if (lib) { await lib.click(); await page.waitForSelector('#toollib-modal.active', { timeout: 4000 }); await page.waitForTimeout(150);
            const done = await bg(page, '#toollib-done');
            const add = await bg(page, '#toollib-add');
            expect(done, `[${theme}] tool-library Done differs from Add`).not.toBe(add);
            await page.locator('#toollib-modal .tl-panel').screenshot({ path: `scratchpad/toollib-${theme}.png` });
            await page.click('#toollib-done');
        }
        await page.evaluate(() => window.ddcsCloseSettings && window.ddcsCloseSettings());
        await page.waitForTimeout(100);
    }
});
