import { test, expect } from '@playwright/test';

// The moving sim tool head is the ACTUAL tool profile (toolHalfProfile, revolved via LatheGeometry — the same
// builder the ATC magazine uses), not a sphere. setSimTool(tool) rebuilds it to the per-op tool's real profile.
test.use({ viewport: { width: 1280, height: 900 } });

test('sim tool head is the revolved tool profile and setSimTool rebuilds it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz._ensureAnimTool();
    const t0 = viz._animTool.geometry.type;
    const v0 = viz._animTool.geometry.attributes.position.count;
    viz.setSimTool({ type: 'ballnose', dia: 12, length: 40 });   // per-op tool → rebuild profile
    const t1 = viz._animTool.geometry.type;
    const v1 = viz._animTool.geometry.attributes.position.count;
    return { t0, v0, t1, v1 };
  });

  expect(r.t0, 'tool head is a revolved profile, not a sphere/box').toBe('LatheGeometry');
  expect(r.v0).toBeGreaterThan(0);
  expect(r.t1, 'still a profile after setSimTool').toBe('LatheGeometry');
  expect(r.v1, 'rebuilt geometry').toBeGreaterThan(0);
});
