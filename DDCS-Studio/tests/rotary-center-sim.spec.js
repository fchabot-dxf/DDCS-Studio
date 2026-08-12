import { test, expect } from '@playwright/test';

// The rotary-centre (known-diameter) macro, simulated against a round cylinder, recovers the TRUE centreline.
// A Ø76.2 (3") bar → centreline Y = 38.1, centreline Z = top − R = −38.1, R = 38.1. Both the hands-free AUTO
// cycle and the MANUAL-JOG (guided) variant run the same motion, so both simulate to the same correct answer.
test.use({ viewport: { width: 1000, height: 800 } });

for (const approach of ['auto', 'guided']) {
  test(`rotary centre (known, ${approach}) measures the true centreline of a Ø76.2 bar`, async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => !!window.ddcsGetSettings);
    const r = await page.evaluate(async (mode) => {
      const { GcodeExecutionEngine } = await import('/engine/index.js');
      // t1730 — RotaryCenterWizard (the legacy screen class) was deleted alongside its view; rotaryCenterStack/
      // opSimStarts are the surviving builder + start-inference registry.
      const { rotaryCenterStack } = await import('/wizards/rotaryCenterWizard.js');
      const { emitMapped } = await import('/blocks/blockEmitter.js');
      const { opSimStarts } = await import('/viz/opSimStarts.js');
      const stock = { x: 150, y: 76.2, z: 76.2, shape: 'cylinder', show: true };
      const p = { method: 'known', diameter: 76.2, dist: 30, safeZ: 15, approach: mode };
      const eng = new GcodeExecutionEngine({ autoAnswer: true, stock, stockOffset: opSimStarts('rotary_center', p, stock)[0] });
      const t = eng.trace(emitMapped(rotaryCenterStack(p)).text);
      return { capped: t.stats.capped, yc: eng.vars.get(54), zc: eng.vars.get(56), R: eng.vars.get(55) };
    }, approach);
    expect(r.capped, 'the macro terminates (no runaway)').toBe(false);
    expect(r.yc, 'Yc = centreline Y (38.1), not an overshoot').toBeCloseTo(38.1, 1);
    expect(r.zc, 'Zc = top − R = −38.1').toBeCloseTo(-38.1, 1);
    expect(r.R, 'R = diameter / 2 = 38.1').toBeCloseTo(38.1, 1);
  });
}
