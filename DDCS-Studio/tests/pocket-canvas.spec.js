import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1200, height: 1000 } });

/**
 * Pocket 2D layout canvas — Stage-2 canvas-widget migration (pocketView onto the rect + radial gestures). The whole
 * sweep's "rect+radial cover pocket, no rework" claim rests on this op, so it gets DRILL-LEVEL rigor: real pointer
 * drags through the migrated path must move the right field (the exact gesture math is asserted in canvas-widgets.spec).
 * Covers both gestures + the ellipse half-extent case: rect size (rect, divisor 1), circle Ø (radius-only radial),
 * ellipse W (rect, divisor 0.5).
 */
async function dragSizeHandle(page, dxPx, dyPx) {
  const handle = page.locator('#pocketLayoutCanvas circle.fc-handle').first();
  const b = await handle.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dxPx, b.y + b.height / 2 + dyPx, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(80);
}

test('pocket 2D canvas: rect / circle / ellipse size handles each drive their field through the registry', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/api\/descriptor|404/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.openWiz('pocket'));
  await page.waitForSelector('#wiz_pocket', { state: 'visible' });
  await page.waitForSelector('#pocketLayoutCanvas svg.feature-canvas', { timeout: 5000 });

  // RECT (default) — a `rect` gesture (divisor 1) → p_w grows when the corner is dragged out.
  const wBefore = await page.inputValue('#p_w');
  await dragSizeHandle(page, 70, 40);
  const wAfter = await page.inputValue('#p_w');
  console.log('rect p_w before/after:', wBefore, wAfter);
  expect(Number(wAfter), 'rect size drag grows p_w').toBeGreaterThan(Number(wBefore));

  // CIRCLE — a radius-only `radial` gesture → p_dia changes (Ø = 2·distance).
  await page.selectOption('#p_shape', 'circle');
  await page.waitForTimeout(100);
  const diaBefore = await page.inputValue('#p_dia');
  await dragSizeHandle(page, 60, 0);
  const diaAfter = await page.inputValue('#p_dia');
  console.log('circle p_dia before/after:', diaBefore, diaAfter);
  expect(Number(diaAfter), 'circle ring drag changes p_dia').not.toBe(Number(diaBefore));

  // ELLIPSE — a `rect` gesture with the 0.5 half-extent divisor → p_w still changes (the special-case path is wired).
  await page.selectOption('#p_shape', 'ellipse');
  await page.waitForTimeout(100);
  const ewBefore = await page.inputValue('#p_w');
  await dragSizeHandle(page, 50, 30);
  const ewAfter = await page.inputValue('#p_w');
  console.log('ellipse p_w before/after:', ewBefore, ewAfter);
  expect(Number(ewAfter), 'ellipse size drag changes p_w').not.toBe(Number(ewBefore));

  expect(errors, 'no console/page errors during the drags').toEqual([]);
});
