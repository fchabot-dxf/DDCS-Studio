import { test, expect } from '@playwright/test';

/**
 * ③ stock-datum drag handles — the SIM-ONLY first-start (userStarts). Split from corner-data-start-live.spec.js at the
 * t2693 tier migration (batch 4); its sibling test moved to tests/node/corner-data-start-live.test.mjs. This one stayed
 * because it opens a real wizard (window.openWiz), waits on a real DOM selector, and reads a live `.wiz-viz3d`'s
 * `__panel` instance to call `onStartDrag`/`getPassStarts` on the actual rendered 3D preview panel — a genuine
 * app+DOM+render dependency, not a pure import()+evaluate.
 *
 * (4b) THE CRITICAL — dragging the SIM-ONLY first-start (userStarts) CHANGES the preview but leaves the EMIT BYTE-IDENTICAL.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('③(4a gate + 4b) start handle GATED on probeZFirst; the SIM-ONLY first-start drag changes the preview but NOT the emit', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);

  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form [data-param]', { state: 'visible' });

  // (4a gate) the EMITTING FeatureCanvas handles: 1 off (reposition) → 2 on (+ start), via the whenOk handle-gate.
  const gate = await page.evaluate(async () => {
    const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
    const { cornerDataDef, CORNER_DEFAULTS } = await import('/blocks/dataOps/cornerData.js');
    const def = cornerDataDef();
    const S = (o) => ({ ...CORNER_DEFAULTS, ...o });
    const n = (p) => (layoutSpecFromOp(def, S(p)).handles || []).length;
    return { off: n({ probeZFirst: 0 }), on: n({ probeZFirst: 1 }) };
  });
  expect(gate.off, 'probeZFirst OFF: 1 emitting handle (the wall-2 reposition #23/#24)').toBe(1);
  expect(gate.on, 'probeZFirst ON: 2 emitting handles (+ the wall-1 start #21/#22) — the whenOk handle-gate').toBe(2);

  // (4b THE CRITICAL) drag the SIM-ONLY first-start (the createPreviewPanel userStarts seam) → the preview marker MOVES
  // (computePassStarts reflects it) but the EMIT is BYTE-IDENTICAL (Option-B — userStarts never touches params/emit).
  const beforeCode = await page.evaluate(() => (document.getElementById('wiz_user_code') || {}).textContent || '');
  const drag = await page.evaluate(() => {
    const c = document.getElementById('userViz3dContainer_tree');
    const host = c && c.parentElement && c.parentElement.querySelector('.wiz-viz3d');
    const panel = host && host.__panel;
    if (!panel || typeof panel.onStartDrag !== 'function' || typeof panel.getPassStarts !== 'function') return { wired: false };
    const before0 = panel.getPassStarts()[0] || null;
    panel.onStartDrag({ x: 33, y: 44, z: -3 }, 0);   // SIM-ONLY: move pass-0's start (userStarts[0])
    const after0 = panel.getPassStarts()[0] || null;
    return { wired: true, before0, after0 };
  });
  const afterCode = await page.evaluate(() => (document.getElementById('wiz_user_code') || {}).textContent || '');
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  expect(drag.wired, 'the wizard preview panel exposes the userStarts seam (onStartDrag / getPassStarts)').toBe(true);
  expect(Math.abs(drag.after0.x - 33) < 1 && Math.abs(drag.after0.y - 44) < 1, 'the SIM-ONLY drag moves the preview first-start marker (userStarts beats the hint)').toBe(true);
  expect(afterCode, 'THE INVARIANT — the sim-only first-start drag leaves the EMIT BYTE-IDENTICAL (Option-B: never emitted)').toBe(beforeCode);
  expect(beforeCode.length, 'sanity: there was real emitted code to compare').toBeGreaterThan(100);
});
