import { test, expect } from './support/harness.mjs';

/**
 * ③ stock-datum drag handles — the EMITTING Z-first start handle (#21/#22 = startX/startY) + the SIM-ONLY first-start.
 * Handle model (human-confirmed, 2 off / 3 on): [first-start = SIM-ONLY (userStarts, never emits)] + [wall-1 = EMITTING
 * #21/#22, probeZFirst-only] + [wall-2 = EMITTING #23/#24, done in 4a]. Option A: the sim-only override reuses the existing
 * createPreviewPanel.userStarts seam (read compositionally via computePassStarts); the emitting #21-#24 stay on the FeatureCanvas.
 *
 * (4a) the EMITTING handles write the correct datum-relative value vs an INDEPENDENT truth (the non-degenerate default
 *      expressions + a bound literal), the start handle anchors to the zsurf pass, and it is GATED on probeZFirst.
 *
 * t2693 — TIER MIGRATION BATCH 4: moved browser→node. ONLY this first test moved — it's pure import()+evaluate
 * (registerUserOp + builderOf + opSimStarts, no DOM). The file's second test ("(4a gate + 4b)... the SIM-ONLY
 * first-start drag") opens a real wizard (window.openWiz), waits on a real DOM selector, and reads a live
 * `.wiz-viz3d`'s `__panel` instance to call `onStartDrag`/`getPassStarts` on the actual rendered 3D preview —
 * a genuine app+DOM+render dependency, not a candidate for this tier. Split into
 * tests/corner-data-start-live-drag.spec.js, left in the browser tier.
 */
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
