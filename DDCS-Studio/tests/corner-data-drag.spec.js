import { test, expect } from '@playwright/test';

/**
 * CORNER-PORT inc B3/B3b LAYOUT+DRAG → t107 END-RELATIVE — verify-real-symptom: a REAL "Corner (data)" opened in the real
 * #wiz_user form2d panel renders its FeatureCanvas layout with a draggable REPOSITION point handle, and a REAL pointer drag
 * writes the CORRECT INCREMENTAL DELTA into cross1_x/cross1_y → the EMITTED reposition #23/#24 flips from the signed-travelDist
 * EXPRESSION (#15/#16) to that literal delta. The point is anchored to wall-1 so the drag writes a DELTA, not the absolute
 * world coord (the B3 bug). t107 MACHINE-FAITHFUL: the anchor is now the wall-1 RUNTIME END (passEnds[0], post probe+retract+
 * lift), not the static wall-1 START — so the drag is END-relative (#23/#24 = world − runtime-END), matching the relocated ②
 * the top panel + Layout show. Asserts the VALUE vs an INDEPENDENT trace, with DISTINCT x/y so an axis swap is caught.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('Corner (data): dragging the reposition handle writes the CORRECT incremental delta (world − wall-1) into #23/#24', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);

  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
  });

  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form [data-param]', { state: 'visible' });

  const hasFields = await page.$$eval('#wiz_user_form [data-param]', (ns) => {
    const s = new Set(ns.map((n) => n.dataset.param));
    return s.has('cross1_x') && s.has('cross1_y');
  });
  expect(hasFields, 'cross1_x + cross1_y render as writable form fields (the point role)').toBe(true);

  // the KNOWN wall-1 anchor — t107: the RUNTIME END (passEnds[0], from an INDEPENDENT trace), where the tool actually is
  // after probe+retract+lift; the END-relative drag writes world − this. (staticWall1 = the old start-based anchor, kept as
  // the contrast: X coincides — a Y-probe doesn't move X — but Y differs by ~a probe distance, catching a stale start-anchor.)
  const { wall1, staticWall1, stock } = await page.evaluate(async () => {
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const s = window.ddcsGetSettings().stock;
    registerUserOp(CD.cornerDataDef());
    const tstock = { x: s.x, y: s.y, z: s.z, shape: s.shape, show: true };
    const declared = CD.cornerDataDef().simStartsProvider(CD.CORNER_DEFAULTS, tstock).map((m) => ({ x: m.x, y: m.y, z: m.z || 0, source: m.source, anchorsAtPrev: !!m.anchorsAtPrev }));
    const gcode = emitMapped(builderOf(CD.CORNER_DATA_OPTYPE)(CD.CORNER_DEFAULTS)).text;
    const parsed = traceToolpath(gcode, { stock: tstock, start: declared[0], passStarts: declared });
    return { wall1: (parsed.passEnds || [])[0], staticWall1: opSimStarts(CD.CORNER_DATA_OPTYPE, CD.CORNER_DEFAULTS, s)[0], stock: s };
  });
  expect(Math.abs(wall1.y - staticWall1.y), 'the runtime END sits a probe-distance from the static start (END-relative ≠ start-relative)').toBeGreaterThan(20);

  // PRE-DRAG (negative control): the unset reposition socket emits the #15/#16 expression, not a literal.
  const before = await page.evaluate(() => ({
    cx: document.querySelector('#wiz_user_form [data-param="cross1_x"]').value,
    code: (document.getElementById('wiz_user_code') || {}).textContent || '',
  }));
  expect(before.code, 'the default reposition socket holds the #15/#16 expression').toMatch(/#23\s*=\s*#1[56]\b/);

  // drag the reposition handle to the STOCK CENTRE — a KNOWN world point W = (stock.x/2, stock.y/2). The move handle snaps
  // to stock anchors, so the centre lands the handle at exactly the world centre; the expected DELTA = W − wall1.
  const stockBox = await page.locator('#userVizContainer_tree .fc-stock').first().boundingBox();
  const W = { x: stock.x / 2, y: stock.y / 2 };
  const expectDx = +(W.x - wall1.x).toFixed(2);
  const expectDy = +(W.y - wall1.y).toFixed(2);
  expect(Math.abs(expectDx - expectDy), 'expected deltas distinct → an x/y swap is detectable').toBeGreaterThan(1);

  const handle = page.locator('#userVizContainer_tree .fc-handle-move').first();
  await handle.waitFor({ state: 'visible' });
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(stockBox.x + stockBox.width / 2, stockBox.y + stockBox.height / 2, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate(() =>
    document.querySelector('#wiz_user_form [data-param="cross1_x"]').value)).not.toBe(before.cx);

  const after = await page.evaluate(() => (document.getElementById('wiz_user_code') || {}).textContent || '');
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  // LOAD-BEARING (verify-real-symptom): the emitted increments equal the WALL-RELATIVE delta, not the absolute world.
  const g23 = Number((after.match(/#23\s*=\s*(-?\d+(?:\.\d+)?)/) || [])[1]);
  const g24 = Number((after.match(/#24\s*=\s*(-?\d+(?:\.\d+)?)/) || [])[1]);
  expect(Number.isFinite(g23) && Number.isFinite(g24), '#23/#24 emitted as literals').toBe(true);
  expect(after, 'the #15/#16 expression default is gone from the reposition socket').not.toMatch(/#23\s*=\s*#1[56]\b/);
  const TOL = 2;   // world-unit slack for snapping / sub-pixel
  expect(Math.abs(g23 - expectDx), `#23 == W.x − wall1.x (incremental delta ${expectDx}, not the absolute world ${W.x}); got ${g23}`).toBeLessThan(TOL);
  expect(Math.abs(g24 - expectDy), `#24 == W.y − wall1.y (incremental delta ${expectDy}); got ${g24}`).toBeLessThan(TOL);
  // reject the buggy ABSOLUTE-world write (which would give #23 ≈ W.x, #24 ≈ W.y): wall1 ≠ 0, so the delta ≠ the absolute.
  expect(Math.abs(g23 - W.x), 'reject the absolute-world write on X (#23 must be the delta, not the world coord)').toBeGreaterThan(Math.abs(wall1.x) / 2);
  expect(Math.abs(g23 - expectDy), 'the X socket is not the Y delta (no axis swap)').toBeGreaterThan(1);
});
