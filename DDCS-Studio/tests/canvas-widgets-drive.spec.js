import { test, expect } from '@playwright/test';

/**
 * The reusable CANVAS-WIDGET registry (web/viz/canvasWidgets.js) — the canvas analogue of formWidgets. A view DECLARES
 * its drag handles by gesture type (point / length / scaleX / shear) and the registry owns the place + drag math, so the
 * per-wizard hand-rolled onDrag goes away. Text is the first consumer (pos/height reuse point/length; width=scaleX,
 * slant=shear). Reused across milling wizards (Stage 2) + declarable by end users in the wizard maker (Stage 3).
 *
 * t1512 (tier migration): the pure drag-MATH tests split out to tests/node/canvas-widgets.test.mjs. These 2 remain
 * here — each opens a real wizard and queries the rendered canvas DOM for actual handle counts, which the node tier's
 * structural-only document stub cannot answer (querySelectorAll always returns []).
 */

test('drill wizard renders its handles from the registry (point + radial)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  // Switch to the bolt-circle pattern so the radial 'ring' handle (with its Ø value label) renders.
  await page.evaluate(() => { const e = document.getElementById('d_pattern'); if (e) e.value = 'circle'; window.ddcsStudio.wizardManager.update(); });
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const cont = document.getElementById('drillLayoutCanvas');
    if (!cont) return { handles: -1 };
    const labels = [...cont.querySelectorAll('.fc-handle-label')].map((t) => t.textContent);
    return {
      handles: cont.querySelectorAll('.fc-handle').length,
      moves: cont.querySelectorAll('.fc-handle-move').length,
      diamonds: cont.querySelectorAll('polygon.fc-handle').length,
      hasDia: labels.some((t) => /Ø/.test(t)),
    };
  });
  // t2327 (BACKLOG #33) — the circle ring split into TWO handles (hole #1's own angle-only rotate handle, plus
  // the diamond-shaped Ø handle) so a drag can no longer fuse radius+angle into one move — origin(point) +
  // rot(radial, angle-only) + ring(radial, diamond) = 3.
  expect(r.handles, 'origin (point) + rot (angle-only) + ring (diamond Ø) all render').toBe(3);
  expect(r.moves, 'origin is a move/snap handle').toBe(1);
  expect(r.diamonds, 'the Ø handle renders as a diamond, not a circle').toBe(1);
  expect(r.hasDia, 'the diamond Ø handle shows its value label').toBe(true);
});

test('text wizard renders its four canvas handles from the registry', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('text'));
  await page.waitForSelector('#wiz_text', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForTimeout(200);
  const handleCount = await page.evaluate(() => {
    const cont = document.getElementById('textLayoutCanvas');
    return cont ? cont.querySelectorAll('.fc-handle').length : -1;
  });
  expect(handleCount, 'pos + height + width + slant handles all render on the canvas').toBe(4);
});
