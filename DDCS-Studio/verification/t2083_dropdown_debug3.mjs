import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('ddcs_theme', 'studio'); } catch (_) { } });
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);
const info = await page.evaluate(() => {
  const bodyStyle = getComputedStyle(document.body);
  const names = ['--plate-hi', '--plate-mid', '--plate-lo', '--bevel-hi', '--bevel-hi-dim', '--bevel-mid-hi', '--bevel-mid-lo', '--bevel-lo', '--btn-face', '--btn-edge', '--btn-ink', '--modal-face', '--dock-chassis-face'];
  const o = {};
  for (const n of names) o[n] = bodyStyle.getPropertyValue(n);
  return o;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
