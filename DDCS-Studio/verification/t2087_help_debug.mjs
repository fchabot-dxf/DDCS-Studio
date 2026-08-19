import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });
await page.addInitScript(() => { try { localStorage.setItem('ddcs_theme', 'normal'); } catch (_) { } });
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);
const hasFn = await page.evaluate(() => typeof window.openHelp);
console.log('typeof window.openHelp:', hasFn);
const result = await page.evaluate(() => {
    try {
        window.openHelp();
        return { called: true, overlayExists: !!document.querySelector('.help-overlay') };
    } catch (e) {
        return { called: false, error: e.message };
    }
});
console.log(JSON.stringify(result));
await browser.close();
