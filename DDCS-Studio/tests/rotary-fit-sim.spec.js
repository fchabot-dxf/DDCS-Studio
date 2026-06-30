import { test, expect } from '@playwright/test';

// ROTARY 3-point FIT — the sim now solves the TRUE OD (t141-145). Two coordinated sim fixes made it real: (1) the engine
// populates the machine DRO so read-machine returns the real coord (t143, e7af3af); (2) the opSimStarts fit-start P2/P3 sides
// match the macro's probe dirs (t145 — P2 probes +Y → start the -Y side; P3 probes -Y → start the +Y side). With both, the
// fit probes 3 DISTINCT points on the stock OD and the circle-solve fits R≈R_true. Was degenerate (collapsed → R~0/120/161).
test('rotary 3-point fit sim solves the TRUE OD (swapped fit-start sides + real DRO)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const { RotaryCenterWizard } = await import('/wizards/rotaryCenterWizard.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const stock = { x: 150, y: 76.2, z: 76.2, shape: 'cylinder', show: true };   // Ø76.2 bar → true OD radius 38.1
    const w = new RotaryCenterWizard();
    const p = { method: 'fit', dist: 30, safeZ: 15, datum: 'center' };
    const starts = opSimStarts('rotary_center', p, stock);
    const e = new GcodeExecutionEngine({ autoAnswer: true, stock, stockOffset: starts[0] });
    e._passStarts = starts;                       // the real-preview wiring; the DRO is now populated (default store)
    e.trace(w.generate(p));
    return { nStarts: starts.length, p2y: +starts[1].y.toFixed(1), p3y: +starts[2].y.toFixed(1), R: +e.vars.get(55).toFixed(2), Yc: +e.vars.get(54).toFixed(2), Zc: +e.vars.get(56).toFixed(2) };
  });
  // 3 passes; the sides match the macro's probe dirs: P2 (probes +Y) on the -Y side, P3 (probes -Y) on the +Y side
  expect(r.nStarts, '3 fit passes (top + 2 flanks)').toBe(3);
  expect(r.p2y, 'P2 (macro probes +Y) starts on the -Y side (was swapped)').toBeLessThan(0);
  expect(r.p3y, 'P3 (macro probes -Y) starts on the +Y side (was swapped)').toBeGreaterThan(76);
  // the fit now solves the TRUE OD (R≈38.1, centre on the bar centreline) — was the degenerate collapse
  expect(r.R, 'fit R ≈ the true OD radius 38.1').toBeGreaterThan(36);
  expect(r.R, 'fit R ≈ the true OD radius 38.1 (not the degenerate 120/161)').toBeLessThan(40);
  expect(r.Yc, 'centre Y on the bar centreline').toBeCloseTo(38.1, 0);
  expect(r.Zc, 'centre Z at the bar centreline (top-at-0 frame ≈ -R)').toBeLessThan(-35);
});
