// t2073 — the design-token foundation (ink/edge/surface + accent-ink/band-bg/hdr-bg): before/after
// screenshots across all 5 themes, matching the established stylesheet-arc gate pattern.
// Usage:  node verification/t2073-tokens-screens.mjs before   (or "after")
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TAG = process.argv[2] || 'before';
const THEMES = ['studio', 'normal', 'steampunk', 'futuristic', 'organic'];
const BASE = 'http://localhost:3211';
const OUT = __dirname;

const setTheme = (page, theme) => page.addInitScript((t) => {
    try { localStorage.setItem('ddcs_theme', t); } catch (_) { /* */ }
}, theme);

async function shot(page, name) {
    await page.screenshot({ path: path.join(OUT, `t2073-${TAG}-${name}.png`) });
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
        await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Probe' }).click();
        const entry = page.locator('.dock-header .toolbar-dropdown-content button[data-optype="corner"]');
        await entry.waitFor({ state: 'visible', timeout: 5000 });
        await entry.click();
        await page.waitForSelector('.wiz-box', { timeout: 5000 });
        await page.waitForTimeout(300);
        await shot(page, `${theme}-wizard-open`);
    } catch (e) {
        console.log(`[${theme}] wizard capture skipped: ${e.message}`);
    }

    if (errors.length) console.log(`[${theme}] PAGE ERRORS:\n` + errors.join('\n'));
    await page.close();
}
await browser.close();
console.log(`done: ${TAG}`);
