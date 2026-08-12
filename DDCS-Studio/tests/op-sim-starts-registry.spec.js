import { test, expect } from '@playwright/test';

// SIM-SIDE DECLARE-NOT-INFER, increment 1: the per-pass start inference moved into ONE shared REGISTRY
// (viz/opSimStarts.js), federated like opSimContext — a pristine BUILT-IN layer (moved verbatim) + a USER_* layer so the
// wizard maker plugs into the same seam. Behaviour-preserving AT THE TIME OF THE MOVE: the registry returned the SAME
// starts as the old per-wizard inferStarts, and each wizard delegated to it.
// t1730 — MiddleWizard/AlignmentWizard/RotaryCenterWizard (the legacy screen classes, and their inferStarts methods)
// were deleted alongside their coded views (WORK-LOG t1730) — the SECOND source this test compared the registry
// against no longer exists, closing the divergence risk permanently rather than merely fixing it (same shape as
// ARCHITECTURE.md's "Six legacy renderers were live... DELETED at t1730"). The registry (viz/opSimStarts.js's
// BUILT_IN) is now the ONE source — this test keeps verifying ITS behavior directly (pass counts + concrete
// coordinate values, locked against independently-known-correct numbers), which is the coverage that still matters.
test.use({ viewport: { width: 1280, height: 900 } });

test('the registry returns the right pass COUNTS + locked coordinate values for each op', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const stock = { x: 100, y: 80, z: 20, shape: 'boss' };
    const cases = [
      ['middle', { featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg', inAxis: 'auto' }],
      ['middle', { featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'pos', inAxis: 'manual' }],
      ['middle', { featureType: 'pocket' }],
      ['alignment', { checkAxis: 'X' }],
      ['rotary_center', { method: 'known' }],
      ['rotary_center', { method: 'fit', retract: 2 }],
    ];
    return cases.map(([op, p]) => ({ op, viaRegistry: opSimStarts(op, p, stock) }));
  });
  // pass counts mirror the macro's reposition() calls
  expect(r[0].viaRegistry.length, 'middle boss-both auto → 2 passes').toBe(2);
  expect(r[1].viaRegistry.length, 'middle boss-both manual-in-axis → 4 passes').toBe(4);
  expect(r[2].viaRegistry.length, 'pocket → 1 pass').toBe(1);
  expect(r[3].viaRegistry.length, 'alignment A→B → 2 passes').toBe(2);
  expect(r[4].viaRegistry.length, 'rotary_center known → 1 pass').toBe(1);
  expect(r[5].viaRegistry.length, 'rotary_center fit → 3 passes').toBe(3);
  // concrete values locked (dist unset → 20 → outset 12; probeZ −5): ① outside −X, ② at the AUTO trans-traverse #21/#22
  // LANDING (t963 B1 — centre + diagTravel, dir2:neg → +50 → Y=90; was the independent edge+outset guess Y=92). The landing
  // is verified against the ACTUAL emitted #21/#22 in middle-repos-landing-963.
  expect(r[0].viaRegistry, 'middle boss-both auto values').toEqual([{ x: -12, y: 40, z: -5 }, { x: 50, y: 90, z: -5 }]);
});

test('the USER_* layer: a custom op registers a DECLARED sim-start provider (the wizard-maker seam)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { opSimStarts, setUserSimStarts } = await import('/viz/opSimStarts.js');
    const before = opSimStarts('user_demo', {}, {});                                   // unregistered → null
    setUserSimStarts('user_demo', () => [{ x: 1, y: 2, z: 0 }, { x: 3, y: 4, z: 0 }]);  // a custom op declares its starts
    const after = opSimStarts('user_demo', {}, {});
    setUserSimStarts('user_demo', null);                                               // cleared on delete
    const cleared = opSimStarts('user_demo', {}, {});
    const builtin = opSimStarts('middle', { featureType: 'pocket' }, { x: 100, y: 80, z: 20 });   // built-ins unaffected
    return { before, after, cleared, builtinLen: builtin.length };
  });
  expect(r.before, 'unregistered → null (caller falls back to a single start)').toBeNull();
  expect(r.after, 'declared provider drives the per-pass starts').toEqual([{ x: 1, y: 2, z: 0 }, { x: 3, y: 4, z: 0 }]);
  expect(r.cleared, 'clearing removes the provider').toBeNull();
  expect(r.builtinLen, 'built-ins unaffected by the user layer').toBe(1);
});
