import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('ddcs_theme', 'futuristic'); } catch (_) { } });
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);
const info = await page.evaluate(() => {
  const tab = document.querySelector('.app-header .tab.active');
  if (!tab) return { found: false };
  const after = getComputedStyle(tab, '::after');
  const tabStyle = getComputedStyle(tab);
  return {
    found: true,
    afterContent: after.content,
    afterBoxShadow: after.boxShadow,
    tabBoxShadow: tabStyle.boxShadow,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
