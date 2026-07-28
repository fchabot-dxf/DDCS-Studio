const { chromium } = require('@playwright/test');
const URL = 'https://ddcs-studio.pages.dev/';
const ready = 'input[placeholder*="earch"]';

async function timeBlocks(p, label) {
  const t0 = Date.now();
  await p.locator('button.tab').filter({ hasText: 'BLOCKS' }).filter({ visible: true }).first().click().catch(() => {});
  try { await p.locator(ready).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 }); console.log(`${label}: BLOCKS ready @ ${Date.now() - t0}ms`); }
  catch { console.log(`${label}: BLOCKS NOT ready in 15s`); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);

  // baseline
  await timeBlocks(p, 'A baseline (fresh STUDIO)');
  await p.locator('button.tab').filter({ hasText: 'STUDIO' }).filter({ visible: true }).first().click();
  await p.waitForTimeout(800);

  // do Wizards + INSERT (heavy program), then time BLOCKS
  await p.locator('button.wizard-btn').filter({ hasText: 'Mill' }).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Pocket' }).first().click(); await p.waitForTimeout(1800);
  await p.locator('#wizard button.primary').filter({ hasText: 'INSERT' }).first().click(); await p.waitForTimeout(1500);
  console.log('editor lines after INSERT:', await p.evaluate(() => (document.querySelector('.editor-layer, textarea')?.textContent || '').split('\n').length));
  await timeBlocks(p, 'B after INSERT (222-line program)');

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
