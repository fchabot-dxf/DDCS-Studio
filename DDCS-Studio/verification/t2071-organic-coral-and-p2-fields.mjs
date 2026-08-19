// t2071 — organic's coral ruling + P2 (base input/select/textarea + button focus ring): before/after
// screenshots across all 5 themes. Standalone script (matches the verification/*.mjs convention).
// Usage:  node verification/t2071-organic-coral-and-p2-fields.mjs before   (or "after")
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
    await page.screenshot({ path: path.join(OUT, `t2071-${TAG}-${name}.png`) });
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
    await shot(page, `${theme}-main`);   // organic: the coral band check

    // open a wizard (Probe > corner) — the P2 form-field check: every input/select in the wizard body should
    // now be panel-styled with the accent border/focus-ring, in EVERY theme, not just studio.
    try {
        await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Probe' }).click();
        const entry = page.locator('.dock-header .toolbar-dropdown-content button[data-optype="corner"]');
        await entry.waitFor({ state: 'visible', timeout: 5000 });
        await entry.click();
        await page.waitForSelector('.wiz-box', { timeout: 5000 });
        await page.waitForTimeout(300);
        await shot(page, `${theme}-wizard-open`);

        // click + keyboard-tab to show a REAL :focus-visible ring on a form field (P2's own base rule)
        const field = page.locator('.wiz-body input:visible, .wiz-body select:visible').first();
        if (await field.count()) {
            await field.click();
            await page.keyboard.press('Tab');
            await page.keyboard.press('Shift+Tab');
            await page.waitForTimeout(150);
            await shot(page, `${theme}-wizard-field-focus`);
        }
    } catch (e) {
        console.log(`[${theme}] wizard capture skipped: ${e.message}`);
    }

    if (errors.length) console.log(`[${theme}] PAGE ERRORS:\n` + errors.join('\n'));
    await page.close();
}
await browser.close();
console.log(`done: ${TAG}`);
