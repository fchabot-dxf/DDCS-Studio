import { test, expect } from '@playwright/test';

// A wizard param edit WHILE the sim animation is running should refresh the animation onto the new path — restart
// the moving tool immediately, not finish the stale pass first. Driven by createPreviewPanel.scheduleLiveRestart.
test.use({ viewport: { width: 1280, height: 900 } });

test('the running sim animation refreshes when a wizard param changes mid-run', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = Object.assign(s.stock || {}, { x: 140, y: 120, z: 20, show: true, datum: 'nnp' }); });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = String(v); };
    set('d_pattern', 'grid'); set('d_cols', 2); set('d_rows', 2); set('d_dx', 20); set('d_dy', 20);
    window.ddcsStudio.wizardManager.update();
  });

  const eng = () => page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; return (p && p.engine) ? { running: p.engine.running, len: p.engine.program.length } : null; });

  // Ensure the animation is playing (auto-plays on open; click Run as a fallback).
  await page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.engine && p.engine.running) return; const b = p && p.el && p.el.querySelector('.pp-run'); if (b) b.click(); });
  await expect.poll(async () => (await eng())?.running, { timeout: 5000 }).toBe(true);
  const before = (await eng()).len;
  expect(before, 'a program is running').toBeGreaterThan(0);

  // Change the grid to many more holes WHILE running → a longer program. The live-restart must re-run the engine
  // on it (without the fix the engine keeps the old 2x2 program until the pass finishes + loops).
  await page.evaluate(() => { document.getElementById('d_cols').value = '6'; document.getElementById('d_rows').value = '4'; window.ddcsStudio.wizardManager.update(); });
  await expect.poll(async () => (await eng())?.len, { timeout: 3000 }).toBeGreaterThan(before);
  expect((await eng()).running, 'still animating after the refresh, not stopped').toBe(true);
});
