import { test, expect } from '@playwright/test';

/**
 * MIDDLE-BUTTON ALWAYS PANS (t134, Blocks-tab item f). Blockly v13 decides block-drag vs canvas-pan by WHAT is under the
 * pointer (a movable block → drag), not by which mouse button — so a middle-drag starting over a block would try to grab it.
 * A capture-phase pointerdown on the injection host intercepts button 1 before Blockly's gesture and drives ws.scroll, so
 * the MIDDLE button always pans (even over a block) while LEFT-button block-dragging is unchanged.
 */
test.use({ viewport: { width: 1400, height: 900 } });

async function openBlocksWithLeaf(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0, { timeout: 8000 });
  await page.waitForTimeout(500);
  // a SMALL leaf block, centred in the viewport so its screen rect is fully on-canvas
  return page.evaluate(() => {
    const ws = window.__blkws;
    const leaf = ws.getAllBlocks().find((b) => b.isMovable() && b.getChildren(false).length === 0 && b.type !== 'op' && b.type !== 'user_root' && b.type !== 'section');
    ws.centerOnBlock(leaf.id); return leaf.id;
  });
}
const rd = (page, id) => page.evaluate((x) => {
  const ws = window.__blkws, b = ws.getBlockById(x);
  const r = b.getSvgRoot().getBoundingClientRect(), w = b.getRelativeToSurfaceXY();
  return { cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2), wx: Math.round(w.x), wy: Math.round(w.y), sx: Math.round(ws.scrollX), sy: Math.round(ws.scrollY) };
}, id);

// (1) MIDDLE-drag STARTING OVER A BLOCK → the canvas pans and the block does NOT move (in workspace coords)
test('(1) middle-drag over a block pans the canvas; the block stays put', async ({ page }) => {
  const id = await openBlocksWithLeaf(page);
  const b0 = await rd(page, id);
  await page.mouse.move(b0.cx, b0.cy); await page.mouse.down({ button: 'middle' });
  await page.mouse.move(b0.cx + 90, b0.cy + 70, { steps: 12 }); await page.mouse.up({ button: 'middle' });
  await page.waitForTimeout(150);
  const b1 = await rd(page, id);
  expect(Math.hypot(b1.sx - b0.sx, b1.sy - b0.sy), 'the workspace panned').toBeGreaterThan(40);
  expect(b1.wx, 'the block did NOT move in X (not grabbed)').toBe(b0.wx);
  expect(b1.wy, 'the block did NOT move in Y (not grabbed)').toBe(b0.wy);
});

// (2) LEFT-drag over the SAME block still moves it (block dragging unchanged)
test('(2) left-drag over a block still moves the block', async ({ page }) => {
  const id = await openBlocksWithLeaf(page);
  const b0 = await rd(page, id);
  await page.mouse.move(b0.cx, b0.cy); await page.mouse.down({ button: 'left' });
  await page.mouse.move(b0.cx + 70, b0.cy + 50, { steps: 12 }); await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(150);
  const b1 = await rd(page, id);
  expect(Math.hypot(b1.wx - b0.wx, b1.wy - b0.wy), 'the block moved in workspace coords').toBeGreaterThan(20);
});

// (3) MIDDLE-drag over EMPTY canvas also pans
test('(3) middle-drag over empty canvas pans', async ({ page }) => {
  await openBlocksWithLeaf(page);
  const host = await page.evaluate(() => { const h = document.querySelector('.blk-bk-host'); const r = h.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
  const s0 = await page.evaluate(() => ({ sx: window.__blkws.scrollX, sy: window.__blkws.scrollY }));
  const ex = host.x + host.w - 50, ey = host.y + host.h - 50;   // bottom-right corner (empty)
  await page.mouse.move(ex, ey); await page.mouse.down({ button: 'middle' });
  await page.mouse.move(ex - 80, ey - 60, { steps: 12 }); await page.mouse.up({ button: 'middle' });
  await page.waitForTimeout(150);
  const s1 = await page.evaluate(() => ({ sx: window.__blkws.scrollX, sy: window.__blkws.scrollY }));
  expect(Math.hypot(s1.sx - s0.sx, s1.sy - s0.sy), 'the workspace panned over empty canvas').toBeGreaterThan(40);
});
