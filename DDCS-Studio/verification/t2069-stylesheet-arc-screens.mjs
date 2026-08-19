// t2069 — THE STYLESHEET ARC P0/P1 gate: before/after screenshots across all 5 themes.
// Standalone script (matches the verification/*.mjs convention), NOT a Playwright test.
// Usage:  node verification/t2069-stylesheet-arc-screens.mjs before   (or "after")
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
    await page.screenshot({ path: path.join(OUT, `t2069-${TAG}-${name}.png`) });
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

    // open a wizard (Probe > corner) — checks the top-dock-header area still frames correctly, and (for studio)
    // the focus ring on a form input, and stacks the setup sheet on top to check the z-index collision.
    try {
        await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Probe' }).click();
        const entry = page.locator('.dock-header .toolbar-dropdown-content button[data-optype="corner"]');
        await entry.waitFor({ state: 'visible', timeout: 5000 });
        await entry.click();
        await page.waitForSelector('.wiz-box', { timeout: 5000 });
        await page.waitForTimeout(300);
        await shot(page, `${theme}-wizard-open`);

        if (theme === 'studio') {
            // tab into the first real input/select in the wizard body to show the focus ring (or its absence)
            const field = page.locator('.wiz-body input, .wiz-body select').first();
            if (await field.count()) {
                await field.focus();
                await page.waitForTimeout(150);
                await shot(page, `${theme}-wizard-input-focus`);
            }
        }

        // stack the setup sheet ON TOP of the open wizard — the named z-index collision (setup-sheet-overlay
        // 4000 vs the wizard 10000)
        await page.evaluate(() => window.openSetupSheet && window.openSetupSheet());
        await page.waitForTimeout(400);
        await shot(page, `${theme}-setup-sheet-over-wizard`);
    } catch (e) {
        console.log(`[${theme}] wizard/setup-sheet capture skipped: ${e.message}`);
    }

    if (errors.length) console.log(`[${theme}] PAGE ERRORS:\n` + errors.join('\n'));
    await page.close();
}
await browser.close();
console.log(`done: ${TAG}`);
