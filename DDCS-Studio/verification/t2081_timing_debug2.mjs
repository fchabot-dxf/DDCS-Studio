import { chromium } from '@playwright/test';
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
await page.waitForTimeout(300);
const before = await page.evaluate(() => {
  const el = document.getElementById('btn-clear');
  const r = el.getBoundingClientRect();
  const h = document.querySelector('.app-header');
  return { left: Math.round(r.left), right: Math.round(r.right), headerClasses: h.className, scrollW: h.scrollWidth, clientW: h.clientWidth };
});
console.log('BEFORE manual re-fit:', JSON.stringify(before));

// manually call the app's own fit functions again (not via resize event)
await page.evaluate(() => {
  window.ddcsStudio.dockManager.commandDeck._fitHeader();
  window.ddcsStudio.dockManager.commandDeck._fitAppHeader();
});
await page.waitForTimeout(100);
const after = await page.evaluate(() => {
  const el = document.getElementById('btn-clear');
  const r = el.getBoundingClientRect();
  const h = document.querySelector('.app-header');
  return { left: Math.round(r.left), right: Math.round(r.right), headerClasses: h.className, scrollW: h.scrollWidth, clientW: h.clientWidth };
});
console.log('AFTER manual re-fit:', JSON.stringify(after));
await browser.close();
