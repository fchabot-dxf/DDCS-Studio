const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';

async function zoomCanvas(p, sel, ticks = 6) {
  const box = await p.locator(sel).first().boundingBox().catch(() => null);
  if (!box) { console.log('  no canvas for', sel); return; }
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await p.mouse.move(cx, cy);
  for (let i = 0; i < ticks; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(120); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);

  // ---- MILL / POCKET modal: run sim + zoom ----
  await p.locator('button.wizard-btn').filter({ hasText: 'Mill' }).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Pocket' }).first().click(); await p.waitForTimeout(1800);
  console.log('MILL modal — pp-run count:', await p.locator('#wizard .pp-run').count(), ' canvases:', await p.locator('#wizard canvas').count());
  const ppRunBox = await p.locator('#wizard .pp-run').first().boundingBox().catch(() => null);
  console.log('  pp-run box:', JSON.stringify(ppRunBox));
  await p.screenshot({ path: path.join(OUT, 'sim-mill-1.png') });
  await p.locator('#wizard .pp-run').first().click().catch(e => console.log('  run click err', e.message));
  await p.waitForTimeout(700);
  await zoomCanvas(p, '#wizard canvas', 7);
  await p.waitForTimeout(1600);
  await p.screenshot({ path: path.join(OUT, 'sim-mill-2-zoomrun.png') });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(OUT, 'sim-mill-3.png') });
  await p.locator('#wizard button').filter({ hasText: 'CANCEL' }).first().click().catch(() => {});
  await p.waitForTimeout(700);

  // ---- PROBE / CORNER modal: GUI + sim ----
  await p.locator('button.wizard-btn').filter({ hasText: 'Probe' }).first().click(); await p.waitForTimeout(500);
  const items = await p.locator('.toolbar-dropdown-content button').filter({ visible: true }).allInnerTexts().catch(() => []);
  console.log('PROBE menu items:', JSON.stringify(items));
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Corner' }).first().click().catch(e => console.log('corner click', e.message));
  await p.waitForTimeout(1800);
  console.log('PROBE modal — #wizard active:', await p.locator('#wizard.active, #wizard.overlay.active').count(), ' pp-run:', await p.locator('#wizard .pp-run').count(), ' canvas:', await p.locator('#wizard canvas').count(), ' inputs:', await p.locator('#wizard input,#wizard select').count());
  await p.screenshot({ path: path.join(OUT, 'sim-probe-1-gui.png') });
  await p.locator('#wizard .pp-run').first().click().catch(e => console.log('  probe run err', e.message));
  await p.waitForTimeout(800);
  await zoomCanvas(p, '#wizard canvas', 5);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: path.join(OUT, 'sim-probe-2-sim.png') });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(OUT, 'sim-probe-3.png') });

  await browser.close();
  console.log('DONE sim');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
