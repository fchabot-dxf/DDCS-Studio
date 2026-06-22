import { test, expect } from '@playwright/test';

// The middle (centre-finding) probe, simulated against a real stock, recovers the TRUE centre in AUTO mode:
//  • pocket: probe both cavity walls from the centre (100×80 pocket, walls at 20/80 → centre 50);
//  • boss:   cross over the part hands-free and probe both outside faces (60-wide boss, faces 0/60 → centre 30).
// The traverse-over height is an explicit field (#18), so a tall boss can be cleared.
test.use({ viewport: { width: 1000, height: 800 } });

async function runMiddle(page, featureType, approach, stock, dist, clearOver) {
  return page.evaluate(async (a) => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const w = new MiddleWizard();
    const p = { featureType: a.featureType, approach: a.approach, axis: 'X', dir1: 'pos', dist: a.dist, retract: 2, safeZ: 10, clearOver: a.clearOver };
    const e = new GcodeExecutionEngine({ autoAnswer: true, stock: a.stock, stockOffset: w.inferStart(p, a.stock) });
    const t = e.trace(w.generate(p));
    return { capped: t.stats.capped, center: e.vars.get(53), clear: e.vars.get(18) };
  }, { featureType, approach, stock, dist, clearOver });
}

test('pocket auto finds the cavity centre', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const r = await runMiddle(page, 'pocket', 'auto', { x: 100, y: 80, z: 20, shape: 'pocket', show: true }, 40, 15);
  expect(r.capped).toBe(false);
  expect(r.center, 'pocket centre X = 50').toBeCloseTo(50, 1);
});

test('boss auto crosses over and finds the centre, honouring the traverse height', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const r = await runMiddle(page, 'boss', 'auto', { x: 60, y: 60, z: 60, shape: 'boss', show: true }, 80, 40);
  expect(r.capped).toBe(false);
  expect(r.center, 'boss centre X = 30').toBeCloseTo(30, 1);
  expect(r.clear, 'the traverse-over height (#18) is the value the operator set').toBeCloseTo(40, 1);
});
