import { test, expect } from '@playwright/test';

// The Edge wizard had no inferStart(), and its view called preview3D without a start — so the preview spindle
// start defaulted to the origin (wrong). It now mirrors the Middle/Corner single-wall logic: park clear of the
// wall being probed, perpendicular axis at the stock centre.
test.use({ viewport: { width: 1280, height: 900 } });

test('edge wizard preview start is parked clear of the wall, not at the origin', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('edge'));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    return p && p.viz && p.viz.starts && p.viz.starts[0];
  });
  const st = await page.evaluate(() => {
    const s = window.ddcsStudio.wizardManager._activePanel.viz.starts[0];
    return { x: s.x, y: s.y, z: s.z };
  });
  // default axis X / dir pos → parked on the −X side (x<0), perpendicular (Y) at the stock centre, just below top.
  expect(st.x, 'parked clear on the −X side (probe approaches the face from open space)').toBeLessThan(-1);
  expect(st.y, 'perpendicular axis at the stock centre, not 0').toBeGreaterThan(1);
  expect(st.z, 'probe depth just below the top face').toBeLessThanOrEqual(0);
  expect(Math.abs(st.x) + Math.abs(st.y), 'not the origin').toBeGreaterThan(5);
});
