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
    // append a standalone test span AFTER the highlighter has settled, so nothing re-renders it away
    const host = document.getElementById('editor-highlight');
    const span = document.createElement('span');
    span.className = 'g-line op-block-edited';
    span.textContent = 'TEST';
    host.appendChild(span);
    const s = getComputedStyle(span);
    const result = { bg: s.backgroundColor, blockEditedToken: getComputedStyle(document.body).getPropertyValue('--block-edited').trim() };
    span.remove();
    return result;
  });
  await page.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
