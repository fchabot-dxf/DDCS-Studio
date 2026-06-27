import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1200, height: 1000 } });

/**
 * Slot 2D layout canvas — Stage-2 canvas-widget migration (slotView onto the registry). Slot is the op that FORCES the
 * 3rd gesture: its width handle is a perpendicular projection onto the slot normal (projLength), with A↔B as two `point`
 * handles. Drill-level rigor: the exact math is asserted in canvas-widgets.spec; here, real pointer drags through the
 * migrated path must move the right field — the width handle (projLength) and an endpoint (point) both wired.
 */
async function drag(page, locator, dxPx, dyPx) {
  const b = await locator.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dxPx, b.y + b.height / 2 + dyPx, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(80);
}

test('slot 2D canvas: width (projLength) + endpoint (point) handles drive their fields through the registry', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/api\/descriptor|404/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.openWiz('slot'));
  await page.waitForSelector('#wiz_slot', { state: 'visible' });
  await page.waitForSelector('#slotLayoutCanvas svg.feature-canvas', { timeout: 5000 });

  // Three handles: A + B (point → snapping squares) and width (projLength → a round size handle).
  const moves = await page.locator('#slotLayoutCanvas .fc-handle-move').count();
  const sizes = await page.locator('#slotLayoutCanvas circle.fc-handle').count();
  expect(moves, 'A + B render as move handles').toBe(2);
  expect(sizes, 'width renders as a size handle').toBe(1);

  // WIDTH (projLength) — drag perpendicular to the (horizontal) centreline → sl_width changes.
  const wBefore = await page.inputValue('#sl_width');
  await drag(page, page.locator('#slotLayoutCanvas circle.fc-handle').first(), 0, 60);
  const wAfter = await page.inputValue('#sl_width');
  console.log('slot sl_width before/after:', wBefore, wAfter);
  expect(Number(wAfter), 'width handle drag changes sl_width').not.toBe(Number(wBefore));

  // ENDPOINT B (point) — drag well clear of part-zero (no snap) → sl_bx moves.
  const bxBefore = await page.inputValue('#sl_bx');
  await drag(page, page.locator('#slotLayoutCanvas .fc-handle-move').nth(1), 90, -40);
  const bxAfter = await page.inputValue('#sl_bx');
  console.log('slot sl_bx before/after:', bxBefore, bxAfter);
  expect(Number(bxAfter), 'endpoint drag moves sl_bx').not.toBe(Number(bxBefore));

  expect(errors, 'no console/page errors during the drags').toEqual([]);
});
