// t2093 — before/after screenshots of the Gateway tab across all 5 themes (the download card is themed).
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
    await page.screenshot({ path: path.join(OUT, `t2093-${TAG}-${name}.png`) });
}

const browser = await chromium.launch();
for (const theme of THEMES) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await setTheme(page, theme);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.showApp && window.showApp('gateway'));
    await page.waitForTimeout(700);
    await shot(page, `${theme}-gateway-status`);
    await page.close();
}
await browser.close();
console.log(`done: ${TAG}`);
