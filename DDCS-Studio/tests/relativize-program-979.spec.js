// t979 — relativizeProgram: absolute→incremental for the surfacing "Skim" Z-mode. Per-axis first-ref → 0 delta
// (that axis's start = the jog position); subsequent moves are deltas; G53 machine-frame + G91 moves are left
// absolute; feeds/comments preserved. The caller wraps the result in G91 … G90.
import { test, expect } from '@playwright/test';

test('relativizeProgram: deltas from the jog ORIGIN (0,0,0); G53 + G91 left alone; feeds preserved', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { relativizeProgram } = await import('/data/rotateProgram.js');
    const src = [
      'G0 X10 Y20',          // Δ from origin → +10,+20 (move to the first row from the jog corner)
      'G1 Z-1 F100',         // Δ from origin Z0 → -1
      'G1 X30 Y20 F800',     // ΔX +20, ΔY 0
      'G0 Z5',               // ΔZ = 5-(-1) = +6
      'G53 Z-2 ( retract )', // machine-frame — LEFT absolute
      'M5',
    ].join('\n');
    return relativizeProgram(src);
  });
  const lines = r.text.split('\n');
  expect(lines[0]).toBe('G0 X10 Y20');                    // deltas from the jog origin (0,0)
  expect(lines[1]).toBe('G1 Z-1 F100');                   // ΔZ from origin; feed kept
  expect(lines[2]).toBe('G1 X20 Y0 F800');                // ΔX=+20, ΔY=0; feed kept
  expect(lines[3]).toBe('G0 Z6');                         // ΔZ = 5-(-1) = +6
  expect(lines[4]).toBe('G53 Z-2 ( retract )');           // G53 UNTOUCHED (machine frame)
  expect(lines[5]).toBe('M5');                            // non-geometry pass-through
  expect(r.relativized).toBeGreaterThan(0);
});

test('relativizeProgram CRASH-GUARD: the opening clearance stays a +clr LIFT, then the plunge dives one step (not the whole clearance)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { relativizeProgram } = await import('/data/rotateProgram.js');
    // the surfacing shape: lift to clearance, go to the row, plunge to the first cut depth
    return relativizeProgram(['G0 Z5', 'G0 X2 Y2', 'G1 Z-0.5 F200'].join('\n')).text.split('\n');
  });
  expect(r[0]).toBe('G0 Z5');       // the clearance LIFT survives as +5 from the jog surface (NOT Z0 = no lift)
  expect(r[2]).toBe('G1 Z-5.5 F200'); // plunge = -0.5 - 5 = -5.5 from the clearance height → lands at -0.5 below the surface (correct), NOT -5.5 below it
});

test('relativizeProgram: an already-G91 body is left alone (idempotent-safe)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { relativizeProgram } = await import('/data/rotateProgram.js');
    return relativizeProgram('G91\nG1 Z-1 F100\nG1 X5 F800').text;
  });
  expect(r).toBe('G91\nG1 Z-1 F100\nG1 X5 F800');   // G91 already → no rewrite
});
