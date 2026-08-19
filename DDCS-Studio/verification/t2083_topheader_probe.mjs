import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('ddcs_theme', 'studio'); } catch (_) { } });
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);

const info = await page.evaluate(() => {
  const el = document.querySelector('.dock-header.top-dock-header');
  const s = getComputedStyle(el);
  return {
    found: !!el,
    background: s.backgroundImage !== 'none' ? s.backgroundImage : s.backgroundColor,
    borderTop: s.borderTop, borderBottom: s.borderBottom,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
