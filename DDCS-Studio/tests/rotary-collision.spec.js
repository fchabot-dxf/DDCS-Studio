import { test, expect } from '@playwright/test';

// A rotary (cylinder) stock collides as a ROUND object, not its bounding box. Shared probeGeometry drives
// BOTH the engine (this trace) and the 3D preview, so the simulated touch and the drawn one agree.
test.use({ viewport: { width: 1000, height: 800 } });

test('probe stops at the round cylinder OD, not the bounding-box corner', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { traceToolpath } = await import('/engine/trace.js');
    // Ø100 cylinder along X (default rotary axis): cross-section centred at (y50, z-50), R=50.
    const stock = { x: 120, y: 100, z: 100, shape: 'cylinder', show: true };
    const start = { x: 60, y: 50, z: -50 };          // on the axis (centre of the round cross-section)
    // Probe diagonally +Y+Z. The round OD is 50 mm from the axis → it stops at ~35.36 mm in each of Y,Z
    // (50/√2). A box would NOT stop within this 56.6 mm move (its corner is 70.7 mm out) → would reach 40.
    const parsed = traceToolpath('G91\nG31 Y40 Z40 F50\n', { stock, start });
    const p = (parsed.segments || []).find((s) => s.probe || s.type === 'probe');
    return p ? { y2: p.y2, z2: p.z2 } : null;
  });
  expect(r, 'a probe segment was traced').not.toBeNull();
  // STYLUS-RADIUS COMP (turn 116): the OD collides at R + tip radius (the tool CENTRE stops a radius off the surface —
  // correct for the rotary's real OUTSIDE probes). So R=50→52, diagonal 52/√2≈36.77. Still round, not the 70.7 box corner.
  expect(r.y2, 'stops at the round OD + tip radius (52/√2 ≈ 36.77), not the 40 a bounding box would allow').toBeCloseTo(36.77, 0);
  expect(r.z2).toBeCloseTo(36.77, 0);
});

test('radial probe from the axis stops at the cylinder radius', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { traceToolpath } = await import('/engine/trace.js');
    const stock = { x: 120, y: 100, z: 100, shape: 'cylinder', show: true };
    const start = { x: 60, y: 50, z: -50 };          // on the axis
    const parsed = traceToolpath('G91\nG31 Y80 F50\n', { stock, start });  // probe +Y, OD is 50 out
    const p = (parsed.segments || []).find((s) => s.probe || s.type === 'probe');
    return p ? { y2: p.y2 } : null;
  });
  expect(r).not.toBeNull();
  // R=50 + tip radius 2 = 52 (the tool centre stops a radius off the OD).
  expect(r.y2, 'stops at the +Y OD + tip radius (52 from the axis), not the full 80').toBeCloseTo(52, 0);
});
