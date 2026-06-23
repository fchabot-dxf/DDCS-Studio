import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1200, height: 1000 } });

test('drill 2D layout canvas: renders + drag handle drives a field', async ({ page }) => {
  const errors = [];
  // /api/descriptor 404s under static http-server (backend-only endpoint) — benign, ignore it.
  page.on('console', (m) => { if (m.type() === 'error' && !/api\/descriptor|404/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  // Open the drill wizard (global helper used by the command-deck button).
  await page.evaluate(() => window.openWiz('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });

  // The 2D canvas should mount an SVG with handles.
  await page.waitForSelector('#drillLayoutCanvas svg.feature-canvas', { timeout: 5000 });
  const handleCount = await page.locator('#drillLayoutCanvas .fc-handle').count();
  const holeCount = await page.locator('#drillLayoutCanvas .fc-hole').count();
  console.log('handles:', handleCount, 'holes:', holeCount);

  // Switch to bolt circle so we can drag the ring handle to change Ø.
  await page.selectOption('#d_pattern', 'circle');
  await page.waitForTimeout(100);
  const diaBefore = await page.inputValue('#d_dia');

  // Drag the round (size) handle outward; expect d_dia to grow.
  const ring = page.locator('#drillLayoutCanvas circle.fc-handle').first();
  const box = await ring.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const diaAfter = await page.inputValue('#d_dia');
  console.log('d_dia before:', diaBefore, 'after:', diaAfter);

  await page.screenshot({ path: 'tests/_drill-canvas.png' });

  console.log('CONSOLE ERRORS:', JSON.stringify(errors, null, 2));
  expect(handleCount).toBeGreaterThan(0);

  // FIX B: the unhelpful raw "dx" delta readout is dropped. Switch back to the grid pattern (which carried it),
  // and confirm no on-canvas handle label shows the "dx" text — while the useful named labels (Ø) still render.
  await page.selectOption('#d_pattern', 'grid');
  await page.waitForTimeout(80);
  const labels = await page.locator('#drillLayoutCanvas .fc-handle-label').allTextContents();
  console.log('grid handle labels:', JSON.stringify(labels));
  expect(labels.some((t) => /\bdx\b/i.test(t)), 'no raw dx delta readout label').toBeFalsy();
  expect(Number(diaAfter)).not.toBe(Number(diaBefore));
  expect(errors).toEqual([]);
});

test('drill 2D layout canvas: zoom + pan are view-only, drag still works after', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/api\/descriptor|404/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.openWiz('drill'));
  await page.waitForSelector('#drillLayoutCanvas svg.feature-canvas');

  const hole = page.locator('#drillLayoutCanvas .fc-hole').first();
  const canvas = page.locator('#drillLayoutCanvas svg.feature-canvas');
  const cb = await canvas.boundingBox();
  const dxBefore = await page.inputValue('#d_dx');

  // Zoom in over the canvas centre — holes should render larger, params unchanged.
  const before = await hole.boundingBox();
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(60);
  const afterZoom = await hole.boundingBox();
  console.log('hole width  before/afterZoom:', before.width.toFixed(1), afterZoom.width.toFixed(1));
  expect(afterZoom.width).toBeGreaterThan(before.width + 2);
  expect(await page.inputValue('#d_dx')).toBe(dxBefore);

  // Pan by dragging an empty corner — hole moves on screen, params unchanged.
  const hx = (await hole.boundingBox()).x;
  await page.mouse.move(cb.x + 18, cb.y + 18);
  await page.mouse.down();
  await page.mouse.move(cb.x + 78, cb.y + 78, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(60);
  const hx2 = (await hole.boundingBox()).x;
  console.log('hole x before/afterPan:', hx.toFixed(1), hx2.toFixed(1));
  expect(Math.abs(hx2 - hx)).toBeGreaterThan(10);
  expect(await page.inputValue('#d_dx')).toBe(dxBefore);

  // A handle drag must still drive its param in the adjusted (panned/zoomed) view.
  const sizeHandle = page.locator('#drillLayoutCanvas circle.fc-handle').first();
  const sb = await sizeHandle.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width / 2 + 40, sb.y + sb.height / 2 + 10, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(60);
  console.log('d_dx before/afterHandleDrag:', dxBefore, await page.inputValue('#d_dx'));
  expect(await page.inputValue('#d_dx')).not.toBe(dxBefore);

  expect(errors).toEqual([]);
});
