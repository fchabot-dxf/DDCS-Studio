import { test, expect } from '@playwright/test';

/**
 * t2149 — BACKLOG #9: SPLIT THE ONE MENU IN TWO. The logo owns the APP (#hdrAppBtn/#hdrAppMenu — Settings,
 * FAQ, About (split into two rows/panels per a later amendment — "i meant seperate them in 2 panel"), the
 * desktop download, Rate, "open the website", the version); the filename chip owns the FILE
 * (#hdrPostBtn/#hdrPostMenu, unchanged ids — Save/Open/Load/Insert/Export/Library/Wizards/setup docs). Before
 * this turn both lived in one menu hanging off the filename, so "Settings…" under your filename read as this
 * FILE's settings.
 *
 * The test that drew the line: does going through this door bring something INTO your work, or come OUT of
 * it? Wizards inserts an op into THIS program (checked: runQuickAction's 'wizards' case opens the wizard
 * manager scoped to the current workspace) — so it stays FILE-scoped, unlike the older "### The shape" sketch
 * in BACKLOG.md which drew it app-side before that reasoning was written down; the later, checkmarked ✅
 * section is what this turn builds.
 *
 * ⛔ THE LOGO STOPS BEING A LINK — a real mis-click hazard (`<a href="https://ddcs-studio.pages.dev"
 * target="_blank">`) that was also the reason t2147's whole workspace-chip layout argument existed. It is now
 * a real <button> that opens the app menu; "open the website" is one row inside it.
 */
test.use({ viewport: { width: 1400, height: 900 } });

async function ready(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
}

test('the logo is a real BUTTON, not a link — no href, no target, opens the app menu', async ({ page }) => {
    await ready(page);
    const s = await page.evaluate(() => {
        const el = document.getElementById('hdrAppBtn');
        return {
            tag: el ? el.tagName : null,
            hasHref: el ? el.hasAttribute('href') : null,
            hasTarget: el ? el.hasAttribute('target') : null,
            ariaHaspopup: el ? el.getAttribute('aria-haspopup') : null,
        };
    });
    expect(s.tag, 'the logo is a <button> now, not an <a>').toBe('BUTTON');
    expect(s.hasHref, 'no href — nothing to navigate to').toBe(false);
    expect(s.hasTarget, 'no target — it never opened a new tab either').toBe(false);
    expect(s.ariaHaspopup, 'it announces itself as a menu trigger to assistive tech').toBe('menu');
});

test('⛔ INVERTED (was a navigation test): clicking the logo opens the app menu, it never navigates away', async ({ page }) => {
    await ready(page);
    await expect(page.locator('#hdrAppMenu')).toBeHidden();
    const startUrl = page.url();
    await page.click('#hdrAppBtn');
    await expect(page.locator('#hdrAppMenu')).toBeVisible();
    expect(page.url(), 'still on the app, no navigation happened').toBe(startUrl);
});

test('app menu: Settings, FAQ, About, desktop download, Rate, Open the website, version — and NOTHING file-scoped', async ({ page }) => {
    await ready(page);
    await page.click('#hdrAppBtn');
    const s = await page.evaluate(() => {
        const acts = [...document.querySelectorAll('#hdrAppMenu [data-act]')].map((b) => b.dataset.act);
        return {
            acts,
            hasVersion: document.querySelectorAll('#hdrAppMenu .hq-ver-footer').length,
            hasIdentity: document.querySelectorAll('#hdrAppMenu .hq-identity-line').length,
            hasThemeRow: document.querySelectorAll('#hdrAppMenu [data-theme]').length,
        };
    });
    expect(s.acts).toEqual(['settings', 'helpFaq', 'helpAbout', 'getDesktop', 'rate', 'openWebsite']);
    expect(s.hasVersion, 'the version footer lives here now').toBe(1);
    expect(s.hasIdentity, 'no workspace identity line — that is file-scoped').toBe(0);
    expect(s.hasThemeRow, 'no Theme row — Settings already reaches it in one step (BACKLOG #1)').toBe(0);
    // none of the file-scoped acts leaked into this menu
    for (const fileAct of ['wsSave', 'wsOpen', 'wizards', 'library', 'fileLoad', 'fileInsert', 'fileExport', 'setupSheet', 'checklist']) {
        expect(s.acts.includes(fileAct), `${fileAct} is file-scoped, must not be in the app menu`).toBe(false);
    }
});

test('file menu: Save/Open/Wizards/Load/Export/Library/Setup — and NOTHING app-scoped', async ({ page }) => {
    await ready(page);
    await page.click('#hdrPostBtn');
    const s = await page.evaluate(() => {
        const acts = [...document.querySelectorAll('#hdrPostMenu [data-act]')].map((b) => b.dataset.act);
        return { acts, hasVersion: document.querySelectorAll('#hdrPostMenu .hq-ver-footer').length };
    });
    expect(s.acts).toContain('wsSave');
    expect(s.acts).toContain('wsOpen');
    expect(s.acts).toContain('wizards');   // stays FILE-scoped per the ✅ split's own reasoning — see header comment
    expect(s.acts).toContain('library');
    expect(s.acts).toContain('fileLoad');
    expect(s.acts).toContain('fileExport');
    expect(s.acts, 'Insert stays removed (t2173)').not.toContain('fileInsert');
    expect(s.acts).toContain('setupSheet');
    expect(s.hasVersion, 'the version moved out to the app menu, not here any more').toBe(0);
    for (const appAct of ['settings', 'helpFaq', 'helpAbout', 'getDesktop', 'rate', 'openWebsite']) {
        expect(s.acts.includes(appAct), `${appAct} is app-scoped, must not be in the file menu`).toBe(false);
    }
});

test('two menus, one dismissal contract: opening the app menu closes an open file menu, and vice versa', async ({ page }) => {
    await ready(page);
    await page.click('#hdrPostBtn');
    await expect(page.locator('#hdrPostMenu')).toBeVisible();
    await page.click('#hdrAppBtn');
    await expect(page.locator('#hdrAppMenu')).toBeVisible();
    await expect(page.locator('#hdrPostMenu')).toBeHidden();   // opening the app menu closed the file menu

    await page.click('#hdrPostBtn');
    await expect(page.locator('#hdrPostMenu')).toBeVisible();
    await expect(page.locator('#hdrAppMenu')).toBeHidden();    // and back the other way
});

test('Escape and outside-click close whichever popover is open', async ({ page }) => {
    await ready(page);
    await page.click('#hdrAppBtn');
    await expect(page.locator('#hdrAppMenu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#hdrAppMenu')).toBeHidden();

    await page.click('#hdrPostBtn');
    await expect(page.locator('#hdrPostMenu')).toBeVisible();
    await page.mouse.click(700, 500);   // outside both menus
    await expect(page.locator('#hdrPostMenu')).toBeHidden();
});

test('the three doors to "open a saved thing" carry distinguishing titles (Open / Load / Library)', async ({ page }) => {
    await ready(page);
    await page.click('#hdrPostBtn');
    const s = await page.evaluate(() => ({
        open: document.querySelector('[data-act="wsOpen"]')?.title || '',
        load: document.querySelector('[data-act="fileLoad"]')?.title || '',
        library: document.querySelector('[data-act="library"]')?.title || '',
    }));
    expect(s.open.toLowerCase()).toContain('workspace');
    expect(s.load.toLowerCase()).toContain('g-code');
    expect(s.library.toLowerCase()).toContain('project');
});

test('390px: both entry points (logo, filename chip) survive alongside the tabs, no header overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    await page.waitForTimeout(300);   // let commandDeck's overflow-yield measurement settle
    const s = await page.evaluate(() => {
        const h = document.querySelector('.app-header');
        const app = document.getElementById('hdrAppBtn').getBoundingClientRect();
        const tabs = document.querySelector('.hdr-tabs').getBoundingClientRect();
        const chip = document.getElementById('hdrPostBtn').getBoundingClientRect();
        return {
            overflow: h.scrollWidth - h.clientWidth,
            appVisible: app.width > 0 && app.height > 0,
            chipVisible: chip.width > 0 && chip.height > 0,
            appLeftOfTabs: app.right <= tabs.left + 1,
            chipRightOfTabs: chip.left >= tabs.right - 1,
        };
    });
    expect(s.overflow, 'no header overflow at 390px').toBeLessThanOrEqual(0);
    expect(s.appVisible, 'the logo/app-menu trigger stays visible').toBe(true);
    expect(s.chipVisible, 'the filename chip stays visible').toBe(true);
    expect(s.appLeftOfTabs, 'the logo stays at the left, before the tabs').toBe(true);
    expect(s.chipRightOfTabs, 'the chip stays at the right, after the tabs').toBe(true);
});

test('verify: screenshot both menus open, desktop and 390px (human judges the split visually)', async ({ page }) => {
    await ready(page);
    await page.click('#hdrAppBtn');
    await page.screenshot({ path: 'verification/t2149-app-menu-desktop.png' });
    await page.click('#hdrAppBtn');   // close
    await page.click('#hdrPostBtn');
    await page.screenshot({ path: 'verification/t2149-file-menu-desktop.png' });
    await page.click('#hdrPostBtn');   // close

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.click('#hdrAppBtn');
    await page.screenshot({ path: 'verification/t2149-app-menu-390.png' });
    await page.click('#hdrAppBtn');
    await page.click('#hdrPostBtn');
    await page.screenshot({ path: 'verification/t2149-file-menu-390.png' });
});
