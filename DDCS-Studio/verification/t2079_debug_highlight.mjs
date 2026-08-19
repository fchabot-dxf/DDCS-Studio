import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.evaluate(() => {
  const e = document.getElementById('editor');
  e.value = 'G0 X10 Y20 ( a real comment )\nG1 Z-5 F300\n';
  e.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(400);
const html = await page.evaluate(() => document.getElementById('editor-highlight').innerHTML);
console.log(html);
await browser.close();
