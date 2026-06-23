import { test, expect } from '@playwright/test';

// The sim tool RESPECTS THE TOOL TABLE: a program's active T# is looked up in settings.atc.tools and the sim
// renders that tool's type/Ø/length. Falls back to a probe model (G31 present) or a default endmill.
test.use({ viewport: { width: 1280, height: 900 } });

test('sim tool resolves T# from the tool table (type/diameter)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.atc = s.atc || {}; s.atc.tools = [{ num: 3, type: 'ballnose', dia: 10, length: 30 }]; });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  const r = await page.evaluate(() => {
    const panel = window.ddcsStudio.wizardManager._activePanel;
    panel.setGcode('T3 M6\nG1 X10 Y10 F300\nG1 X20');   // uses tool 3
    const t = panel.viz._simTool;
    panel.setGcode('G31 Z-10 F50');                      // a probe move → probe model
    const p = panel.viz._simTool;
    return { t, p };
  });
  expect(r.t, 'T3 → tool-table spec').toMatchObject({ type: 'ballnose', dia: 10 });
  expect(r.p, 'G31 (no tool) → probe model').toMatchObject({ type: 'probe' });
});
