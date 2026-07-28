const { chromium } = require('@playwright/test');
const URL = 'https://ddcs-studio.pages.dev/';
const ft = (p) => p.evaluate(() => { const s = document.getElementById('m_type'); return s ? `${s.value}/${s.options[s.selectedIndex]?.text}` : '?'; });
const shp = (p) => p.evaluate(() => { const s = document.getElementById('se_shape'); return s ? s.value : '(closed)'; });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.locator('button.wizard-btn').filter({ hasText: 'Probe' }).first().click(); await p.waitForTimeout(400);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Middle' }).first().click(); await p.waitForTimeout(1500);
  console.log('A default m_type:', await ft(p));

  // Test 1: set m_type=boss, watch over 3s (does it revert?)
  await p.locator('#m_type').selectOption('boss', { force: true });
  console.log('B m_type just after set:', await ft(p));
  await p.waitForTimeout(1500); console.log('C m_type +1.5s:', await ft(p));
  await p.waitForTimeout(1500); console.log('D m_type +3s:', await ft(p));

  // Test 2: set stock shape=boss, see if m_type follows
  await p.locator('#wizard .pp-stock').first().click(); await p.waitForTimeout(600);
  console.log('E se_shape before:', await shp(p));
  await p.locator('#se_shape').selectOption('boss', { force: true }); await p.waitForTimeout(300);
  console.log('F se_shape after set:', await shp(p));
  await p.getByRole('button', { name: 'Done', exact: true }).first().click().catch(() => {}); await p.waitForTimeout(1500);
  console.log('G m_type after stock=boss+done:', await ft(p));
  // reopen stock to confirm se_shape stuck
  await p.locator('#wizard .pp-stock').first().click(); await p.waitForTimeout(600);
  console.log('H se_shape on reopen:', await shp(p));
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
