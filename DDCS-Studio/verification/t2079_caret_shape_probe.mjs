import { chromium } from '@playwright/test';
const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];
const browser = await chromium.launch();
const out = {};
for (const theme of THEMES) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) {} }, theme);
  await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
  await page.waitForTimeout(300);
  out[theme] = await page.evaluate(() => {
    const editor = document.getElementById('editor');
    const cs = getComputedStyle(editor);
    return {
      caretShape: cs.caretShape !== undefined ? cs.caretShape : 'PROPERTY_NOT_SUPPORTED_BY_CDP',
      caretColor: cs.caretColor,
      tokenValue: getComputedStyle(document.body).getPropertyValue('--screen-caret-shape').trim(),
    };
  });
  await page.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
