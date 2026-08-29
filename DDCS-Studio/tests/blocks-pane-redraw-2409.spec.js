import { test, expect } from '@playwright/test';

/**
 * t2409 (BACKLOG #46) — the Blocks tab's own "Wizard View" pane never redrew a canvas handle mid-drag: writes
 * climbed every frame (the field value WAS being written) while the handle stayed frozen and featProbe's
 * `redraws` counter never left 0, all the way past pointer-up. Root cause, traced live: the pane's delegated
 * field-write listener (userOpView.js) calls `_mgr.update()` synchronously on every drag frame — the SAME call
 * the sim-start marker's own onDrag already leans on (userOpView.js:800) to repaint mid-drag — but blocksApp.js's
 * own `blkMgr()` passed a STUB `update(){}` for that pane specifically (deliberately, per its own header comment,
 * to avoid re-rendering whichever wizard the REAL wizardManager considers active). blocksApp.js's OWN reactive
 * re-render (reproject()→renderLiveForm()→`blkView.view.update(blkMgr())`) is real but rides Blockly's async
 * change-event queue, not the drag frame's own synchronous handler — which is why earlier local repros (t2405)
 * only ever saw a delayed catch-up, never the deployed build's hard freeze. Fixed by giving the pane its own
 * self-contained redraw (`blkMgr().update()` now calls `blkView.view.update(blkMgr())` directly) rather than
 * routing through the real wizardManager. This spec reuses the shipped `?debug=feat` probe (web/debug/featProbe.js)
 * as its own instrument — no parallel instrumentation to keep in sync.
 *
 * Reverting the blocksApp.js fix (`git stash` the one-line `update()` change) reproduces the bug exactly: the
 * handle freezes at its start position for the whole drag while writes still climb and redraws stay 0 — verified
 * live before this spec was finalized.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('t2409 verify: pocket pk_size handle in the Blocks-tab Wizard View pane redraws during a drag', async ({ page }) => {
  const featLines = [];
  page.on('console', (msg) => {
    const t = msg.text();
    if (t.startsWith('[featProbe]')) featLines.push(t);
  });

  await page.goto('/?debug=feat');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.showApp, null, { timeout: 60000 });
  await page.evaluate(() => window.showApp('blocks'));
  // a REAL placed data-op pocket (progstart / op(user_pocket_data) / progend) — the exact shape opBuilders.js's
  // own `_framed`+`makeOp` compose for a genuine "insert" (not the wizard-authoring canvas, not a bare op with
  // legacy opType:'pocket' — both were tried and neither renders the pk_size handle this bug is about).
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
  await page.waitForTimeout(400);   // settle the debounced preview so the pane's FeatureCanvas has drawn once

  const handle = page.locator('.fc-handle[data-hid="pk_size"]');
  await handle.waitFor({ state: 'visible', timeout: 5000 });

  const box = await handle.boundingBox();
  if (!box) throw new Error('pk_size handle has no bounding box');
  const startX = box.x + box.width / 2, startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(startX + i * 4, startY + i * 2, { steps: 2 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(100);

  console.log('=== featProbe rows (pocket pk_size, Blocks pane) ===');
  for (const l of featLines) console.log(l);

  const drawn = featLines.filter((l) => /redraws:(\d+)/.test(l) && Number(l.match(/redraws:(\d+)/)[1]) > 0);
  expect(drawn.length, 'at least one probe row shows redraws > 0 during the drag').toBeGreaterThan(0);

  const handlePositions = featLines.map((l) => (l.match(/handle:([\d,]+)/) || [])[1]).filter(Boolean);
  const handleMoved = new Set(handlePositions);
  expect(handleMoved.size, 'the handle position varies across frames (not frozen)').toBeGreaterThan(1);
});
