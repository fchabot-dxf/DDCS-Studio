import { test, expect } from '@playwright/test';

// The jog pendant's Step is a single cycle-toggle button: 0.1 → 1 → 10 → 100 → (wrap). The current step drives
// how far each jog button nudges the start marker.
test.use({ viewport: { width: 1280, height: 900 } });

test('jog step cycles 0.1/1/10/100 and sets the jog distance', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz && p.viz.jogPendant; });

  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz.starts = [{ x: 0, y: 0, z: 0 }];
    const cyc = viz.jogPendant.querySelector('.jog-step-cycle');
    const seq = [cyc.dataset.step];
    for (let i = 0; i < 4; i++) { cyc.click(); seq.push(cyc.dataset.step); }   // full wrap
    while (cyc.dataset.step !== '100') cyc.click();                            // land on 100
    const x0 = viz.starts[0].x;
    viz.jogPendant.querySelector('button[data-axis="x"][data-dir="1"]').click();
    return { seq, jogged: viz.starts[0].x - x0, label: cyc.textContent };
  });

  expect(r.seq, 'cycles 10 → 100 → 0.1 → 1 → 10').toEqual(['10', '100', '0.1', '1', '10']);
  expect(r.jogged, 'X+ jog moved by the current step (100)').toBeCloseTo(100, 3);
  expect(r.label, 'button shows the current step').toBe('100');
});
