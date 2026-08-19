import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 360, height: 690 }, hasTouch: true, isMobile: true });
await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) { } }, 'normal');
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);

await page.evaluate(() => {
  const tm = window.ddcsStudio.themeManager;
  const cd = window.ddcsStudio.dockManager.commandDeck;
  tm.applyTheme('studio');
  tm.applyTheme('normal');
  // fit immediately (rAF), AND again after a settle delay -- a re-verify safety net
  requestAnimationFrame(() => { cd._fitHeader(); cd._fitAppHeader(); });
  setTimeout(() => { cd._fitHeader(); cd._fitAppHeader(); }, 250);
});
await page.waitForTimeout(100);
const early = await page.evaluate(() => {
  const el = document.getElementById('btn-clear');
  const r = el.getBoundingClientRect();
  return { left: Math.round(r.left), right: Math.round(r.right) };
});
console.log('at 100ms (before the 250ms re-verify fires):', JSON.stringify(early));

await page.waitForTimeout(300);
const settled = await page.evaluate(() => {
  const el = document.getElementById('btn-clear');
  const r = el.getBoundingClientRect();
  const h = document.querySelector('.app-header');
  return { left: Math.round(r.left), right: Math.round(r.right), headerClasses: h.className, scrollW: h.scrollWidth, clientW: h.clientWidth };
});
console.log('at 400ms (after the 250ms re-verify fired):', JSON.stringify(settled));
await browser.close();
