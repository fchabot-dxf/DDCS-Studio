import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 360, height: 690 }, hasTouch: true, isMobile: true });
await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) { } }, 'normal');
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);

// simulate the FIX: theme switch, then a DOUBLE-rAF fit (not the app's own single-rAF path — testing the hypothesis directly)
await page.evaluate(() => {
  const tm = window.ddcsStudio.themeManager;
  const cd = window.ddcsStudio.dockManager.commandDeck;
  tm.applyTheme('studio');
  tm.applyTheme('normal');
  requestAnimationFrame(() => requestAnimationFrame(() => { cd._fitHeader(); cd._fitAppHeader(); }));
});
await page.waitForTimeout(200);
const rect = await page.evaluate(() => {
  const el = document.getElementById('btn-clear');
  const r = el.getBoundingClientRect();
  const h = document.querySelector('.app-header');
  return { left: Math.round(r.left), right: Math.round(r.right), headerClasses: h.className, scrollW: h.scrollWidth, clientW: h.clientWidth };
});
console.log('double-rAF result:', JSON.stringify(rect));
await browser.close();
