import { test, expect } from '@playwright/test';

// SPATIAL MODEL inc2 — the rotary sim READS the declared bar (stock.diameter) instead of inferring R = min(cross)/2. ONE source
// (barRadius) read by the collision (cylinderOf), the 3D mesh (setStock), and the sim-starts (opSimStarts). Declared-first,
// box-fallback: an unset diameter is the status quo (bar=box, R=38.1); a declared Ø50 in a 76×76 box renders a true Ø50 bar
// (R=25) for ALL THREE → the probe touches + the cylinder agree, no false through-stock. stock.diameter round-trips via settings.
test.use({ viewport: { width: 1100, height: 850 } });

test('rotary bar: sim+collision+mesh read the declared stock.diameter; default unchanged', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
  const r = await page.evaluate(async () => {
    const { cylinderOf } = await import('/engine/probeGeometry.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { applySettings } = await import('/ui/settingsPanel.js');
    const box = { x: 150, y: 76.2, z: 76.2, shape: 'cylinder', show: true };
    const bar = { ...box, diameter: 50 };
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    const meshR = (s) => { viz.setStock(s); return viz.stockMesh && viz.stockMesh.geometry && viz.stockMesh.geometry.parameters ? +viz.stockMesh.geometry.parameters.radiusTop.toFixed(2) : null; };
    // R reflected in opSimStarts flank: flank y = cy - (R + retract + tipR); cy=38.1 → box -4, bar (R25) +9.1
    const flank = (s) => { const st = opSimStarts('rotary_center', { method: 'fit', safeZ: 15 }, s); return +st[1].y.toFixed(1); };
    applySettings({ stock: { ...bar } });
    const rt = window.ddcsGetSettings().stock.diameter;
    return {
      collDef: +cylinderOf(box, 'x').r.toFixed(2), collDec: +cylinderOf(bar, 'x').r.toFixed(2),
      meshDef: meshR(box), meshDec: meshR(bar),
      flankDef: flank(box), flankDec: flank(bar), rt,
    };
  });
  console.log('BARDECL ' + JSON.stringify(r));
  // DEFAULT (no diameter) — collision + mesh = min(cross)/2 = 38.1 (UNCHANGED, no regression)
  expect(r.collDef, 'default collision R = 38.1').toBeCloseTo(38.1, 1);
  expect(r.meshDef, 'default mesh R = 38.1').toBeCloseTo(38.1, 1);
  // DECLARED Ø50 → R=25 for BOTH the collision + the mesh (they agree → no false through-stock)
  expect(r.collDec, 'declared Ø50 → collision R=25').toBe(25);
  expect(r.meshDec, 'declared Ø50 → mesh R=25').toBe(25);
  // opSimStarts reads it too (the bar is thinner → flanks closer to centre)
  expect(r.flankDec, 'declared flank closer to centre than default').toBeGreaterThan(r.flankDef);
  // stock.diameter round-trips through settings
  expect(r.rt, 'stock.diameter round-trips').toBe(50);
});
