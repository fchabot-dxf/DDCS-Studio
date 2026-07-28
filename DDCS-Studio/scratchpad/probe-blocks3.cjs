const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const ready = 'input[placeholder*="earch"]';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);

  await p.locator('button.wizard-btn').filter({ hasText: 'Mill' }).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Pocket' }).first().click(); await p.waitForTimeout(1800);
  await p.locator('#wizard button.primary').filter({ hasText: 'INSERT' }).first().click(); await p.waitForTimeout(1500);

  console.log('clicking Clear program (#btn-clear)…');
  await p.locator('#btn-clear').first().click().catch(e => console.log('clear err', e.message));
  await p.waitForTimeout(1200);

  const t0 = Date.now();
  await p.locator('button.tab').filter({ hasText: 'BLOCKS' }).filter({ visible: true }).first().click().catch(() => {});
  try { await p.locator(ready).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 }); console.log(`BLOCKS ready after CLEAR @ ${Date.now() - t0}ms`); }
  catch { console.log('BLOCKS NOT ready in 15s after clear'); }
  await p.waitForTimeout(1500);
  const blockCount = await p.evaluate(() => document.querySelectorAll('.blocklyDraggable, g.blocklyDraggable').length);
  console.log('blocks on canvas after clear:', blockCount);
  await p.screenshot({ path: path.join(OUT, 'pb-after-clear.png') });

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
