const { chromium } = require('@playwright/test');
const URL = 'https://ddcs-studio.pages.dev/';
const spd = (p, scope) => p.evaluate((sc) => { const b = document.querySelector(sc + ' .pp-speed'); return b ? (b.textContent || '').replace(/\s+/g, ' ').trim() : '(none)'; }, scope);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  // mill modal
  await p.locator('button.wizard-btn').filter({ hasText: 'Mill' }).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Pocket' }).first().click(); await p.waitForTimeout(1500);
  console.log('MILL pp-speed default:', await spd(p, '#wizard'));
  await p.locator('#wizard .pp-speed').first().click(); await p.waitForTimeout(300);
  console.log('MILL pp-speed after 1 click:', await spd(p, '#wizard'));
  await p.locator('#wizard .pp-speed').first().click(); await p.waitForTimeout(300);
  console.log('MILL pp-speed after 2 clicks:', await spd(p, '#wizard'));
  await p.locator('#wizard button').filter({ hasText: 'CANCEL' }).first().click().catch(() => {}); await p.waitForTimeout(500);
  // blocks
  await p.locator('button.tab').filter({ hasText: 'BLOCKS' }).filter({ visible: true }).first().click();
  await p.locator('.blocklyDraggable').first().waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
  await p.waitForTimeout(1500);
  console.log('BLOCKS pp-speed default:', await spd(p, 'body'));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
