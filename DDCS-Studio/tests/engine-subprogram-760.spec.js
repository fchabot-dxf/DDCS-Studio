import { test, expect } from '@playwright/test';

/**
 * t760 (Text Stage 2, foundation) — the sim engine executes GENERAL `M98 P####` subprogram calls to O-words DEFINED in
 * the program, with a call/return stack (`M99` returns; empty stack ⇒ M99 is a program end, unchanged). This is the
 * capability the upcoming {SN} digit-glyph dispatch (O600-609) needs so the sim proves the engraved serial end-to-end;
 * it also lets any CAM macro with its own subs run. Firmware slib subs (P501 homing / P502) are NOT program-defined, so
 * they still hit their special handlers — verified unchanged by the full suite.
 */

const trace = (page, prog) => page.evaluate(async (p) => {
  const mod = await import('/engine/GcodeExecutionEngine.js');
  const Engine = mod.GcodeExecutionEngine || mod.default;
  const eng = new Engine({});
  const t = eng.trace(p);
  const pts = [];
  for (const s of (t.segments || [])) { if (s.x2 != null) pts.push([Math.round(s.x2), Math.round(s.y2)]); else if (s.to) pts.push([Math.round(s.to.x), Math.round(s.to.y)]); }
  return { pts, subsSize: eng.subs ? eng.subs.size : -1, capped: !!(t.stats && t.stats.capped) };
}, prog);

test('M98 P#### calls a program-defined O-word and M99 RETURNS to the caller', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  // 0,0 → M98 P600 (jump to O600 → 50,50) → M99 return → 10,10
  const r = await trace(page, 'G90\nG0 X0 Y0\nM98 P600\nG1 X10 Y10 F100\nM30\nO600\nG1 X50 Y50 F100\nM99\n');
  expect(r.subsSize, 'the O600 subprogram is indexed').toBe(1);
  expect(r.pts, 'the path enters the sub (50,50) then RETURNS and continues (10,10)').toEqual([[0, 0], [50, 50], [10, 10]]);
});

test('nested M98 (a sub calls a sub) returns through both levels', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  // main 0,0 → O600 → 20,0 → (O600 calls O601 → 20,20) → back in O600 → 30,0 → return → main 5,5
  const r = await trace(page, 'G90\nG0 X0 Y0\nM98 P600\nG1 X5 Y5 F100\nM30\nO600\nG1 X20 Y0 F100\nM98 P601\nG1 X30 Y0 F100\nM99\nO601\nG1 X20 Y20 F100\nM99\n');
  expect(r.pts, 'nested call/return threads correctly').toEqual([[0, 0], [20, 0], [20, 20], [30, 0], [5, 5]]);
});

test('a bare M99 with NO pending call is still a program END (unchanged)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  // M99 as a subprogram-file end: the moves before it run, the line after M99 must NOT (M99 ends the program)
  const r = await trace(page, 'G90\nG0 X0 Y0\nG1 X15 Y15 F100\nM99\nG1 X99 Y99 F100\n');
  expect(r.pts, 'M99 ends the program; the post-M99 move never runs').toEqual([[0, 0], [15, 15]]);
});
