import { test, expect } from '@playwright/test';

// Rotary ops add a manual A± jog row to the jog pendant: clicking it spins the part about the 4th axis in the
// preview (viz.rotaryJogA → _applyPartRotation). Non-rotary ops never show the row.
test.use({ viewport: { width: 1280, height: 900 } });

test('rotary op shows A± jog and rotating it spins the part; non-rotary hides it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);

  // --- rotary centre: the A row shows, and A+ rotates the part group ---
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('rotary_center'));
  await page.waitForSelector('#wiz_rotary_center', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz && p.viz.jogPendant; });

  const rotary = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    const row = viz.jogPendant.querySelector('.jog-a-row');
    const rowShown = !!row && row.style.display !== 'none';
    const aplus = row && row.querySelector('button[data-axis="a"][data-dir="1"]');
    const before = viz._partGroup ? viz._partGroup.rotation.x : null;
    const stepBtn = viz.jogPendant.querySelector('.jog-step-cycle');
    while (stepBtn.dataset.step !== '10') stepBtn.click();   // jog 10 deg
    aplus.click();
    const after = viz._partGroup ? viz._partGroup.rotation.x : null;
    return { rowShown, jogA: viz._jogA, before, after };
  });
  expect(rotary.rowShown, 'rotary op shows the A± jog row').toBe(true);
  expect(rotary.jogA, 'A+ jogged the part by the step (10 deg)').toBeCloseTo(10, 3);
  expect(Math.abs(rotary.after - rotary.before), 'the part group actually rotated about its axis').toBeGreaterThan(0.1);

  // --- a non-rotary op (drill): the A row is hidden ---
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz && p.viz.jogPendant; });
  const nonRotary = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    const row = viz.jogPendant.querySelector('.jog-a-row');
    return { rowShown: !!row && row.style.display !== 'none' };
  });
  expect(nonRotary.rowShown, 'a non-rotary op does not show the A± jog row').toBe(false);
});
