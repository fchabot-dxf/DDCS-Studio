import { chromium } from '@playwright/test';
const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];
const NAMES = [
  '--surface', '--accent', '--radius', '--border', '--scrim',
  '--modal-face', '--modal-edge', '--modal-edge-w', '--modal-radius', '--modal-shadow',
  '--modal-head-face', '--modal-head-ink', '--modal-foot-edge',
  '--modal-close-face', '--modal-close-edge', '--modal-close-edge-w', '--modal-close-radius',
  '--modal-close-shadow', '--modal-close-text-shadow',
];
const browser = await chromium.launch();
const out = {};
for (const theme of THEMES) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) {} }, theme);
  await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
  await page.waitForTimeout(300);
  out[theme] = await page.evaluate((names) => {
    const s = getComputedStyle(document.body);
    const o = {};
    for (const n of names) o[n] = s.getPropertyValue(n).trim();
    return o;
  }, NAMES);
  await page.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
