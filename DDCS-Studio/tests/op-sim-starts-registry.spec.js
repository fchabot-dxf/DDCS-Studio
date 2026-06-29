import { test, expect } from '@playwright/test';

// SIM-SIDE DECLARE-NOT-INFER, increment 1: the per-pass start inference moved into ONE shared REGISTRY
// (viz/opSimStarts.js), federated like opSimContext — a pristine BUILT-IN layer (moved verbatim) + a USER_* layer so the
// wizard maker plugs into the same seam. Behaviour-preserving: the registry returns the SAME starts as the old per-wizard
// inferStarts, and each wizard now DELEGATES to it.
test.use({ viewport: { width: 1280, height: 900 } });

test('registry returns the SAME starts as each wizard inferStarts + the right pass COUNTS', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const { AlignmentWizard } = await import('/wizards/alignmentWizard.js');
    const { RotaryCenterWizard } = await import('/wizards/rotaryCenterWizard.js');
    const m = new MiddleWizard(), a = new AlignmentWizard(), rc = new RotaryCenterWizard();
    const stock = { x: 100, y: 80, z: 20, shape: 'boss' };
    const cases = [
      ['middle', m, { featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg', inAxis: 'auto' }],
      ['middle', m, { featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'pos', inAxis: 'manual' }],
      ['middle', m, { featureType: 'pocket' }],
      ['alignment', a, { checkAxis: 'X' }],
      ['rotary_center', rc, { method: 'known' }],
      ['rotary_center', rc, { method: 'fit', retract: 2 }],
    ];
    return cases.map(([op, wiz, p]) => ({ op, viaRegistry: opSimStarts(op, p, stock), viaWizard: wiz.inferStarts(p, stock) }));
  });
  // the wizard delegates to the registry → identical for every op + param set
  for (const c of r) expect(c.viaRegistry, `${c.op}: registry === wizard.inferStarts`).toEqual(c.viaWizard);
  // pass counts mirror the macro's reposition() calls
  expect(r[0].viaRegistry.length, 'middle boss-both auto → 2 passes').toBe(2);
  expect(r[1].viaRegistry.length, 'middle boss-both manual-in-axis → 4 passes').toBe(4);
  expect(r[2].viaRegistry.length, 'pocket → 1 pass').toBe(1);
  expect(r[3].viaRegistry.length, 'alignment A→B → 2 passes').toBe(2);
  expect(r[4].viaRegistry.length, 'rotary_center known → 1 pass').toBe(1);
  expect(r[5].viaRegistry.length, 'rotary_center fit → 3 passes').toBe(3);
  // concrete values locked (dist unset → 20 → outset 12; probeZ −5): ① outside −X, ② outside +Y (dir2=neg)
  expect(r[0].viaRegistry, 'middle boss-both auto values').toEqual([{ x: -12, y: 40, z: -5 }, { x: 50, y: 92, z: -5 }]);
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
