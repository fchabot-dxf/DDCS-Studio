import { test, expect } from '@playwright/test';

// The CIRCULAR toggle on the MIDDLE (centre-finding) probe absorbs the standalone circular wizard:
//  • it still finds the centre (re-centring to the found X centre before the perpendicular probes), and
//  • it reports the DIAMETER (the opposite-touch span) — #58 primary Ø, #59 secondary Ø, #60 the mean.
// Modelled like the existing middle sim: a 100×80 `pocket` cavity (engine insets it by 20) → X walls 20/80
// (centre 50, Ø 60), Y walls 20/60 (centre 40, Ø 40). The op also round-trips via BUILDERS.middle + reconcile
// (the new `circular` field reverse-syncs).
test.use({ viewport: { width: 1000, height: 800 } });

test('circular bore middle: finds the centre AND a sensible diameter in the sim', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);

  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    // t1730 — MiddleWizard (the legacy screen class) was deleted alongside its view; middleStack/opSimStarts are
    // the surviving builder + start-inference registry.
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const stock = { x: 100, y: 80, z: 20, shape: 'pocket', show: true };
    const p = { featureType: 'pocket', circular: true, approach: 'auto', axis: 'X', dir1: 'pos', findBoth: true, dist: 40, retract: 2, safeZ: 10 };
    const start = opSimStarts('middle', p, stock)[0];
    // wcsOffset = the machine coord of part-zero (= where the stock origin sits) so the macro's machine-frame
    // re-centre (G53 X#53, #53 being a machine-coord centre) maps back into the part frame the probes use.
    const e = new GcodeExecutionEngine({ autoAnswer: true, stock, stockOffset: start, wcsOffset: start });
    const t = e.trace(emitMapped(middleStack(p)).text);
    return {
      capped: t.stats.capped,
      cx: e.vars.get(53), cy: e.vars.get(56),
      dx: e.vars.get(58), dy: e.vars.get(59), dMean: e.vars.get(60),
    };
  });

  expect(r.capped, 'no probe ran out of travel').toBe(false);
  expect(r.cx, 'X centre = 50').toBeCloseTo(50, 1);
  expect(r.cy, 'Y centre = 40 (re-centred to the X centre first)').toBeCloseTo(40, 1);
  expect(r.dx, 'X diameter = span of the X walls (80-20)').toBeCloseTo(60, 1);
  expect(r.dy, 'Y diameter = span of the Y walls (60-20)').toBeCloseTo(40, 1);
  expect(r.dMean, 'mean diameter = (60+40)/2').toBeCloseTo(50, 1);
});

test('circular middle op round-trips: BUILDERS.middle → reconcile recovers the circular field', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const back = await page.evaluate(async () => {
    const ops = await import('/blocks/opSession.js');
    const rec = await import('/blocks/opRecord.js');
    const params = { featureType: 'pocket', circular: true, approach: 'auto', axis: 'X', dir1: 'pos', findBoth: true, dir2: 'neg', wcs: 'G55' };
    // Drive the reconciler the way the app does: record the op, build its op-stack (via BUILDERS.middle = the
    // middleStack builder) into the program, then reverse-sync the block program back to form fields.
    rec.recordOp('middle', params);
    const built = ops.buildActiveOpStack();          // sets shownOp = 'middle' and returns [progstart, op, progend]
    window.ddcsLoadBlockStack(built.blocks);
    return ops.reconcileActiveOp();                   // read the block program back → form fields
  });

  expect(back, 'reconciler ran for the middle op').not.toBeNull();
  expect(back.type).toBe('middle');
  expect(back.fields.m_circular, 'circular field reverse-synced').toBe(true);
  expect(back.fields.m_both, '2-axis reverse-synced').toBe(true);
  expect(back.fields.m_axis, 'primary axis reverse-synced').toBe('X');
  expect(back.fields.m_dir2, 'secondary direction reverse-synced').toBe('neg');
  expect(back.fields.m_wcs, 'WCS reverse-synced from the #70 literal').toBe('G55');
});
