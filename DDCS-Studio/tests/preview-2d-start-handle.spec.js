import { test, expect } from '@playwright/test';

// The 2D top-down view shows a DRAGGABLE start handle (the operator start). Dragging it re-traces from the new
// start, and the dragged value is what the wizard reads on insert (panel.getStartPos: 2D drag > 3D marker >
// inferred). Verified by driving real pointer events at the handle's computed screen position.
test.use({ viewport: { width: 1280, height: 900 } });

test('2D start handle is draggable and updates the start the wizard reads', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz && p.viz.starts; });

  // Seed a 3D start marker, switch to 2D (pushes it to the handle), and grab the handle's screen position.
  const setup = await page.evaluate(() => {
    const panel = window.ddcsStudio.wizardManager._activePanel;
    panel.viz.starts[0] = { x: 60, y: 40, z: 5 };
    const before = panel.getStartPos();
    panel.setView('2d');
    const cv = panel.el.querySelector('.pp-2d');
    const v = cv.__t2view;
    const r = cv.getBoundingClientRect();
    // handle screen position (page coords)
    const start = panel.getStartPos();
    return {
      before, start,
      hx: r.left + (v.ox + start.x * v.scale),
      hy: r.top + (v.oy - start.y * v.scale),
    };
  });
  expect(setup.before, '3D marker feeds getStartPos').toMatchObject({ x: 60, y: 40, z: 5 });
  expect(setup.start, 'start carried into 2D').toMatchObject({ x: 60, y: 40 });

  // Drag the handle +80px to the right → +X in world (re-traces on release).
  await page.mouse.move(setup.hx, setup.hy);
  await page.mouse.down();
  await page.mouse.move(setup.hx + 80, setup.hy, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(100);

  const after = await page.evaluate(() => window.ddcsStudio.wizardManager._activePanel.getStartPos());
  expect(after.x, 'start X moved right with the handle').toBeGreaterThan(setup.start.x + 5);
  expect(Math.abs(after.y - setup.start.y), 'start Y roughly unchanged (dragged horizontally)').toBeLessThan(5);
  expect(errors, 'no page errors').toEqual([]);
});
