import { test, expect } from '@playwright/test';

/**
 * t2621 (BACKLOG #71/#72, conversion tier, LAST of the three) — REAL-SYMPTOM supplement to
 * `contour-form-reproduction-2375.spec.js` (which the shared `formReproduction.js` harness already covers for
 * row-diff/usage-text/edit-reaches-model, now exercising the real `mode:'tree'` path). This file covers the
 * ONE thing that harness doesn't: a real page open, proving the feature canvas actually mounts with no unwired
 * placeholder. Rule 17 (self-applied): grepped the whole `tests/` directory for
 * `contourData`/`CONTOUR_DATA_OPTYPE`/`user_contour_data` before calling this migration verified.
 */
test('contour-canvas-mount: the feature canvas mounts a REAL 2D/3D pane, no unwired placeholder', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(() => window.openWiz('user_contour_data'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(600);

  const r = await page.evaluate(() => {
    const wizUser = document.getElementById('wiz_user');
    const visible = (sel) => [...(wizUser ? wizUser.querySelectorAll(sel) : [])].some((e) => e.offsetParent !== null);
    return {
      unwiredPlaceholderCount: wizUser ? wizUser.querySelectorAll('.unwired-block').length : -1,
      has3dPaneVisible: visible('[data-viz-pane="preview3d"]'),
      has2dPaneVisible: visible('[data-viz-pane="layout2d"]'),
      canvasCount: wizUser ? wizUser.querySelectorAll('canvas').length : 0,
    };
  });

  expect(r.unwiredPlaceholderCount, 'no unwired placeholder anywhere').toBe(0);
  expect(r.has3dPaneVisible, 'form3d+2d: the 3D pane is visible').toBe(true);
  expect(r.has2dPaneVisible, 'the 2D layout pane is visible').toBe(true);
  expect(r.canvasCount, 'a real 3D canvas mounts').toBeGreaterThan(0);
});
