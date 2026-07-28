const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);

  console.log('clicking BLOCKS…');
  const t0 = Date.now();
  await p.locator('button.tab').filter({ hasText: 'BLOCKS' }).filter({ visible: true }).first().click().catch(e => console.log('click err', e.message));

  const cands = [
    'input[placeholder*="earch"]',
    'input',
    '.blk-sug-chip',
    '.blk-dev-savebtn',
    '#blkToolsHandle',
    'svg.blocklySvg',
    '.blocklyMainBackground',
    '.pp-run',
    '[class^="blk-"]',
  ];
  for (const c of cands) {
    try { await p.locator(c).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 12000 }); console.log(`  visible @ ${Date.now() - t0}ms : ${c}`); }
    catch { console.log(`  NEVER (12s)      : ${c}`); }
  }

  // progressive screenshots
  await p.screenshot({ path: path.join(OUT, 'pb-final.png') });
  // what inputs exist in blocks?
  const inputs = await p.evaluate(() => [...document.querySelectorAll('input')].filter(i => i.getBoundingClientRect().width > 0).map(i => ({ ph: i.placeholder, type: i.type, cls: (typeof i.className === 'string' ? i.className : '').slice(0, 30) })));
  console.log('\nvisible inputs in BLOCKS:', JSON.stringify(inputs, null, 2));
  const blkCls = await p.evaluate(() => [...new Set([...document.querySelectorAll('[class*="blk-"],[class*="blockly"],[class*="pp-"]')].map(e => (typeof e.className === 'string' ? e.className.split(' ')[0] : '')))].filter(Boolean).slice(0, 30));
  console.log('block-ish classes present:', JSON.stringify(blkCls));

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
