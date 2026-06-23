import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
await page.goto('http://127.0.0.1:8799', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
// stitch the 5 theme headers into one tall screenshot
const shots = [];
for (let i = 0; i < 5; i++) {
    const theme = await page.evaluate(() => document.body.dataset.theme);
    await page.locator('.app-header').screenshot({ path: `verification/hdr-${i}-${theme}.png` });
    shots.push(theme);
    await page.evaluate(() => window.toggleStyle());
    await page.waitForTimeout(300);
}
console.log('captured: ' + shots.join(', '));
await browser.close();
