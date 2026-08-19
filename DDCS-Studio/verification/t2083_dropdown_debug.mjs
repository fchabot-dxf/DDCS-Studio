import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('ddcs_theme', 'studio'); } catch (_) { } });
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);
await page.locator('.dock-header .header-center .toolbar-dropdown > button.toolbar-btn', { hasText: 'Probe' }).click();
await page.waitForTimeout(400);
const info = await page.evaluate(() => {
  const btn = document.querySelector('.toolbar-dropdown-content button');
  if (!btn) return { found: false };
  const s = getComputedStyle(btn);
  return {
    found: true,
    outerHTML: btn.outerHTML.slice(0, 150),
    backgroundImage: s.backgroundImage,
    backgroundColor: s.backgroundColor,
    btnFaceToken: getComputedStyle(document.body).getPropertyValue('--btn-face').slice(0, 100),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
