import { test, expect } from '@playwright/test';

// INC2: the jog pendant must MOVE the SELECTED per-pass start (not just pass 0). Verify-first (turn 51) found this
// already works in the current code — INC1's per-pass plumbing resolved it: viz.starts is grown to passCount, the start
// selector picks the pass, the jog handler jogs viz.starts[selectedStart], and onStartChange syncs ALL passes to the
// shared passStarts so it persists + reflects in the 2D. (The human's "selects ② but won't move" was the pre-INC1
// invisibility of ② — there was no 2D marker to see move.) This LOCKS the working behaviour.
const BASE = process.env.STUDIO_URL || 'http://localhost:3211';
test.use({ viewport: { width: 1280, height: 900 } });

test('jogging the selected 2nd start moves it, persists across a re-trace, and reflects in the 2D', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.ioPanel && typeof window.ddcsGetSettings === 'function' && typeof window.setGcodeView === 'function');
  const code = await page.evaluate(async () => {
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    return new MiddleWizard().generate({ featureType: 'boss', twoAxis: true, approach: 'manual', stockX: 100, stockY: 80, stockZ: 20 });
  });
  await page.locator('#editor').fill(code);
  await page.evaluate(() => { window.ddcsGetSettings().preview.autoLoop = false; });
  await page.evaluate(() => window.setGcodeView('3d'));
  await page.waitForSelector('#viz3d-panel-host .pp-run', { state: 'attached', timeout: 8000 });
  await page.waitForFunction(() => { const v = window.__gpPanel && window.__gpPanel.viz; return v && v.starts && v.starts.length >= 2; });

  const r = await page.evaluate(() => {
    const panel = window.__gpPanel, viz = panel.viz;
    viz.selectStart(1);                                                  // pick ② (pass index 1) via the selector
    const before = { x: viz.starts[1].x, y: viz.starts[1].y };
    const sb = viz.jogPendant.querySelector('.jog-step-cycle'); if (sb) sb.dataset.step = '10';
    viz.jogPendant.querySelector('[data-axis="x"][data-dir="1"]').click();   // X+ 10
    viz.jogPendant.querySelector('[data-axis="y"][data-dir="1"]').click();   // Y+ 10
    const afterJog = { x: viz.starts[1].x, y: viz.starts[1].y };
    panel.refresh();                                                     // re-trace → must persist
    const afterRetrace = { x: viz.starts[1].x, y: viz.starts[1].y };
    panel.setView('2d');                                                 // the 2D ② must reflect the jog
    const m1 = (panel.el.querySelector('.pp-2d').__t2starts || []).find((m) => m.i === 1);
    return { selected: viz.selectedStart, before, afterJog, afterRetrace, twoD: m1 && { x: m1.x, y: m1.y } };
  });

  expect(r.selected, 'the selector picked ② (pass 1)').toBe(1);
  expect(r.afterJog.x, 'jog X+ moved ② +10').toBeCloseTo(r.before.x + 10, 1);
  expect(r.afterJog.y, 'jog Y+ moved ② +10').toBeCloseTo(r.before.y + 10, 1);
  expect(r.afterRetrace, 'the jog persists across a re-trace').toEqual(r.afterJog);
  expect(r.twoD, 'the 2D ② marker reflects the jogged position').toEqual(r.afterJog);
});
