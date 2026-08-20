// t2089 (P5b) — before/after screenshots: the deck-header/section-label merge, the wiz-close button
// conversion (visible in the wizard header), and Blocks/Gateway tabs (gate requirement).
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
    await page.screenshot({ path: path.join(OUT, `t2089-${TAG}-${name}.png`) });
}

const browser = await chromium.launch();
for (const theme of THEMES) {
    {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        await setTheme(page, theme);
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
        await page.waitForTimeout(400);
        try {
            await page.locator('.dock-header .header-center .toolbar-dropdown > button.toolbar-btn', { hasText: 'Probe' }).click();
            const entry = page.locator('.dock-header .header-center .toolbar-dropdown-content button[data-optype="corner"]');
            await entry.waitFor({ state: 'visible', timeout: 5000 });
            await entry.click();
            await page.waitForSelector('.wiz-box', { timeout: 5000 });
            await page.waitForTimeout(400);
            await shot(page, `${theme}-wizard`);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);
        } catch (e) { console.log(`[${theme}] wizard capture skipped: ${e.message}`); }
        try {
            await page.locator('#controller-dock .header-handle').click();
            await page.waitForTimeout(300);
            await shot(page, `${theme}-deck-open`);
        } catch (e) { console.log(`[${theme}] deck-open capture skipped: ${e.message}`); }
        await page.close();
    }
    {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        await setTheme(page, theme);
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
        await page.waitForTimeout(400);
        try {
            await page.evaluate(() => window.showApp && window.showApp('blocks'));
            await page.waitForTimeout(400);
            await shot(page, `${theme}-blocks-tab`);
        } catch (e) { console.log(`[${theme}] blocks-tab capture skipped: ${e.message}`); }
        try {
            await page.evaluate(() => window.showApp && window.showApp('gateway'));
            await page.waitForTimeout(400);
            await shot(page, `${theme}-gateway-tab`);
        } catch (e) { console.log(`[${theme}] gateway-tab capture skipped: ${e.message}`); }
        await page.close();
    }
}
await browser.close();
console.log(`done: ${TAG}`);
