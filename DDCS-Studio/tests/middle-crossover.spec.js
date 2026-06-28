import { test, expect } from '@playwright/test';

// BOSS CROSS-OVER MOVE DISTANCE (per axis). The boss "probe both" wall1→wall2 cross-over used to be a hard-coded
// [#1+#2] (max probe + retract), so the probe only reached the far wall if MAX PROBE happened to span the feature.
// Now it's a per-axis distance — #19 (X cross-over) / #20 (Y cross-over) — that DEFAULTS to [#1+#2] (back-compat) and
// is overridable with a raw number for a feature wider than MAX PROBE.
test('boss probe-both cross-over is per-axis #19/#20, defaults to [#1+#2], overridable; pocket unaffected', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const w = new MiddleWizard();
    const base = { featureType: 'boss', approach: 'auto', findBoth: true, axis: 'X', dir1: 'pos', dir2: 'neg' };
    return {
      def: w.generate(base),                                  // default cross-over
      over: w.generate({ ...base, crossX: '130', crossY: '70' }),   // explicit raw distances
      manual: w.generate({ ...base, approach: 'manual' }),    // manual boss = reposition, no traverseOver
      pocket: w.generate({ featureType: 'pocket', approach: 'auto', findBoth: true, axis: 'X', dir1: 'pos' }),
    };
  });

  // default boss-auto: the cross-over vars prefill to [#1+#2] (byte-behaviour of the old hard-coded move)
  expect(r.def, '#19 (X cross-over) defaults to [#1+#2]').toMatch(/#19\s*=\s*\[#1\+#2\]/);
  expect(r.def, '#20 (Y cross-over) defaults to [#1+#2]').toMatch(/#20\s*=\s*\[#1\+#2\]/);
  // ... and the lateral cross moves use the vars, not a hard-coded [#1+#2]
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

// The real symptom: a boss WIDER than MAX PROBE. With the old [#1+#2] cross-over the probe could never reach the far
// wall (MAX PROBE 40 < the 120-wide feature); an explicit cross-over reaches it. (Single-axis: a 2-axis boss needs the
// operator's between-axes jog, which the sim's auto-answer can't model — see middle-center-sim, which is also 1-axis.)
test('a boss wider than MAX PROBE is centre-found via the explicit cross-over distance', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const run = async (a) => page.evaluate(async (a) => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const w = new MiddleWizard();
    const stock = { x: 120, y: 60, z: 40, shape: 'boss', show: true };   // 120-wide boss → X centre = 60
    const p = { featureType: 'boss', approach: 'auto', axis: 'X', dir1: 'pos',
                dist: 40, retract: 2, safeZ: 10, clearOver: 50, ...a };   // MAX PROBE 40 << the 120-wide feature
    const e = new GcodeExecutionEngine({ autoAnswer: true, stock, stockOffset: w.inferStart(p, stock) });
    const t = e.trace(w.generate(p));
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
