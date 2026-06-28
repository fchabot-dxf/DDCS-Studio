import { test, expect } from '@playwright/test';

// #18: dragging the START handle should REPLAY the sim animation from the new start (today it only re-traced the static
// path). onStartDrag (2D handle) + viz.onStartChange (3D marker) now also call replayFromStart() → the engine re-runs
// from the moved start, so you SEE the probe travel from there. Verify = the human's eyes; this guards the wiring: with
// autoLoop off and no run in progress, a handle drag must START a run.
test.use({ viewport: { width: 1280, height: 900 } });

test('dragging the 2D start handle re-runs the sim from the new start', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => { window.ddcsGetSettings().preview.autoLoop = false; });   // no auto-play → the run can only come from the drag
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz && p.viz.starts; });

  const setup = await page.evaluate(() => {
    const panel = window.ddcsStudio.wizardManager._activePanel;
    panel.viz.starts[0] = { x: 60, y: 40, z: 5 };
    panel.setView('2d');
    panel.setActive(true);
    panel.stop();                                   // ensure nothing is running before the drag
    const cv = panel.el.querySelector('.pp-2d'), v = cv.__t2view, r = cv.getBoundingClientRect();
    const start = panel.getStartPos();
    return {
      running0: !!(panel.engine && panel.engine.running),
      hx: r.left + (v.ox + start.x * v.scale),
      hy: r.top + (v.oy - start.y * v.scale),
    };
  });
  expect(setup.running0, 'nothing running before the drag').toBe(false);

  // drag the handle +80px → +X in world; on release onStartDrag fires → replayFromStart()
  await page.mouse.move(setup.hx, setup.hy);
  await page.mouse.down();
  await page.mouse.move(setup.hx + 80, setup.hy, { steps: 6 });
  await page.mouse.up();

  // the drag started a fresh run from the new start (engine.running becomes true)
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p.engine && p.engine.running; }, { timeout: 5000 });
  const after = await page.evaluate(() => window.ddcsStudio.wizardManager._activePanel.getStartPos());
  expect(after.x, 'the start actually moved (+X)').toBeGreaterThan(60 + 5);
  expect(errors, 'no page errors').toEqual([]);
});
