import { test, expect } from '@playwright/test';

// Start ≠ path. The route anchor is driven by G90/G91 (reported as stats.absolute):
//   • ABSOLUTE program (G90/G53 — mill) → path sits at its own coords; moving the start does NOT drag it.
//   • purely INCREMENTAL program (G91 — e.g. a probe macro) → path emanates from the start; moving it drags the path.
test.use({ viewport: { width: 1280, height: 900 } });

test('moving the start drags an incremental path but not an absolute (mill) one', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  const measure = (gcode) => page.evaluate((gc) => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    window.ddcsStudio.wizardManager._activePanel.setGcode(gc);
    const minx = () => { const g = viz.lineGroups.feed; if (!g) return null; g.geometry.computeBoundingBox(); return g.geometry.boundingBox.min.x; };
    viz.starts[0] = { x: 0, y: 0, z: 0 }; viz._rebuild(); const before = minx();
    viz.starts[0] = { x: 40, y: 0, z: 0 }; viz._rebuild(); const after = minx();
    return { anchored: viz._anchorToStart, before, after };
  }, gcode);

  const abs = await measure('G90\nG0 X10 Y10\nG1 X30 Y30 F200');
  const inc = await measure('G91\nG1 X10 Y10 F200\nG1 X10 Y0');

  expect(abs.anchored, 'absolute program is not start-anchored').toBe(false);
  expect(abs.after, 'absolute path stays put when the start moves').toBeCloseTo(abs.before, 1);

  expect(inc.anchored, 'incremental program is start-anchored').toBe(true);
  expect(inc.after - inc.before, 'incremental path shifts by the start delta').toBeCloseTo(40, 0);
});
