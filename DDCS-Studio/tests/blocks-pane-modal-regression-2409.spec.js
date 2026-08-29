import { test, expect } from '@playwright/test';

/**
 * t2409 (BACKLOG #46) — the fix for the Blocks pane's own frozen-handle bug (blocks-pane-redraw-2409.spec.js)
 * touches blkMgr(), which is scoped to blocksApp.js's PANE instance only (`blkView`) — the "Open as modal" door
 * (blkOpenModal → openLiveAsModal) opens the SAME op through the real wizardManager's own modal instance
 * (createUserOpView(null), userOpView.js:887), never through blkMgr(). This pins that the modal's own drag still
 * works after the fix — it was never expected to regress (different manager entirely), but the dispatch asked
 * for it checked explicitly since blocksApp.js is a shared file.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('t2409 regression: the Blocks pane\'s "Open as modal" wizard still redraws its FeatureCanvas during a drag', async ({ page }) => {
  await page.goto('/?debug=feat');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.showApp, null, { timeout: 60000 });
  await page.evaluate(() => window.showApp('blocks'));
  await page.evaluate(async () => {
    const { _framed, makeOp } = await import('/blocks/opBuilders.js');
    const params = { shape: 'rect', strategy: 'spiral', originX: 0, originY: 0, w: 80, h: 60, dia: 50, sides: 6, wcs: 'active' };
    const framed = _framed('user_pocket_data', params);
    const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
    const op = makeOp('user_pocket_data', params, bare);
    const stack = [framed.find((b) => b && b.type === 'progstart'), op, framed.find((b) => b && b.type === 'progend')].filter(Boolean);
    window.ddcsLoadBlockStack(stack);
  });
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length > 5);
  await page.waitForTimeout(400);

  const openBtn = page.locator('#blkOpenModal');
  await openBtn.waitFor({ state: 'visible', timeout: 5000 });
  await openBtn.click();

  // the real wizardManager modal opens over the whole app — its own feature-canvas handle, NOT the pane's
  const modalHandle = page.locator('.wiz-modal .fc-handle[data-hid="pk_size"], #wiz_user .fc-handle[data-hid="pk_size"]').first();
  await modalHandle.waitFor({ state: 'visible', timeout: 5000 });
  const box = await modalHandle.boundingBox();
  if (!box) throw new Error('modal pk_size handle has no bounding box');
  const startX = box.x + box.width / 2, startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 24, startY + 12, { steps: 6 });
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForTimeout(100);

  const afterBox = await modalHandle.boundingBox();
  const dx = Math.abs(afterBox.x - box.x), dy = Math.abs(afterBox.y - box.y);
  console.log('modal handle moved by', dx, dy, 'px');
  expect(dx + dy, 'the modal\'s own handle actually moved on screen after the drag').toBeGreaterThan(2);
});
