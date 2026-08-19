// t2081 — MOBILE: before/after screenshots at 360x690 across all 5 themes. Screenshots are SECONDARY evidence
// here (per the dispatch's own instruction — the geometry measurements in t2081_mobile_geometry_probe.mjs are
// the real gate); this captures the visual record alongside them.
// Usage:  node verification/t2081-mobile-screens.mjs before   (or "after")
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TAG = process.argv[2] || 'before';
const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];
const BASE = 'http://localhost:3211';
const OUT = __dirname;
const VIEWPORT = { width: 360, height: 690 };

const setTheme = (page, theme) => page.addInitScript((t) => {
    try { localStorage.setItem('ddcs_theme', t); } catch (_) { /* */ }
}, theme);

async function shot(page, name) {
    await page.screenshot({ path: path.join(OUT, `t2081-${TAG}-${name}.png`) });
}

const browser = await chromium.launch();
for (const theme of THEMES) {
    const page = await browser.newPage({ viewport: VIEWPORT, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setTheme(page, theme);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
    await page.waitForTimeout(400);
    await shot(page, `${theme}-main`);

    // expand the deck (default tab — shows the editor-keys row with ENTER)
    await page.locator('#controller-dock .header-handle').click();
    await page.waitForTimeout(400);
    await shot(page, `${theme}-deck-open`);

    // scroll the deck-tab-panel down to show the previously-clipped keys are now reachable
    try {
        await page.evaluate(() => {
            const panel = document.querySelector('.dock-body .deck-tab-panel');
            if (panel) panel.scrollTop = panel.scrollHeight;
        });
        await page.waitForTimeout(200);
        await shot(page, `${theme}-deck-scrolled`);
    } catch (e) { console.log(`[${theme}] deck-scrolled capture skipped: ${e.message}`); }

    // scroll the tab strip to reveal VARIABLES, then click it
    try {
        await page.evaluate(() => {
            const tabs = document.querySelector('.dock-body .deck-tabs');
            if (tabs) tabs.scrollLeft = tabs.scrollWidth;
        });
        await page.waitForTimeout(200);
        const varsTab = page.locator('.dock-body .deck-tab[data-deck-tab="variables"]');
        if (await varsTab.count()) {
            await varsTab.click({ timeout: 5000 });
            await page.waitForTimeout(300);
            await shot(page, `${theme}-variables-tab`);
        }
    } catch (e) { console.log(`[${theme}] variables-tab capture skipped: ${e.message}`); }

    // runtime theme switch, then btn-clear position (settled)
    try {
        await page.evaluate((t) => {
            const order = ['studio', 'normal', 'steampunk', 'futuristic', 'organic'];
            const other = order.find((x) => x !== t) || order[0];
            const tm = window.ddcsStudio && window.ddcsStudio.themeManager;
            if (tm && tm.applyTheme) { tm.applyTheme(other); tm.applyTheme(t); }
        }, theme);
        await page.waitForTimeout(600);
        await shot(page, `${theme}-after-runtime-switch`);
    } catch (e) { console.log(`[${theme}] runtime-switch capture skipped: ${e.message}`); }

    if (errors.length) console.log(`[${theme}] PAGE ERRORS:\n` + errors.join('\n'));
    await page.close();
}
await browser.close();
console.log(`done: ${TAG}`);
