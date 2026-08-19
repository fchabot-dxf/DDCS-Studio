import { chromium } from '@playwright/test';
const TAG = process.argv[2] || 'before';
const THEMES = ['studio'];
const browser = await chromium.launch();
const out = {};
for (const theme of THEMES) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) { } }, theme);
    await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
    await page.waitForTimeout(400);
    await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Probe' }).click();
    const entry = page.locator('.dock-header .toolbar-dropdown-content button[data-optype="corner"]');
    await entry.waitFor({ state: 'visible', timeout: 5000 });
    await entry.click();
    await page.waitForSelector('.wiz-box', { timeout: 5000 });
    await page.waitForTimeout(400);
    out[theme] = await page.evaluate(() => {
        const bg = (el) => el ? (getComputedStyle(el).backgroundImage !== 'none' ? `img:${getComputedStyle(el).backgroundImage.slice(0, 90)}` : getComputedStyle(el).backgroundColor) : 'MISSING';
        return {
            wizFieldInput: bg(document.querySelector('.wiz-body input, .wiz-body select')),
            vizContainer: bg(document.querySelector('.viz-container')),
            varItem: bg(document.querySelector('.var-item')),
        };
    });
    await page.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
