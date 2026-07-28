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
  await p.screenshot({ path: path.join(OUT, 'rt-studio.png') });

  const t0 = Date.now();
  await p.locator('button.tab').filter({ hasText: 'BLOCKS' }).filter({ visible: true }).first().click().catch(() => {});
  try { await p.locator(ready).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 }); console.log(`BLOCKS ready @ ${Date.now() - t0}ms`); } catch { console.log('BLOCKS not ready 15s'); }
  await p.waitForTimeout(2500);
  const nBlocks = await p.evaluate(() => document.querySelectorAll('.blocklyDraggable').length);
  console.log('blocks on canvas:', nBlocks);
  await p.screenshot({ path: path.join(OUT, 'rt-blocks.png') });

  // exit speed BLOCKS -> MACROS
  const t1 = Date.now();
  await p.locator('button.tab').filter({ hasText: 'MACROS' }).filter({ visible: true }).first().click().catch(() => {});
  try { await p.locator('.settings-tab.tree-level-2').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 12000 }); console.log(`MACROS ready @ ${Date.now() - t1}ms`); } catch { console.log('MACROS not ready 12s'); }

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
