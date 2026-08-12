import { test, expect } from '@playwright/test';

// BOSS CROSS-OVER TRAVERSE DISTANCE (per axis). The in-axis wall1→wall2 cross-over is the straight TRAVERSE that spans
// the feature. It used to DEFAULT to [#1+#2] (max probe + retract) — conflating the probe REACH with the traverse
// distance (they're different). Now DECOUPLED: a clean declared per-axis number — #19 (X) / #20 (Y) — that DEFAULTS to a
// feature-independent 80 (a moderate feature; the user tunes it to span their feature ≈ width + 2×approach).
test('boss probe-both cross-over is per-axis #19/#20, a clean declared 80 (decoupled from max-probe), overridable', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    // t1730 — MiddleWizard (the legacy screen class) was deleted alongside its view; middleStack is the surviving
    // builder — emit its block stack through the SAME mapper the app uses (emitMapped) for G-code text.
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const gen = (p) => emitMapped(middleStack(p)).text;
    const base = { featureType: 'boss', approach: 'auto', findBoth: true, axis: 'X', dir1: 'pos', dir2: 'neg' };
    return {
      def: gen(base),                                  // default cross-over
      over: gen({ ...base, crossX: '130', crossY: '70' }),   // explicit raw distances
      manual: gen({ ...base, approach: 'manual' }),    // manual boss = reposition, no traverseOver
      pocket: gen({ featureType: 'pocket', approach: 'auto', findBoth: true, axis: 'X', dir1: 'pos' }),
    };
  });

  // default boss-auto: the cross-over vars prefill to a clean declared 80 (decoupled from max-probe — NOT [#1+#2])
  expect(r.def, '#19 (X cross-over) defaults to a clean 80').toMatch(/#19\s*=\s*80\b/);
  expect(r.def, '#20 (Y cross-over) defaults to 80').toMatch(/#20\s*=\s*80\b/);
  expect(r.def, 'the default is no longer the max-probe expression [#1+#2]').not.toMatch(/#19\s*=\s*\[#1\+#2\]/);
  // ... and the lateral cross moves use the vars, not a hard-coded distance
  expect(r.def, 'X cross uses #19').toMatch(/X#19|X\[0-#19\]/);
  expect(r.def, 'Y cross uses #20').toMatch(/Y#20|Y\[0-#20\]/);
  expect(r.def, 'no hard-coded [#1+#2] lateral move remains').not.toMatch(/[XY]\[#1\+#2\]/);

  // explicit raw distances flow into the vars (a feature wider than MAX PROBE)
  expect(r.over, 'explicit X cross-over').toMatch(/#19\s*=\s*130/);
  expect(r.over, 'explicit Y cross-over').toMatch(/#20\s*=\s*70/);

  // manual boss (operator jogs — no traverseOver) and pocket (reaches both walls from the centre) emit no cross-over vars
  expect(r.manual, 'manual boss has no cross-over vars').not.toMatch(/#19\s*=/);
  expect(r.pocket, 'pocket unchanged — no cross-over vars').not.toMatch(/#19\s*=/);

  // round-trip: the cross-over params survive the marker codec (declare → re-import), so the Blocks view + reverse-sync
  // carry them (they're in SCHEMA + FIELD_BIND, like clearOver). String type keeps the [#1+#2] expression intact.
  const rt = await page.evaluate(async () => {
    const { markerLine, parseMarker } = await import('/blocks/opSchema.js');
    return parseMarker(markerLine('middle', { featureType: 'boss', crossX: '130', crossY: '[#1+#2]' })).params;
  });
  expect(rt.crossX, 'crossX (number) round-trips').toBe('130');
  expect(rt.crossY, 'crossY (expression) round-trips intact').toBe('[#1+#2]');
});

// SURFACE (declare-not-infer): a block-edited cross-over distance reverse-syncs from #19/#20 back into the form fields,
// like #21 → m_diag_travel. So the X/Y CROSS-OVER fields stay the single source of the declared traverse distance.
test('the cross-over distance reverse-syncs from #19/#20 into m_crossX/m_crossY', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const back = await page.evaluate(async () => {
    const ops = await import('/blocks/opSession.js');
    const rec = await import('/blocks/opRecord.js');
    rec.recordOp('middle', { featureType: 'boss', findBoth: true, inAxis: 'auto', transAxis: 'auto', crossX: '120', crossY: '90', axis: 'X', dir1: 'pos', dir2: 'neg' });
    window.ddcsLoadBlockStack(ops.buildActiveOpStack().blocks);
    return ops.reconcileActiveOp();
  });
  expect(back.fields.m_crossX, 'X cross-over reverse-synced from #19').toBe('120');
  expect(back.fields.m_crossY, 'Y cross-over reverse-synced from #20').toBe('90');
});

// The real symptom: a boss WIDER than MAX PROBE. With the old [#1+#2] cross-over the probe could never reach the far
// wall (MAX PROBE 40 < the 120-wide feature); an explicit cross-over reaches it. (Single-axis: a 2-axis boss needs the
// operator's between-axes jog, which the sim's auto-answer can't model — see middle-center-sim, which is also 1-axis.)
test('a boss wider than MAX PROBE is centre-found via the explicit cross-over distance', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const run = async (a) => page.evaluate(async (a) => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    // t1730 — MiddleWizard (the legacy screen class) was deleted alongside its view; middleStack/opSimStarts are
    // the surviving builder + start-inference registry.
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const stock = { x: 120, y: 60, z: 40, shape: 'boss', show: true };   // 120-wide boss → X centre = 60
    const p = { featureType: 'boss', approach: 'auto', axis: 'X', dir1: 'pos',
                dist: 40, retract: 2, safeZ: 10, clearOver: 50, ...a };   // MAX PROBE 40 << the 120-wide feature
    const e = new GcodeExecutionEngine({ autoAnswer: true, stock, stockOffset: opSimStarts('middle', p, stock)[0] });
    const t = e.trace(emitMapped(middleStack(p)).text);
    return { capped: t.stats.capped, cx: e.vars.get(53), v19: e.vars.get(19) };
  }, a);

  // explicit 130mm cross-over → the probe reaches the far X wall → centre X = 60, even though MAX PROBE is only 40
  const big = await run({ crossX: 130 });
  expect(big.v19, 'X cross-over var = 130').toBe(130);
  expect(big.cx, 'centre X = 60 via the explicit cross-over').toBeCloseTo(60, 0);

  // the DEFAULT cross-over ([#1+#2] = 42) can NOT span the 120-wide feature → it does NOT find the true centre 60
  const def = await run({});
  expect(Math.abs(def.cx - 60), 'default [#1+#2] cross-over falls short on a feature wider than MAX PROBE').toBeGreaterThan(5);
});
