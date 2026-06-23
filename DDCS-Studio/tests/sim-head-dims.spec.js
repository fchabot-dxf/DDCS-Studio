import { test, expect } from '@playwright/test';

// The spindle/collet body sizes are PREVIEW settings (visual only) that the viz pulls via setHead — so the sim
// matches the user's real machine head. Changing preview.head.spindleDia resizes the spindle mesh.
test.use({ viewport: { width: 1280, height: 900 } });

test('Preview head dims drive the spindle assembly size', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.preview = s.preview || {}; s.preview.head = { spindleDia: 120, spindleLen: 150, colletDia: 24, colletLen: 30 }; });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz._ensureAnimTool();
    const g = viz._animParts.spindle.geometry; g.computeBoundingBox();
    return { headDia: viz._head && viz._head.spindleDia, spR: g.boundingBox.max.x };
  });
  expect(r.headDia, 'viz pulled the head dims from Preview settings').toBe(120);
  expect(r.spR, 'spindle radius = Ø120/2').toBeGreaterThan(55);
});
