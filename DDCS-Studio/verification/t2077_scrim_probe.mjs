import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:3211');
await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Probe' }).click();
const entry = page.locator('.dock-header .toolbar-dropdown-content button[data-optype="corner"]');
await entry.waitFor({ state: 'visible', timeout: 5000 });
await entry.click();
await page.waitForSelector('.wiz-box', { timeout: 5000 });
await page.waitForTimeout(300);

const info = await page.evaluate(() => {
  const wizBox = document.querySelector('.wiz-box');
  const overlayEl = wizBox ? wizBox.closest('.overlay, .wizard, [class*="overlay"], [class*="wizard"]') : null;
  const parent = wizBox ? wizBox.parentElement : null;
  const scrimVar = getComputedStyle(document.body).getPropertyValue('--scrim').trim();
  return {
    wizBoxFound: !!wizBox,
    parentClass: parent ? parent.className : null,
    parentComputedBg: parent ? getComputedStyle(parent).backgroundColor : null,
    parentComputedBackdropFilter: parent ? getComputedStyle(parent).backdropFilter : null,
    scrimTokenValue: scrimVar,
    overlayElClass: overlayEl ? overlayEl.className : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
