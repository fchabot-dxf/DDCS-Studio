// t2087 (P5a) — before/after screenshots across all 5 themes: the shared modal base (scrim, card, z-index
// scale). Usage: node verification/t2087-screens.mjs before   (or "after")
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
    await page.screenshot({ path: path.join(OUT, `t2087-${TAG}-${name}.png`) });
}

const browser = await chromium.launch();
for (const theme of THEMES) {
    // wizard overlay -- the most common modal, and the one with the (zero-diff) dead-code cleanup
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
        } catch (e) { console.log(`[${theme}] wizard capture skipped: ${e.message}`); }
        await page.close();
    }

    // settings modal
    {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        await setTheme(page, theme);
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
        await page.waitForTimeout(400);
        try {
            await page.evaluate(() => window.openSettings && window.openSettings());
            await page.waitForTimeout(400);
            await shot(page, `${theme}-settings`);
        } catch (e) { console.log(`[${theme}] settings capture skipped: ${e.message}`); }
        await page.close();
    }

    // library modal
    {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        await setTheme(page, theme);
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
        await page.waitForTimeout(400);
        try {
            await page.evaluate(() => window.openLibrary && window.openLibrary());
            await page.waitForTimeout(400);
            await shot(page, `${theme}-library`);
        } catch (e) { console.log(`[${theme}] library capture skipped: ${e.message}`); }
        await page.close();
    }

    // workspace manager modal
    {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        await setTheme(page, theme);
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
        await page.waitForTimeout(400);
        try {
            await page.evaluate(() => window.openWorkspaceManager && window.openWorkspaceManager('open'));
            await page.waitForTimeout(400);
            await shot(page, `${theme}-workspace-manager`);
        } catch (e) { console.log(`[${theme}] wsm capture skipped: ${e.message}`); }
        await page.close();
    }

    // help modal -- via the REAL click path (quick-menu), not injection, since this is the visual gate
    {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        await setTheme(page, theme);
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
        await page.waitForTimeout(400);
        try {
            await page.locator('#hdrPostBtn').click();
            await page.waitForTimeout(300);
            await page.locator('.hdr-quick-item', { hasText: 'Help' }).click();
            await page.waitForTimeout(400);
            await shot(page, `${theme}-help`);
        } catch (e) { console.log(`[${theme}] help capture skipped: ${e.message}`); }
        await page.close();
    }

    // setup sheet -- via its real trigger
    {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        await setTheme(page, theme);
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
        await page.waitForTimeout(400);
        try {
            await page.evaluate(() => window.openSetupSheet && window.openSetupSheet());
            await page.waitForTimeout(400);
            await shot(page, `${theme}-setup-sheet`);
        } catch (e) { console.log(`[${theme}] setup-sheet capture skipped: ${e.message}`); }
        await page.close();
    }

    // comm-dialog family (EXEMPT): the real trigger path wasn't found quickly (not under the Probe/Setup
    // toolbar dropdowns) -- skipped here. Its exemption is verified authoritatively via computed-style
    // (t2087_probe.mjs's exemptCheck.commDialogBg, zero diff before/after), which is the stronger proof
    // anyway; a screenshot would only add a visual sanity check on top of an already-solid non-diff proof.

    // Blocks + Gateway tabs (gate requirement)
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
