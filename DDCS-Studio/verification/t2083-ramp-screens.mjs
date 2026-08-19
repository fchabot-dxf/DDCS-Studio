// t2083 (P4d) — public bevel ramp: before/after screenshots across all 5 themes. Only studio should show any
// visible difference (the private ramp only ever existed in studio) — this captures the visual record
// alongside the computed-style proof.
// Usage:  node verification/t2083-ramp-screens.mjs before   (or "after")
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TAG = process.argv[2] || 'before';
const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];
const BASE = 'http://localhost:3211';
const OUT = __dirname;

const setTheme = (page, theme) => page.addInitScript((t) => {
    try { localStorage.setItem('ddcs_theme', t); } catch (_) { /* */ }
}, theme);

async function shot(page, name) {
    await page.screenshot({ path: path.join(OUT, `t2083-${TAG}-${name}.png`) });
}

const browser = await chromium.launch();
for (const theme of THEMES) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setTheme(page, theme);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
    await page.waitForTimeout(500);
    await shot(page, `${theme}-main`);

    try {
        await page.locator('#controller-dock .header-handle').click();
        await page.waitForTimeout(400);
        await shot(page, `${theme}-deck-open`);
    } catch (e) { console.log(`[${theme}] deck-open capture skipped: ${e.message}`); }

    try {
        await page.locator('.dock-header .header-center .toolbar-dropdown > button.toolbar-btn', { hasText: 'Probe' }).click();
        await page.waitForTimeout(300);
        await shot(page, `${theme}-dropdown-open`);
        await page.keyboard.press('Escape');
    } catch (e) { console.log(`[${theme}] dropdown-open capture skipped: ${e.message}`); }

    if (errors.length) console.log(`[${theme}] PAGE ERRORS:\n` + errors.join('\n'));
    await page.close();

    // Fresh page for the wizard-open shot -- the dropdown from the step above doesn't
    // reliably reset after Escape, so re-navigating avoids that stale toggle state.
    const wizPage = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    try {
        await setTheme(wizPage, theme);
        await wizPage.goto(BASE, { waitUntil: 'networkidle' });
        await wizPage.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
        await wizPage.waitForTimeout(500);
        const entry = wizPage.locator('.dock-header .header-center .toolbar-dropdown-content button[data-optype="corner"]');
        await wizPage.locator('.dock-header .header-center .toolbar-dropdown > button.toolbar-btn', { hasText: 'Probe' }).click();
        await entry.waitFor({ state: 'visible', timeout: 5000 });
        await entry.click();
        await wizPage.waitForSelector('.wiz-box', { timeout: 5000 });
        await wizPage.waitForTimeout(400);
        await shot(wizPage, `${theme}-wizard-open`);
    } catch (e) { console.log(`[${theme}] wizard-open capture skipped: ${e.message}`); }
    await wizPage.close();

    const tabPage = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    try {
        await setTheme(tabPage, theme);
        await tabPage.goto(BASE, { waitUntil: 'networkidle' });
        await tabPage.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
        await tabPage.waitForTimeout(400);
        await tabPage.evaluate(() => window.showApp && window.showApp('blocks'));
        await tabPage.waitForTimeout(400);
        await shot(tabPage, `${theme}-blocks-tab`);
    } catch (e) { console.log(`[${theme}] blocks-tab capture skipped: ${e.message}`); }
    try {
        await tabPage.evaluate(() => window.showApp && window.showApp('gateway'));
        await tabPage.waitForTimeout(400);
        await shot(tabPage, `${theme}-gateway-tab`);
    } catch (e) { console.log(`[${theme}] gateway-tab capture skipped: ${e.message}`); }
    await tabPage.close();
}
await browser.close();
console.log(`done: ${TAG}`);
