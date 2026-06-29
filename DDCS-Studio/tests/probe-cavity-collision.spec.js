import { test, expect } from '@playwright/test';

// A probe stops at the FIRST surface it hits — including a pocket's INNER wall — so internal (bore/pocket) probes
// no longer tunnel through the rendered cavity. The engine now tests the same outer-box + cavity geometry the 3D
// view draws (gcodeViz3d._rebuild), with no internal/external special-casing. This drives EVERY wizard preview
// (one shared engine), so it's the default everywhere.
test.use({ viewport: { width: 1000, height: 800 } });

test('bore probe stops at the pocket cavity wall, not the outer block (no tunnelling)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { traceToolpath } = await import('/engine/trace.js');
    // 100×100×20 pocket → rendered/collided cavity inset = max(8, 25% of 100) = 25, so the +X wall is at stock X=75.
    const stock = { x: 100, y: 100, z: 20, shape: 'pocket', show: true };
    const start = { x: 50, y: 50, z: -5 };            // bore centre (inside the cavity)
    // Probe +X by 40 mm from the centre. Wall is 25 mm out → it must clamp to 25, not run the full 40.
    const parsed = traceToolpath('G91\nG31 X40 F50\n', { stock, start });
    const probe = (parsed.segments || []).find((s) => s.probe || s.type === 'probe');
    return probe ? { x1: probe.x1, x2: probe.x2 } : null;
  });
  expect(r, 'a probe segment was traced').not.toBeNull();
  expect(Math.abs(r.x1), 'probe starts at the centre').toBeLessThan(0.01);
  // STYLUS-RADIUS COMP (turn 116): the tool CENTRE stops a tip-radius (2 mm) SHORT of the 25 mm cavity wall — the tip
  // touches the wall (no penetration); the wizards' #50/#58 comp recovers the true 25 mm. Still nowhere near the 40 mm cap.
  expect(r.x2, 'tool centre stops a radius short of the cavity wall (25 − 2 = 23)').toBeCloseTo(23, 1);
});

test('external probe into a solid block still stops at the block face (no regression)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { traceToolpath } = await import('/engine/trace.js');
    const stock = { x: 100, y: 100, z: 20, shape: 'boss', show: true };
    const start = { x: -10, y: 50, z: -5 };           // parked 10 mm clear of the −X face, outside the block
    // Probe +X by 40 mm toward the block. Face is 10 mm away → clamp to 10.
    const parsed = traceToolpath('G91\nG31 X40 F50\n', { stock, start });
    const probe = (parsed.segments || []).find((s) => s.probe || s.type === 'probe');
    return probe ? { x1: probe.x1, x2: probe.x2 } : null;
  });
  expect(r, 'a probe segment was traced').not.toBeNull();
  // STYLUS-RADIUS COMP: the tool centre stops a tip-radius (2 mm) short of the 10 mm face (the tip touches it).
  expect(r.x2, 'tool centre stops a radius short of the block face (10 − 2 = 8)').toBeCloseTo(8, 1);
});
