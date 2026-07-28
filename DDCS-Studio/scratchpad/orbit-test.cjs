const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const big = (p) => p.evaluate(() => { let b = null; document.querySelectorAll('canvas').forEach(cv => { const r = cv.getBoundingClientRect(); if (r.width > 60 && r.height > 60 && getComputedStyle(cv).display !== 'none' && (!b || r.width * r.height > b.a)) b = { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), a: r.width * r.height }; }); return b; });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.locator('button.wizard-btn').filter({ hasText: 'Mill' }).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Pocket' }).first().click(); await p.waitForTimeout(1800);
  await p.locator('#wizard .pp-run').first().click().catch(() => {}); await p.waitForTimeout(500);
  const c = await big(p); console.log('canvas', JSON.stringify(c));
  // zoom
  await p.mouse.move(c.x, c.y); for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(50); }
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(OUT, 'orbit-pre.png') });
  // orbit: left-drag rightward + slightly up
  await p.mouse.move(c.x, c.y); await p.mouse.down();
  const N = 24, dx = 320, dy = -60;
  for (let i = 1; i <= N; i++) { await p.mouse.move(c.x + dx * i / N, c.y + dy * i / N); await p.waitForTimeout(16); }
  await p.mouse.up();
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(OUT, 'orbit-post.png') });
  console.log('DONE orbit-test');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
