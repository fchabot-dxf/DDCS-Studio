import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1200, height: 1000 } });

/**
 * Contour 2D layout canvas — Stage-2 canvas-widget migration (contourView onto the registry). Contour is the LAST
 * draggable view; once it's on the registry every handcoded canvas GUI is declarative (Stage 2 done). It reuses the
 * SAME shape vocabulary as pocket (point + rect + radius-only radial), so the exact math is already proven byte-identical
 * in canvas-widgets.spec — here we verify the wiring end-to-end with real pointer drags through the migrated path.
 */
async function dragSizeHandle(page, dxPx, dyPx) {
  const handle = page.locator('#contourLayoutCanvas circle.fc-handle').first();
  const b = await handle.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dxPx, b.y + b.height / 2 + dyPx, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(80);
}

test('contour 2D canvas: rect / circle / ellipse size handles each drive their field through the registry', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/api\/descriptor|404/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsInteractive === '1');
  await page.evaluate(() => window.openWiz('contour'));
  await page.waitForSelector('#wiz_contour', { state: 'visible' });
  await page.waitForSelector('#contourLayoutCanvas svg.feature-canvas', { timeout: 5000 });

  // RECT (default) — a `rect` gesture (divisor 1) → ct_w grows.
  const wBefore = await page.inputValue('#ct_w');
  await dragSizeHandle(page, 70, 40);
  const wAfter = await page.inputValue('#ct_w');
  console.log('rect ct_w before/after:', wBefore, wAfter);
  expect(Number(wAfter), 'rect size drag grows ct_w').toBeGreaterThan(Number(wBefore));

  // CIRCLE — a radius-only `radial` gesture → ct_dia changes.
  await page.selectOption('#ct_shape', 'circle');
  await page.waitForTimeout(100);
  const diaBefore = await page.inputValue('#ct_dia');
  await dragSizeHandle(page, 60, 0);
  const diaAfter = await page.inputValue('#ct_dia');
  console.log('circle ct_dia before/after:', diaBefore, diaAfter);
  expect(Number(diaAfter), 'circle ring drag changes ct_dia').not.toBe(Number(diaBefore));

  // ELLIPSE — a `rect` gesture with the 0.5 half-extent divisor → ct_w changes.
  await page.selectOption('#ct_shape', 'ellipse');
  await page.waitForTimeout(100);
  const ewBefore = await page.inputValue('#ct_w');
  await dragSizeHandle(page, 50, 30);
  const ewAfter = await page.inputValue('#ct_w');
  console.log('ellipse ct_w before/after:', ewBefore, ewAfter);
  expect(Number(ewAfter), 'ellipse size drag changes ct_w').not.toBe(Number(ewBefore));

  expect(errors, 'no console/page errors during the drags').toEqual([]);
});
