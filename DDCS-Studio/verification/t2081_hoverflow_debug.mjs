import { chromium } from '@playwright/test';
const theme = process.argv[2] || 'normal';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 360, height: 690 }, hasTouch: true, isMobile: true });
await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) { } }, theme);
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);
await page.locator('#controller-dock .header-handle').click();
await page.waitForTimeout(400);
const tabArg = process.argv[3];
if (tabArg) {
  const tab = page.locator(`.dock-body .deck-tab[data-deck-tab="${tabArg}"]`);
  if (await tab.count()) { await tab.click(); await page.waitForTimeout(300); }
}

const offenders = await page.evaluate(() => {
  const dockBody = document.querySelector('.dock-body');
  const bodyRect = dockBody.getBoundingClientRect();
  const all = dockBody.querySelectorAll('*');
  const out = [];
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.right > bodyRect.right + 2) {
      out.push({
        tag: el.tagName, id: el.id, cls: (el.className && el.className.toString ? el.className.toString() : ''),
        right: Math.round(r.right), overBy: Math.round(r.right - bodyRect.right), width: Math.round(r.width),
        text: (el.textContent || '').slice(0, 30),
      });
    }
  }
  // sort by overBy descending, keep top 15
  out.sort((a, b) => b.overBy - a.overBy);
  return out.slice(0, 15);
});
console.log(JSON.stringify(offenders, null, 2));
await browser.close();
