// t979 — relativizeProgram: absolute→incremental for the surfacing "Skim" Z-mode. Per-axis first-ref → 0 delta
// (that axis's start = the jog position); subsequent moves are deltas; G53 machine-frame + G91 moves are left
// absolute; feeds/comments preserved. The caller wraps the result in G91 … G90.
import { test, expect } from '@playwright/test';

test('relativizeProgram: absolute moves → per-axis deltas; G53 + G91 left alone; feeds preserved', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { relativizeProgram } = await import('/data/rotateProgram.js');
    const src = [
      'G0 X10 Y20',          // first X,Y → 0,0 (the jog corner)
      'G1 Z-1 F100',         // first Z → 0 (the touched surface); actually cuts down from here on the NEXT
      'G1 X30 Y20 F800',     // X +20, Y +0
      'G0 Z5',               // Z from -1 → +6
      'G53 Z-2 ( retract )', // machine-frame — LEFT absolute
      'M5',
    ].join('\n');
    return relativizeProgram(src);
  });
  const lines = r.text.split('\n');
  expect(lines[0]).toBe('G0 X0 Y0');                      // first X,Y = 0 (start = jog corner)
  expect(lines[1]).toBe('G1 Z0 F100');                    // first Z = 0 (start = touched surface); feed kept
  expect(lines[2]).toBe('G1 X20 Y0 F800');                // ΔX=+20, ΔY=0; feed kept
  expect(lines[3]).toBe('G0 Z6');                         // ΔZ = 5-(-1) = +6
  expect(lines[4]).toBe('G53 Z-2 ( retract )');           // G53 UNTOUCHED (machine frame)
  expect(lines[5]).toBe('M5');                            // non-geometry pass-through
  expect(r.relativized).toBeGreaterThan(0);
});

test('relativizeProgram: an already-G91 body is left alone (idempotent-safe)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { relativizeProgram } = await import('/data/rotateProgram.js');
    return relativizeProgram('G91\nG1 Z-1 F100\nG1 X5 F800').text;
  });
  expect(r).toBe('G91\nG1 Z-1 F100\nG1 X5 F800');   // G91 already → no rewrite
});
