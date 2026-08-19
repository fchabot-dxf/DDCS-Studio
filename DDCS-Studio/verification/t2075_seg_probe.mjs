import { chromium } from '@playwright/test';
import { openWizardViaBar } from '../tests/support/barGesture.js';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto('http://localhost:3211');
await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
await openWizardViaBar(page, { group: 'Probe', optype: 'corner' });
await page.waitForTimeout(500);

const info = await page.evaluate(() => {
  const seg = document.querySelector('.seg-control');
  const btns = [...document.querySelectorAll('.seg-btn')];
  const s = getComputedStyle(btns[0]);
  return {
    segBox: seg ? seg.getBoundingClientRect() : null,
    btns: btns.map((b) => ({ text: b.textContent, rect: b.getBoundingClientRect(), padding: getComputedStyle(b).padding, border: getComputedStyle(b).border, boxSizing: getComputedStyle(b).boxSizing })),
    firstBtnStyle: { fontSize: s.fontSize, lineHeight: s.lineHeight, padding: s.padding, border: s.border, height: s.height, minHeight: s.minHeight, boxSizing: s.boxSizing },
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
