const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const big = (p) => p.evaluate(() => { let b = null; document.querySelectorAll('canvas').forEach(cv => { const r = cv.getBoundingClientRect(); if (r.width > 60 && r.height > 60 && getComputedStyle(cv).display !== 'none' && (!b || r.width * r.height > b.a)) b = { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), a: r.width * r.height }; }); return b; });

async function shape(p, shp, feat) {
  await p.locator('button.wizard-btn').filter({ hasText: 'Probe' }).first().click(); await p.waitForTimeout(400);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Middle' }).first().click(); await p.waitForTimeout(1500);
  if (feat) { await p.locator('#m_type').selectOption(feat, { force: true }); await p.waitForTimeout(400); }
  await p.locator('#wizard .pp-stock').first().click(); await p.waitForTimeout(600);
  await p.locator('#se_shape').selectOption(shp, { force: true }); await p.waitForTimeout(400);
  await p.getByRole('button', { name: 'Done', exact: true }).first().click().catch(() => {}); await p.waitForTimeout(1000);
  const c = await big(p); if (c) { await p.mouse.move(c.x, c.y); for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -200); await p.waitForTimeout(60); } }
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(OUT, `shape-${shp}.png`) });
  await p.locator('#wizard button').filter({ hasText: 'CANCEL' }).first().click().catch(() => {}); await p.waitForTimeout(700);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  await shape(p, 'pocket', 'pocket');
  await shape(p, 'boss', 'boss');
  await browser.close();
  console.log('DONE test-shapes');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
