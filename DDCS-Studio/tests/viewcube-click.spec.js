import { test, expect } from '@playwright/test';

// The ViewCube only snapped on an exact box-silhouette hit; the cube viewport square's corners (around the
// rotated box) were a dead zone. A click anywhere in the square now snaps to the nearest VISIBLE face.
test.use({ viewport: { width: 1280, height: 900 } });

test('clicking a corner of the cube viewport square (off the box) still snaps the view', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    return p && p.viz && p.viz._cubeRect && p.viz.renderer;
  });

  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz.theta = 0.6; viz.phi = 0.9; viz._applyCamera(); viz.render();   // a clearly non-cardinal orientation
    const before = { theta: viz.theta, phi: viz.phi };
    const rect = viz.renderer.domElement.getBoundingClientRect();
    const { size, m } = viz._cubeRect;
    // top-right corner of the cube square — near the square edge, off the rotated box silhouette
    const e = { clientX: rect.left + rect.width - m - 2, clientY: rect.top + m + 2 };
    const consumed = viz._pickCube(e);
    return { before, consumed, after: { theta: viz.theta, phi: viz.phi } };
  });

  expect(r.consumed, 'a click in the cube square is handled (not passed to orbit)').toBeTruthy();
  const moved = Math.abs(r.before.theta - r.after.theta) + Math.abs(r.before.phi - r.after.phi);
  expect(moved, 'the corner click snapped the camera to a face view').toBeGreaterThan(0.05);
});
