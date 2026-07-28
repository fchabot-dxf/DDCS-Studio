const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';

const status = (p) => p.evaluate(() => {
  // the sim status line lives in the preview panel, top-left
  const el = [...document.querySelectorAll('#wizard *')].find(e => /execution|running line|idle|paused/i.test(e.textContent || '') && e.childElementCount < 4);
  return el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70) : '(no status)';
});

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.locator('button.wizard-btn').filter({ hasText: 'Mill' }).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Pocket' }).first().click(); await p.waitForTimeout(1500);

  console.log('t=0.0 (just opened):', await status(p));
  // dump sim toolbar buttons (titles + classes)
  const btns = await p.evaluate(() => [...document.querySelectorAll('#wizard button')].map(b => ({ t: (b.title || b.getAttribute('aria-label') || b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), c: (typeof b.className === 'string' ? b.className : '').slice(0, 34) })).filter(b => /pp-|run|step|loop|reset|replay|play|sim/i.test(b.c + b.t)).slice(0, 20));
  console.log('SIM TOOLBAR:', JSON.stringify(btns, null, 1));

  await p.waitForTimeout(3000);
  console.log('t=3.0 (NO click — did it auto-run?):', await status(p));
  await p.screenshot({ path: path.join(OUT, 's2-noclick-3s.png') });

  console.log('clicking .pp-run …');
  await p.locator('#wizard .pp-run').first().click().catch(() => {});
  await p.waitForTimeout(500);
  console.log('t after pp-run +0.5:', await status(p));
  await p.waitForTimeout(2500);
  console.log('t after pp-run +3.0:', await status(p));
  await p.screenshot({ path: path.join(OUT, 's2-afterrun-3s.png') });

  console.log('clicking .pp-run AGAIN …');
  await p.locator('#wizard .pp-run').first().click().catch(() => {});
  await p.waitForTimeout(600);
  console.log('t after 2nd pp-run +0.6:', await status(p));

  await browser.close();
  console.log('DONE sim2');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
