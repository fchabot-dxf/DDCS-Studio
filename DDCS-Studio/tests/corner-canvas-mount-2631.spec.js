import { test, expect } from '@playwright/test';

/**
 * t2631 (BACKLOG #71/#72, THE GATED PILOT, LAST OP) — REAL-SYMPTOM supplement to
 * `corner-form-reproduction-2631.spec.js` (which covers row-diff/edit-reaches-model). This file covers the ONE
 * thing that harness doesn't: a real page open, proving the feature canvas actually mounts with no unwired
 * placeholder — the exact question that started this whole arc (the owner's own screenshot of corner's Blocks
 * view showing two empty mouths, LAYOUT-2D and PROJECTED-GCODE). Rule 17 (self-applied): grepped the whole
 * `tests/` directory for `cornerData`/`CORNER_DATA_OPTYPE`/`user_corner_data` before calling this migration
 * verified.
 */
test('corner-canvas-mount: the feature canvas mounts a REAL 2D/3D pane, no unwired placeholder', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(600);

  const r = await page.evaluate(() => {
    const wizUser = document.getElementById('wiz_user');
    const visible = (sel) => [...(wizUser ? wizUser.querySelectorAll(sel) : [])].some((e) => e.offsetParent !== null);
    const codeLabel = document.querySelector('#wiz_user .preview-block .label')?.textContent.replace(/\s+/g, ' ').trim() || '';
    return {
      unwiredPlaceholderCount: wizUser ? wizUser.querySelectorAll('.unwired-block').length : -1,
      has3dPaneVisible: visible('[data-viz-pane="preview3d"]'),
      has2dPaneVisible: visible('[data-viz-pane="layout2d"]'),
      canvasCount: wizUser ? wizUser.querySelectorAll('canvas').length : 0,
      codeLabel,
    };
  });

  expect(r.unwiredPlaceholderCount, 'no unwired placeholder anywhere — the two mouths the owner flagged are real now, not empty').toBe(0);
  expect(r.has3dPaneVisible, 'form3d+2d: the 3D pane is visible (fills what "3D-SIM" only fed to 3D before)').toBe(true);
  expect(r.has2dPaneVisible, 'the 2D layout pane is visible (fills LAYOUT-2D, empty since t1724)').toBe(true);
  expect(r.canvasCount, 'a real 3D canvas mounts').toBeGreaterThan(0);
  expect(r.codeLabel, 'a real code preview panel mounts (fills PROJECTED-GCODE, empty since t1724)').toContain('CODE PREVIEW');
});
