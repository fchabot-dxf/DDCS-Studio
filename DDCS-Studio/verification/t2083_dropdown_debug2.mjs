import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('ddcs_theme', 'studio'); } catch (_) { } });
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);
const info = await page.evaluate(() => {
  const bodyStyle = getComputedStyle(document.body);
  return {
    dataTheme: document.body.getAttribute('data-theme'),
    btnFace: bodyStyle.getPropertyValue('--btn-face'),
    dropdownTrayFace: bodyStyle.getPropertyValue('--dropdown-tray-face'),
    dockChipFace: bodyStyle.getPropertyValue('--dock-chip-face'),
    plateHi: bodyStyle.getPropertyValue('--plate-hi'),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
