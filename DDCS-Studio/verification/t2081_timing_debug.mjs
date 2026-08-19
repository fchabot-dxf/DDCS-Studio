import { chromium } from '@playwright/test';
const waitMs = Number(process.argv[2] || 150);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 360, height: 690 }, hasTouch: true, isMobile: true });
await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) { } }, 'normal');
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);
await page.evaluate(() => {
  const tm = window.ddcsStudio.themeManager;
  tm.applyTheme('studio');
  tm.applyTheme('normal');
});
await page.waitForTimeout(waitMs);
const rect = await page.evaluate(() => {
  const el = document.getElementById('btn-clear');
  const r = el.getBoundingClientRect();
  return { left: Math.round(r.left), right: Math.round(r.right), inViewport: r.right <= window.innerWidth };
});
console.log(`wait=${waitMs}ms:`, JSON.stringify(rect));
await browser.close();
