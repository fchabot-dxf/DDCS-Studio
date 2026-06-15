import { test, expect } from '@playwright/test';

// Preview controls cleanup: a SINGLE 2D/3D toggle (label flips), exactly ONE Stock button (the 📦 in the
// controls; the jog pendant's duplicate was removed), a bare/compact speed select, and controls that are
// ALWAYS visible (the auto-hide was removed — annoying on hover, broken on touch).
test.use({ viewport: { width: 1280, height: 900 } });

test('preview: single 2D/3D toggle, one Stock, always-visible compact controls', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => [...document.querySelectorAll('.preview-panel')].some((p) => p.querySelector('.viz3d-controls')));

  const r = await page.evaluate(() => {
    const p = [...document.querySelectorAll('.preview-panel')].find((x) => x.querySelector('.viz3d-controls'));
    const c = p.querySelector('.viz3d-controls');
    const mt = c.querySelector('.pp-mtoggle');
    return {
      toggleLabel: mt ? mt.textContent.trim() : null,
      hasOldButtons: !!(c.querySelector('.pp-m2d') || c.querySelector('.pp-m3d')),
      stockCount: p.querySelectorAll('.pp-stock, #jogStockBtn').length,
      stockIcon: c.querySelector('.pp-stock') && c.querySelector('.pp-stock').textContent.trim(),
      speedLabels: c.querySelectorAll('label').length,
      controlsOpacity: getComputedStyle(c).opacity,
      hasJog: !!c.querySelector('.pp-jog'),       // jog + I/O merged into the single bar
      hasIO: !!c.querySelector('.pp-io'),
      separateJogBar: !!document.querySelector('.jog-bar'),
    };
  });
  expect(r.hasJog && r.hasIO, 'jog + I/O are in the single controls bar').toBeTruthy();
  expect(r.separateJogBar, 'no separate jog bar (single bar)').toBeFalsy();
  expect(r.toggleLabel, 'single 2D/3D toggle, labelled with the current view').toBe('3D');
  expect(r.hasOldButtons, 'no separate 2D + 3D buttons').toBeFalsy();
  expect(r.stockCount, 'exactly one Stock button (no jog-pendant duplicate)').toBe(1);
  expect(r.stockIcon).toBe('📦');
  expect(r.speedLabels, 'speed is a bare select (no text label)').toBe(0);
  expect(parseFloat(r.controlsOpacity), 'controls always visible (auto-hide removed)').toBe(1);

  // the toggle flips its label
  await page.evaluate(() => [...document.querySelectorAll('.preview-panel')].find((x) => x.querySelector('.pp-mtoggle')).querySelector('.pp-mtoggle').click());
  const after = await page.evaluate(() => [...document.querySelectorAll('.preview-panel')].find((x) => x.querySelector('.pp-mtoggle')).querySelector('.pp-mtoggle').textContent.trim());
  expect(after, 'toggle flips 3D → 2D').toBe('2D');

  // speed is a cycling button (1× → 2× → 5× → 10× → 1×), not a dropdown
  const sp = await page.evaluate(() => {
    const s = [...document.querySelectorAll('.preview-panel')].find((x) => x.querySelector('.pp-speed')).querySelector('.pp-speed');
    const seq = [s.textContent.trim()];
    for (let i = 0; i < 4; i++) { s.click(); seq.push(s.textContent.trim()); }
    return { tag: s.tagName, seq };
  });
  expect(sp.tag, 'speed is a button, not a select').toBe('BUTTON');
  expect(sp.seq, 'cycles 1×→2×→5×→10×→1×').toEqual(['1×', '2×', '5×', '10×', '1×']);
});
