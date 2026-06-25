import { test, expect } from '@playwright/test';

/**
 * The shared 2D drawing CORE (ui/shapeStage.js), extracted from iconEditor so the icon composer AND the region
 * editor consume ONE drawing implementation (docs/RICH-WIDGETS-AND-ICONS.md "Track D"). Pure: stageSvg renders the
 * layers + handles; startGesture/applyGesture are the move/resize/rotate math; rotateVec/boxPoint are geometry.
 * Plus a smoke test that iconEditor still opens + edits after the refactor (it had no test before).
 */

test('shapeStage: stageSvg renders shapes + handles; gestures move/resize; rotateVec', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const S = await import('/ui/shapeStage.js');
    const layers = [
      { type: 'rect', x: 10, y: 10, w: 50, h: 30, rot: 0 },
      { type: 'poly', x: 0, y: 0, w: 100, h: 60, rot: 0, points: '0,0 100,0 50,60' },
    ];
    const svg = S.stageSvg(layers, 0, 360, 180);

    const L = { type: 'rect', x: 10, y: 10, w: 50, h: 30, rot: 0 };
    const g = S.startGesture(null, L, { x: 20, y: 20 });        // grab offset (10,10)
    S.applyGesture(g, L, { x: 120, y: 70 }, false);             // → x=110, y=60

    const L2 = { type: 'rect', x: 0, y: 0, w: 100, h: 100, rot: 0 };
    const g2 = S.startGesture('se', L2, { x: 0, y: 0 });        // SE handle, opposite corner anchored
    S.applyGesture(g2, L2, { x: 60, y: 40 }, false);           // → w≈60, h≈40

    return { svg, moved: { x: L.x, y: L.y }, resized: { w: L2.w, h: L2.h }, rot: S.rotateVec({ x: 1, y: 0 }, 90) };
  });
  expect(r.svg).toContain('viewBox="0 0 360 180"');
  expect(r.svg).toContain('<rect');
  expect(r.svg).toContain('<polygon');
  expect(r.svg, 'selected layer shows the rotate/resize handles').toContain('data-h="rot"');
  expect(r.moved).toEqual({ x: 110, y: 60 });
  expect(r.resized.w).toBeCloseTo(60, 0);
  expect(r.resized.h).toBeCloseTo(40, 0);
  expect(r.rot.x).toBeCloseTo(0, 5);
  expect(r.rot.y).toBeCloseTo(1, 5);
});

test('iconEditor still opens + edits after the core extraction (smoke)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  await page.evaluate(async () => {
    const { openIconEditor } = await import('/ui/iconEditor.js');
    openIconEditor(null, () => {});
  });

  await expect(page.locator('#iconed-modal')).toBeVisible();
  await expect(page.locator('#ie_stage svg')).toHaveCount(1);
  const before = await page.locator('#ie_stage svg [data-li]').count();   // the background layer

  // add a rect → a new layer draws on the stage (proves stageSvg + the add path still work)
  await page.locator('#iconed-modal [data-add="rect"]').click();
  await page.waitForTimeout(120);
  expect(await page.locator('#ie_stage svg [data-li]').count(), 'adding a shape draws a new layer').toBe(before + 1);

  await page.locator('#iconed-modal [data-ie="x"]').click();
  await expect(page.locator('#iconed-modal')).toHaveCount(0);
});
