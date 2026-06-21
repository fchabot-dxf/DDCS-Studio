import { test, expect } from '@playwright/test';

// The jog drawer has precise X/Y/Z start fields: they reflect the selected start marker (synced after jog/drag/
// select) and typing one moves the marker.
test.use({ viewport: { width: 1280, height: 900 } });

test('precise X/Y/Z start entry reflects and sets the start marker', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz && p.viz.jogPendant; });

  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    const inputs = viz.jogPendant.querySelectorAll('.jog-pos');
    viz.starts[0] = { x: 5, y: 6, z: 7 }; viz._syncJogPos();           // marker → fields
    const shown = [...inputs].map((i) => i.value);
    const xi = viz.jogPendant.querySelector('.jog-pos[data-axis="x"]'); // field → marker
    xi.value = '20'; xi.dispatchEvent(new Event('change', { bubbles: true }));
    return { count: inputs.length, shown, x: viz.starts[0].x };
  });

  expect(r.count, 'three precise fields').toBe(3);
  expect(r.shown, 'fields reflect the marker').toEqual(['5', '6', '7']);
  expect(r.x, 'typing moves the marker').toBe(20);
});
