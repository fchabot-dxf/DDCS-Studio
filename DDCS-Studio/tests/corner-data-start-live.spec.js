import { test, expect } from '@playwright/test';

/**
 * ③ stock-datum drag handles — the EMITTING Z-first start handle (#21/#22 = startX/startY) + the SIM-ONLY first-start.
 * Handle model (human-confirmed, 2 off / 3 on): [first-start = SIM-ONLY (userStarts, never emits)] + [wall-1 = EMITTING
 * #21/#22, probeZFirst-only] + [wall-2 = EMITTING #23/#24, done in 4a]. Option A: the sim-only override reuses the existing
 * createPreviewPanel.userStarts seam (read compositionally via computePassStarts); the emitting #21-#24 stay on the FeatureCanvas.
 *
 * (4a) the EMITTING handles write the correct datum-relative value vs an INDEPENDENT truth (the non-degenerate default
 *      expressions + a bound literal), the start handle anchors to the zsurf pass, and it is GATED on probeZFirst.
 * (4b) THE CRITICAL — dragging the SIM-ONLY first-start (userStarts) CHANGES the preview but leaves the EMIT BYTE-IDENTICAL.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('③(4a) EMITTING start handle: startX/startY wiring + non-degenerate default + bound datum-relative value + zsurf anchor', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
    const { opSimStarts, resolveRelToIndex } = await import('/viz/opSimStarts.js');

    const def = CD.cornerDataDef();
    registerUserOp(def);
    const build = builderOf(CD.CORNER_DATA_OPTYPE);
    const S = (o) => ({ ...CD.CORNER_DEFAULTS, ...o });
    const stock = { x: 100, y: 80, z: 20 };
    const bind = (p) => (def.bindings || []).find((b) => b.param === p);
    const bx = bind('startX'), by = bind('startY');

    const onDef   = stripAnnotations(emitMapped(build(S({ probeZFirst: 1 }))).text);                          // unset → the expression default
    const onBound = stripAnnotations(emitMapped(build(S({ probeZFirst: 1, startX: 5, startY: 7 }))).text);    // a bound start
    const boundParity = emitMapped(build(S({ probeZFirst: 1, startX: 5, startY: 7 }))).text
                     === emitMapped(cornerStack(S({ probeZFirst: 1, startX: 5, startY: 7 }))).text;

    const anchorIdx = resolveRelToIndex(CD.CORNER_DATA_OPTYPE, S({ probeZFirst: 1 }), bx && bx.relTo);
    const anchor = (opSimStarts(CD.CORNER_DATA_OPTYPE, S({ probeZFirst: 1 }), stock) || [])[anchorIdx];

    return {
      bxGroup: bx && bx.group, bxRole: bx && bx.role, byRole: by && by.role, bxRelTo: bx && bx.relTo, bxWhen: bx && bx.when,
      // INDEPENDENT-TRUTH defaults (FL/YX): X holds (#21=0), the probe/reposition axes carry the signed-travel expression.
      def21: /^#21=0$/m.test(onDef), def22: /^#22=#16$/m.test(onDef), def23: /^#23=#16$/m.test(onDef), def24: /^#24=#15$/m.test(onDef),
      bound21: /^#21=5$/m.test(onBound), bound22: /^#22=7$/m.test(onBound), boundParity,
      anchorIdx, anchorX: anchor && anchor.x, anchorY: anchor && anchor.y,   // zsurf frac = (0.07·100, 0.0875·80) = (7, 7)
    };
  });

  expect(r.bxGroup, 'startX is its own "start" point group (a 2nd handle, distinct from reposition)').toBe('start');
  expect(r.bxRole).toBe('x'); expect(r.byRole).toBe('y');
  expect(r.bxRelTo, 'startX anchors to the zsurf pass (the incremental datum for the Z→wall1 traverse)').toEqual({ row: 'zsurf' });
  expect(r.bxWhen, 'startX is gated on probeZFirst (the socket exists only when Z-first)').toEqual({ param: 'probeZFirst', is: true });
  // non-degenerate default (the B3 0,0 cure): X holds at 0, but the reposition axes carry the signed-travel EXPRESSION → NOT G0 X0 Y0.
  expect(r.def21 && r.def22 && r.def23 && r.def24, 'unset defaults are the non-degenerate expressions: #21=0 #22=#16 #23=#16 #24=#15').toBe(true);
  // a bound start writes the datum-relative literal + stays byte-identical to cornerStack.
  expect(r.bound21 && r.bound22, 'bound startX=5/startY=7 emit #21=5/#22=7 (the datum-relative delta)').toBe(true);
  expect(r.boundParity, 'a bound-start twin emit == cornerStack byte-for-byte').toBe(true);
  // the anchor resolves to the zsurf pass (filtered index 0 under probeZFirst) at its independent frac position.
  expect(r.anchorIdx, 'startX relTo {row:zsurf} → filtered index 0 under probeZFirst').toBe(0);
  expect(Math.abs(r.anchorX - 7) < 0.01 && Math.abs(r.anchorY - 7) < 0.01, 'the start handle anchors to the zsurf marker (7,7) on this stock — datum-relative, not (0,0)').toBe(true);
});

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
  await page.waitForSelector('#wiz_user_form input[type="number"]', { state: 'visible' });

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
    const c = document.getElementById('userViz3dContainer');
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
