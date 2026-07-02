import { test, expect } from '@playwright/test';

/**
 * ② B4 step 4a — probeZFirst goes LIVE on the "Corner (data)" twin. The twin SEEDs cornerStack in SUPERSET mode (both arms
 * of the probeZFirst fork present, each wrapped in a `guard`); `instantiate()` prunes the guarded superset to the chosen
 * shape. This is the load-bearing ASSERT-THE-VALUE gate (not "a change happened"):
 *   (1) OFF emit == cornerStack({probeZ:false}) BYTE-FOR-BYTE, ON emit == cornerStack({probeZ:true}) BYTE-FOR-BYTE — full
 *       byte incl. the KIND-B comment variants (OVER/OUTSIDE, "+ Z Surface", Step numbers), NOT stripAnnotations.
 *   (2) the REAL toggle symptom: flipping probeZFirst ADDS the Z-surface step + Z→wall1 reposition + flips the prompt/labels.
 *   (3) the preview shows 3 ALIGNED markers under Z (2 without), and the semantic relTo anchors the reposition drag to the
 *       SAME wall-1 pass in BOTH states (resolveRelToIndex maps {row:'wall1'} past the zsurf row's +1 shift).
 *   (4) probeZFirst is a real BOOL binding (drives the form toggle + the marker schema).
 */
test('probeZFirst LIVE: OFF/ON emit == cornerStack byte-for-byte; toggle adds the Z shape; markers + semantic relTo anchor', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { opSimStarts, resolveRelToIndex } = await import('/viz/opSimStarts.js');

    const def = CD.cornerDataDef();
    registerUserOp(def);
    const build = builderOf(CD.CORNER_DATA_OPTYPE);
    const S = (o) => ({ ...CD.CORNER_DEFAULTS, ...o });
    const stock = { x: 100, y: 80, z: 20 };

    const offTwin = emitMapped(build(S({}))).text;
    const onTwin  = emitMapped(build(S({ probeZFirst: 1 }))).text;
    const offRef  = emitMapped(cornerStack(S({}))).text;
    const onRef   = emitMapped(cornerStack(S({ probeZFirst: 1 }))).text;

    // (3) sim-starts + the semantic anchor (both probeZ states)
    const offStarts = opSimStarts(CD.CORNER_DATA_OPTYPE, S({}), stock);
    const onStarts  = opSimStarts(CD.CORNER_DATA_OPTYPE, S({ probeZFirst: 1 }), stock);
    const offAnchorIdx = resolveRelToIndex(CD.CORNER_DATA_OPTYPE, S({}), { row: 'wall1' });
    const onAnchorIdx  = resolveRelToIndex(CD.CORNER_DATA_OPTYPE, S({ probeZFirst: 1 }), { row: 'wall1' });
    const offAnchor = offStarts[offAnchorIdx];
    const onAnchor  = onStarts[onAnchorIdx];

    // (4) the structural bool binding
    const zBind = (def.bindings || []).find((b) => b.param === 'probeZFirst');

    return {
      offByteEqual: offTwin === offRef,
      onByteEqual:  onTwin === onRef,
      // real toggle symptom — ON-only lines
      onHasZSurfaceHeader: /\+ Z Surface/.test(onTwin),
      onHasHoverOver: /Hover OVER the FL corner/.test(onTwin),
      onHasZReposition: /REPOSITION: Traverse to first wall/.test(onTwin),
      onHasStepShift: /Step 2: Y Probe/.test(onTwin),
      offHasZSurfaceHeader: /\+ Z Surface/.test(offTwin),
      offHasHoverOutside: /Hover OUTSIDE the FL corner/.test(offTwin),
      offHasZReposition: /REPOSITION: Traverse to first wall/.test(offTwin),
      offHasStep1: /Step 1: Y Probe/.test(offTwin),
      // markers + anchor
      offStartsLen: offStarts.length, onStartsLen: onStarts.length,
      offAnchorIdx, onAnchorIdx,
      anchorSamePoint: !!offAnchor && !!onAnchor && Math.abs(offAnchor.x - onAnchor.x) < 1e-6 && Math.abs(offAnchor.y - onAnchor.y) < 1e-6,
      zBindType: zBind && zBind.type, zBindDefault: zBind && zBind.default,
    };
  });

  // (1) byte-for-byte parity in BOTH states — the load-bearing assert
  expect(r.offByteEqual, 'probeZFirst OFF: twin emit == cornerStack({probeZ:false}) byte-for-byte').toBe(true);
  expect(r.onByteEqual, 'probeZFirst ON: twin emit == cornerStack({probeZ:true}) byte-for-byte (Z-surface shape + KIND-B text)').toBe(true);
  // (2) the toggle actually FLIPS the shape — ON has the Z lines, OFF does not (and OFF keeps its own variants)
  expect(r.onHasZSurfaceHeader && r.onHasHoverOver && r.onHasZReposition && r.onHasStepShift, 'ON adds the Z-surface header, the Hover-OVER prompt, the Z→wall1 REPOSITION, and shifts the step labels').toBe(true);
  expect(r.offHasZSurfaceHeader, 'OFF has no "+ Z Surface" header').toBe(false);
  expect(r.offHasZReposition, 'OFF has no Z→wall1 REPOSITION traverse').toBe(false);
  expect(r.offHasHoverOutside && r.offHasStep1, 'OFF keeps the Hover-OUTSIDE prompt + Step-1 labels').toBe(true);
  // (3) preview markers align with the passes, and the reposition anchor tracks wall-1 in BOTH states
  expect(r.offStartsLen, 'no-Z: 2 markers (wall-1, wall-2)').toBe(2);
  expect(r.onStartsLen, 'Z-first: 3 markers (zsurf, wall-1, wall-2)').toBe(3);
  expect(r.offAnchorIdx, 'semantic relTo {row:wall1} → filtered index 0 when Z off').toBe(0);
  expect(r.onAnchorIdx, 'semantic relTo {row:wall1} → filtered index 1 when Z on (zsurf shifts it)').toBe(1);
  expect(r.anchorSamePoint, 'the reposition drag anchors to the SAME wall-1 point regardless of probeZFirst (the semantic-relTo fix)').toBe(true);
  // (4) the structural toggle is a declared bool binding
  expect(r.zBindType, 'probeZFirst is a bool binding (drives the form toggle + guard prune)').toBe('bool');
  expect(r.zBindDefault, 'probeZFirst defaults OFF (the twin ships the no-Z shape)').toBe(false);
});
