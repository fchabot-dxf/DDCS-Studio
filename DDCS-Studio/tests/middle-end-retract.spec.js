import { test, expect } from '@playwright/test';

/**
 * End-of-path: after the last probe the tool used to end OFFSET at the last wall (the net incremental XY drift), Z-lifted
 * but beside the feature — so the real tool AND the 3D spindle (which follows the engine) rested in an awkward offset spot.
 * The clean end-retract returns the tool to the MEASURED centre (#53/#56, machine frame) before the end, so it ends OVER
 * the feature. Verified by simming the REAL macro and reading the engine's FINAL position (e.pos) — where the tool stops.
 */
test.use({ viewport: { width: 1000, height: 800 } });

async function runEnd(page, p, stock) {
  return page.evaluate(async (a) => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const w = new MiddleWizard();
    const e = new GcodeExecutionEngine({ autoAnswer: true, stock: a.stock, stockOffset: w.inferStart(a.p, a.stock) });
    const t = e.trace(w.generate(a.p));
    return { capped: t.stats.capped, c53: e.vars.get(53), c56: e.vars.get(56), posX: e.pos.x, posY: e.pos.y };
  }, { p, stock });
}

const base = { axis: 'X', dir1: 'pos', dir2: 'neg', retract: 2, safeZ: 10 };

test('boss-both ENDS over the feature centre (not offset at the last wall)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const r = await runEnd(page,
    { ...base, featureType: 'boss', twoAxis: true, transAxis: 'auto', dist: 80, clearOver: 40, diagTravel: 50 },
    { x: 60, y: 60, z: 60, shape: 'boss', show: true });
  expect(r.capped, 'macro completes').toBe(false);
  expect(r.c53, 'X centre ≈ 30 (60-wide boss)').toBeCloseTo(30, 0);
  // THE FIX: the tool's FINAL position is the measured centre #53/#56 — NOT the last wall (which is 0 or 60, far from 30)
  expect(r.posX, 'final X = the measured centre #53 (over the feature)').toBeCloseTo(r.c53, 1);
  expect(r.posY, 'final Y = the measured centre #56 (over the feature, not the offset Y wall)').toBeCloseTo(r.c56, 1);
});

test('single-axis boss ENDS centred in the probed axis', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const r = await runEnd(page,
    { ...base, featureType: 'boss', twoAxis: false, dist: 80, clearOver: 40 },
    { x: 60, y: 60, z: 60, shape: 'boss', show: true });
  expect(r.capped).toBe(false);
  expect(r.c53).toBeCloseTo(30, 0);
  expect(r.posX, 'final X = the measured centre #53, not the last wall').toBeCloseTo(r.c53, 1);
});

test('pocket-both ENDS over the cavity centre', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const r = await runEnd(page,
    { ...base, featureType: 'pocket', twoAxis: true, dist: 40 },
    { x: 100, y: 80, z: 20, shape: 'pocket', show: true });
  expect(r.capped).toBe(false);
  expect(r.c53, 'pocket X centre ≈ 50').toBeCloseTo(50, 0);
  expect(r.posX, 'final X = cavity centre #53').toBeCloseTo(r.c53, 1);
  expect(r.posY, 'final Y = cavity centre #56 (not the offset wall)').toBeCloseTo(r.c56, 1);
});
