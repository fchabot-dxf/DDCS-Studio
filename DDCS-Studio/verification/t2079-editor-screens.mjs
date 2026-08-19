// t2079 (P4c) — editor screen + syntax: before/after screenshots across all 5 themes, WITH REAL G-CODE LOADED
// (not "System Ready") — the gate's own explicit requirement, since a syntax-colour regression is invisible
// on an empty program. Also captures Blocks tab + Gateway tab, matching the established gate pattern.
// Usage:  node verification/t2079-editor-screens.mjs before   (or "after")
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TAG = process.argv[2] || 'before';
const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];
const BASE = 'http://localhost:3211';
const OUT = __dirname;
const GCODE = [
    'G21 G90 G94',
    '( facing pass -- real program, not System Ready )',
    'G0 X0 Y0 Z10',
    'M3 S12000',
    'G1 Z-2 F300',
    'G1 X100 Y0 F800',
    'G1 X100 Y50',
    'G1 X0 Y50',
    'G1 X0 Y0',
    'M5',
    'G0 Z10',
    'M30',
].join('\n');

const setTheme = (page, theme) => page.addInitScript((t) => {
    try { localStorage.setItem('ddcs_theme', t); } catch (_) { /* */ }
}, theme);

async function shot(page, name) {
    await page.screenshot({ path: path.join(OUT, `t2079-${TAG}-${name}.png`) });
}

const browser = await chromium.launch();
for (const theme of THEMES) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setTheme(page, theme);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
    await page.evaluate((g) => {
        const e = document.getElementById('editor');
        e.value = g;
        e.dispatchEvent(new Event('input', { bubbles: true }));
    }, GCODE);
    await page.waitForTimeout(500);
    await shot(page, `${theme}-editor-with-gcode`);

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
}
await browser.close();
console.log(`done: ${TAG}`);
