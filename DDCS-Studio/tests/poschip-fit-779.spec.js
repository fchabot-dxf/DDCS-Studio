import { test, expect } from '@playwright/test';

/**
 * t779 PREVIEW RIDER: (1) the 3D position chip draws ALWAYS-ON-TOP (depthTest off + high renderOrder) + a screen-space
 * SIDE OFFSET so the spindle body can't hide it; (2) it reads X/Y/Z (the DRO-equal work coords); (3) the default camera
 * fit frames the WORK (stock + toolpath), EXCLUDING the machine envelope — which stays drawn as context; double-click
 * cycles to the full-envelope framing.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const openViz = async (page) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(() => window.openWiz('user_tap_data'));
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; }, { timeout: 8000 });
};

test('poschip reads X/Y/Z DRO-equal, draws always-on-top (depthTest off + high renderOrder), and side-offsets', async ({ page }) => {
  await openViz(page);
  const r = await page.evaluate(async () => {
    const { setDisplayElement } = await import('/viz/displayPrefs.js');
    setDisplayElement('poschip', { visible: true, alpha: 1 });
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz._ensureAnimTool();
    viz._updatePosChip({ x: 5, y: -795, z: -12.5 });   // the head pos = the DRO source
    const sp = viz._posChip;
    return { val: viz._posChipVal, depthTest: sp.material.depthTest, depthWrite: sp.material.depthWrite, renderOrder: sp.renderOrder, centerX: sp.center.x, canvasH: viz._posChipCv.height };
  });
  expect(r.val, 'the chip reads X, Y AND Z, equal to the head pos (DRO-equal)').toEqual({ x: 5, y: -795, z: -12.5 });
  expect(r.depthTest, 'always on top — depth test off').toBe(false);
  expect(r.depthWrite, 'no depth write').toBe(false);
  expect(r.renderOrder, 'renders above the tool/spindle body').toBeGreaterThan(100);
  expect(Math.abs(r.centerX - 0.5), 'a screen-space side offset (sprite center shifted from centre)').toBeGreaterThan(0.08);
  expect(r.canvasH, 'the chip canvas holds 3 lines (X/Y/Z)').toBe(108);
});

test('the default fit frames the WORK, excludes the big envelope; a double-click cycles to the envelope', async ({ page }) => {
  await openViz(page);
  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz.setMachine({ show: true, x: 3800, y: 3800, z: 800 });   // a big ~3.8 m table
    viz.setStock({ show: true, x: 100, y: 80, z: 20 });          // a small stock
    viz.fitAll(false); const work = viz.radius;                  // default: work-only
    viz.fitAll(true); const env = viz.radius;                    // cycle: include the envelope
    return { work, env };
  });
  expect(r.work, 'the default work fit is far tighter than the full-envelope fit').toBeLessThan(r.env * 0.4);
  expect(r.env, 'the envelope fit reaches the big machine').toBeGreaterThan(1500);
});
