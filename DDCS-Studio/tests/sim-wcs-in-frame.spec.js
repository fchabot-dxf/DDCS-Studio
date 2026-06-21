import { test, expect } from '@playwright/test';

// Selecting a WCS in the program reflects in the sim: the preview reads the program's G54..G59 word, looks up its
// offset in the pulled WCS table, and positions the machine envelope by it — so the part sits at that WCS's spot.
test.use({ viewport: { width: 1280, height: 900 } });

test('the program WCS word places the envelope by that WCS offset', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => {
    const s = window.ddcsGetSettings();
    s.machine = Object.assign(s.machine || {}, { x: 300, y: 300, z: 120, show: true });
    s.machine.wcs = { active: 1, table: [
      { x: 0, y: 0, z: 0 },        // G54
      { x: 100, y: 50, z: -10 },   // G55
      { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 },
    ] };
  });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  const r = await page.evaluate(() => {
    const panel = window.ddcsStudio.wizardManager._activePanel;
    const wo = () => (panel.viz._machine && panel.viz._machine.workOrigin) ? { ...panel.viz._machine.workOrigin } : null;
    panel.setGcode('G54\nG1 X10 Y10 F200'); const g54 = wo();
    panel.setGcode('G55\nG1 X10 Y10 F200'); const g55 = wo();
    return { g54, g55 };
  });

  expect(r.g54, 'G54 → table[0]').toMatchObject({ x: 0, y: 0, z: 0 });
  expect(r.g55, 'G55 → table[1] offset').toMatchObject({ x: 100, y: 50, z: -10 });
});
