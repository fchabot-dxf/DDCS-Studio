// t2077 (P4b) — modal shell: before/after screenshots across all 5 themes (main + wizard-open + Blocks tab +
// Gateway tab, matching the established stylesheet-arc gate pattern), PLUS a narrow-viewport wizard-open shot —
// the dispatch flagged modals as the one place a narrow viewport genuinely changes layout (dvh/safe-area rules).
// Usage:  node verification/t2077-modal-screens.mjs before   (or "after")
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
    await page.screenshot({ path: path.join(OUT, `t2077-${TAG}-${name}.png`) });
}

async function openCornerWizard(page) {
    await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Probe' }).click();
    const entry = page.locator('.dock-header .toolbar-dropdown-content button[data-optype="corner"]');
    await entry.waitFor({ state: 'visible', timeout: 5000 });
    await entry.click();
    await page.waitForSelector('.wiz-box', { timeout: 5000 });
    await page.waitForTimeout(300);
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
        await openCornerWizard(page);
        await shot(page, `${theme}-wizard-open`);
        const cancel = page.locator('.wiz-box .wiz-foot button', { hasText: 'CANCEL' });
        if (await cancel.count()) await cancel.click();
    } catch (e) {
        console.log(`[${theme}] wizard capture skipped: ${e.message}`);
    }

    try {
        await page.evaluate(() => window.showApp && window.showApp('blocks'));
        await page.waitForTimeout(400);
        await shot(page, `${theme}-blocks-tab`);
    } catch (e) {
        console.log(`[${theme}] blocks-tab capture skipped: ${e.message}`);
    }
    try {
        await page.evaluate(() => window.showApp && window.showApp('gateway'));
        await page.waitForTimeout(400);
        await shot(page, `${theme}-gateway-tab`);
    } catch (e) {
        console.log(`[${theme}] gateway-tab capture skipped: ${e.message}`);
    }

    if (errors.length) console.log(`[${theme}] PAGE ERRORS:\n` + errors.join('\n'));
    await page.close();

    // narrow-viewport wizard-open — cheap (new page, same gesture), and the ONE place a narrow width
    // genuinely changes modal layout (dvh / safe-area-inset rules on .wiz-box).
    const narrowPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const narrowErrors = [];
    narrowPage.on('pageerror', (e) => narrowErrors.push(e.message));
    await setTheme(narrowPage, theme);
    await narrowPage.goto(BASE, { waitUntil: 'networkidle' });
    await narrowPage.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
    await narrowPage.waitForTimeout(500);
    try {
        await openCornerWizard(narrowPage);
        await narrowPage.screenshot({ path: path.join(OUT, `t2077-${TAG}-${theme}-narrow-wizard-open.png`) });
    } catch (e) {
        console.log(`[${theme}] narrow wizard capture skipped: ${e.message}`);
    }
    if (narrowErrors.length) console.log(`[${theme}] NARROW PAGE ERRORS:\n` + narrowErrors.join('\n'));
    await narrowPage.close();
}
await browser.close();
console.log(`done: ${TAG}`);
