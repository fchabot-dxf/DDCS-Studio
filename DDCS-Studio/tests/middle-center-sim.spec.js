import { test, expect } from '@playwright/test';

// The middle (centre-finding) probe, simulated against a real stock, recovers the TRUE centre in AUTO mode:
//  • pocket: probe both cavity walls from the centre (100×80 pocket, walls at 20/80 → centre 50);
//  • boss:   cross over the part hands-free and probe both outside faces (60-wide boss, faces 0/60 → centre 30).
// t923 — the explicit traverse-over height (#18) is RETIRED: the in-axis cross-over now follows the CLEARANCE MODE (Max = the
// machine margin), so a tall boss clears via the safe margin rather than an operator-set number. The centre-finding is unchanged.
test.use({ viewport: { width: 1000, height: 800 } });

async function runMiddle(page, featureType, approach, stock, dist) {
  return page.evaluate(async (a) => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const w = new MiddleWizard();
    const p = { featureType: a.featureType, approach: a.approach, axis: 'X', dir1: 'pos', dist: a.dist, retract: 2 };
    const e = new GcodeExecutionEngine({ autoAnswer: true, stock: a.stock, stockOffset: w.inferStart(p, a.stock) });
    const t = e.trace(w.generate(p));
    return { capped: t.stats.capped, center: e.vars.get(53), gcode: w.generate(p) };
  }, { featureType, approach, stock, dist });
}

test('pocket auto finds the cavity centre', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const r = await runMiddle(page, 'pocket', 'auto', { x: 100, y: 80, z: 20, shape: 'pocket', show: true }, 40);
  expect(r.capped).toBe(false);
  expect(r.center, 'pocket centre X = 50').toBeCloseTo(50, 1);
});

test('boss auto crosses over and finds the centre (Max clearance — #18 traverse-height retired)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const r = await runMiddle(page, 'boss', 'auto', { x: 60, y: 60, z: 60, shape: 'boss', show: true }, 80);
  expect(r.capped).toBe(false);
  expect(r.center, 'boss centre X = 30').toBeCloseTo(30, 1);
  // t923 — the in-axis cross-over now clears to the MACHINE MARGIN (Max), not the retired relative G0 Z#18; and it crosses via #19
  expect(r.gcode, 'the cross-over clears to the machine margin (no relative Z#18)').not.toMatch(/G0 Z#18\b/);
  expect(r.gcode, 'the cross-over still crosses the feature via the #19/#20 distance').toMatch(/G0 X#19/);
});
