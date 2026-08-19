import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('ddcs_theme', 'futuristic'); } catch (_) { } });
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);
await page.locator('.dock-header .header-center .toolbar-dropdown > button.toolbar-btn', { hasText: 'Probe' }).click();
const entry = page.locator('.dock-header .header-center .toolbar-dropdown-content button[data-optype="corner"]');
await entry.waitFor({ state: 'visible', timeout: 5000 });
await entry.click();
await page.waitForSelector('.wiz-box', { timeout: 5000 });
await page.waitForTimeout(300);
const info = await page.evaluate(() => {
    const wizBox = document.querySelector('.wiz-box');
    const overlayEl = document.querySelector('.overlay.active');
    const wizardEl = document.querySelector('.wizard.active');
    return {
        overlayElClass: overlayEl ? overlayEl.className : null,
        wizardElClass: wizardEl ? wizardEl.className : null,
        sameElement: overlayEl === wizardEl,
        overlayElBg: overlayEl ? getComputedStyle(overlayEl).backgroundColor : null,
        parentOfWizBox: wizBox && wizBox.parentElement ? wizBox.parentElement.className : null,
    };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
