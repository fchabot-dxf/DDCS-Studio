import { test, expect } from '@playwright/test';

// H1 — native homing (M98 P501 X<N>) is run by the execution engine.
//
// The homing WIZARD PREVIEW models the motion via homingSimProxy (plain G53 moves). But the RAW emitted homing
// macro is literal `M98 P501 X<N>` lines, and the engine had NO M98 handler — so an editor Simulate of an inserted
// homing macro silently skipped it (no motion, no homed flag). These tests pin the fix: the engine now models the
// native home (rapid to the signed-travel home end + back-off, like the proxy) and sets the homed flag #[1515+N].
test.use({ viewport: { width: 1000, height: 800 } });

// Deterministic machine/homing config injected so the home-end math is checkable regardless of app defaults.
const STUB_SETTINGS = `window.ddcsGetSettings = () => ({
  machine: { x: 300, y: 200, z: -120, softLimits: true },
  homing: { axes: {
    z: { method: 'native', backoff: 5 },
    x: { method: 'native', backoff: 5 },
    a: { method: 'native', rotary: 'setzero' },
  } },
});`;

test('engine runs M98 P501 X2 (home Z): moves to the home end + sets the homed flag', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async (stub) => {
    eval(stub);   // deterministic machine travel/homing config
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const code = ['G90', 'G0 X0 Y0 Z0', 'M98P501X2', 'M30'].join('\n');   // X2 = axis index 2 = Z
    const eng = new GcodeExecutionEngine({ autoAnswer: true });
    const t = eng.trace(code);
    const last = t.segments[t.segments.length - 1];
    return { segCount: t.segments.length, homedZ: eng.vars.get(1517), lastZ: last.z2, lastRapid: last.rapid };
  }, STUB_SETTINGS);
  // Z travel is -120 (signed → home toward 0). 0 is the max end, so seek direction is +. Back-off 5 toward centre → home end = 0 - (1)*5 = -5.
  expect(r.homedZ, '#1517 (Z homed flag) is set').toBe(1);
  expect(Math.abs(r.lastZ - (-5)) < 1e-6, `Z homed to -5 (got ${r.lastZ})`).toBe(true);
  expect(r.lastRapid, 'the home move is a rapid').toBe(true);
  expect(r.segCount, 'the home produced a motion segment').toBeGreaterThan(1);
});

test('M98 P501 X0 (home X) uses the +X signed travel home end', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async (stub) => {
    eval(stub);
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const code = ['G90', 'G0 X0 Y0 Z0', 'M98P501X0', 'M30'].join('\n');   // X0 = axis index 0 = X
    const eng = new GcodeExecutionEngine({ autoAnswer: true });
    const t = eng.trace(code);
    const last = t.segments[t.segments.length - 1];
    return { homedX: eng.vars.get(1515), lastX: last.x2 };
  }, STUB_SETTINGS);
  // X travel +300 (home toward 0). 0 is the min end, so seek direction is -. Back-off 5 toward centre → home end = 0 - (-1)*5 = 5.
  expect(r.homedX, '#1515 (X homed flag) is set').toBe(1);
  expect(Math.abs(r.lastX - 5) < 1e-6, `X homed to 5 (got ${r.lastX})`).toBe(true);
});

test('the X-word in M98 P501 X2 is the AXIS INDEX, not a coordinate (no move to X=2)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async (stub) => {
    eval(stub);
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const code = ['G90', 'G0 X0 Y0 Z0', 'M98P501X2', 'M30'].join('\n');
    const eng = new GcodeExecutionEngine({ autoAnswer: true });
    const t = eng.trace(code);
    // No segment should end at X=2 — that would be the bug (axis index mis-read as a coordinate).
    return { anyAtX2: t.segments.some((s) => Math.abs(s.x2 - 2) < 1e-6) };
  }, STUB_SETTINGS);
  expect(r.anyAtX2, 'X2 (axis index) was NOT mistaken for a move to X=2').toBe(false);
});

test('A-axis native home (set-zero) sets its flag with no motion + no X-word coordinate move', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async (stub) => {
    eval(stub);
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const code = ['G90', 'G0 X0 Y0 Z0', 'M98P501X3', 'M30'].join('\n');   // X3 = axis index 3 = A
    const eng = new GcodeExecutionEngine({ autoAnswer: true });
    const t = eng.trace(code);
    return { homedA: eng.vars.get(1518), anyAtX3: t.segments.some((s) => Math.abs(s.x2 - 3) < 1e-6), segCount: t.segments.length };
  }, STUB_SETTINGS);
  expect(r.homedA, '#1518 (A homed flag) is set').toBe(1);
  expect(r.anyAtX3, 'X3 (axis index) was NOT mistaken for a move to X=3').toBe(false);
  expect(r.segCount, 'A set-zero home adds no motion segment (just the prior rapid)').toBe(1);
});


