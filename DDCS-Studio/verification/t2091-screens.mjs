// t2091 (P5c) — before/after screenshots across all 5 themes. Since this turn is deliberately invisible
// (notation normalization + sub-JND colour collapses), these are a visual sanity check, not the primary
// proof (that's the computed-style / spec-equivalence checks) -- confirms nothing LOOKS different either.
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
    await page.screenshot({ path: path.join(OUT, `t2091-${TAG}-${name}.png`) });
}

const browser = await chromium.launch();
for (const theme of THEMES) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await setTheme(page, theme);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
    await page.waitForTimeout(400);
    await shot(page, `${theme}-main`);
    try {
        await page.locator('#controller-dock .header-handle').click();
        await page.waitForTimeout(300);
        await shot(page, `${theme}-deck-open`);
    } catch (e) { console.log(`[${theme}] deck-open capture skipped: ${e.message}`); }
    try {
        await page.locator('#hdrPostBtn').click();
        await page.waitForTimeout(300);
        await shot(page, `${theme}-popover-open`);
    } catch (e) { console.log(`[${theme}] popover-open capture skipped: ${e.message}`); }
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
await browser.close();
console.log(`done: ${TAG}`);
