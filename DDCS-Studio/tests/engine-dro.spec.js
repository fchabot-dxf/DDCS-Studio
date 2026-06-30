import { test, expect } from '@playwright/test';

// ENGINE (t143) — the sim populates the machine DRO registers (ALL dialect bases) each step so read-machine (RM) returns the
// real tool coord instead of an unset 0. The general read-machine gap; step 1 of the real rotary 3-point fit sim (the fit
// captures its cross-axis via RM #52=#881 → collapsed to 0 before this). Machine space = operator start + local position.
test('read-machine returns the tool machine coord after a move (was 0 — DRO unpopulated)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const run = (stockOffset) => {
      const e = new GcodeExecutionEngine({ autoAnswer: true, stockOffset });
      // move incrementally, then read every dialect's machine-DRO base: Expert #880-882, V4.1 #1500, DM500 #864, rs274 #5420
      e.trace('G91\nG0 X10 Y5 Z-3\n#52=#880\n#53=#881\n#54=#882\n#55=#1500\n#56=#864\n#57=#5420\nM30');
      return { x: e.vars.get(52), y: e.vars.get(53), z: e.vars.get(54), v41: e.vars.get(55), dm500: e.vars.get(56), rs274: e.vars.get(57) };
    };
    return { origin: run({ x: 0, y: 0, z: 0 }), offset: run({ x: 50, y: 20, z: 0 }) };
  });
  // machine = operator start + local pos (was 0 before the DRO populate)
  expect(r.origin, 'DRO at origin = the local move').toMatchObject({ x: 10, y: 5, z: -3 });
  expect(r.offset.x, 'X DRO = start 50 + local 10').toBe(60);
  expect(r.offset.y, 'Y DRO = start 20 + local 5').toBe(25);
  expect(r.offset.z, 'Z DRO = start 0 + local -3').toBe(-3);
  // every dialect base populated → read-machine works regardless of profile (all read X = 10)
  expect(r.origin.v41, 'V4.1 base #1500 = X').toBe(10);
  expect(r.origin.dm500, 'DM500 base #864 = X').toBe(10);
  expect(r.origin.rs274, 'rs274 base #5420 = X').toBe(10);
});
