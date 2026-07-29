import { test, expect } from '@playwright/test';

// t977 — surfacing CAM-slot CONTROLLER-SAFETY guards. The generated macro runs OPEN-LOOP on the controller, so a
// bad field (0 stepover → div-by-zero on the row count; 0 stepdown → the Z pass loops forever; 0 clearance → an
// unsafe Z0 retract; 0 tool) must produce a CLEAN error (N7 → #1505), never a runaway. Plus the ramp lead-in is
// bounded to the row span (a narrow area must not ramp past its far edge). Mirrors the existing zero-area guard.
test('surfacing slot GUARDS: bad step/tool/clearance errors cleanly (no div-by-zero / infinite loop); a normal config still rasters', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { surfacingSlot } = await import('/data/millToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const s = surfacingSlot();
    const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
    const run = (ov) => {
      const seed = new Map();
      s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
      for (const [k, val] of Object.entries(ov)) { const f = s.fields.find((x) => x.key === k); if (f) seed.set(mirrorVar(f.idx), val); }
      const eng = new GcodeExecutionEngine({ createVarStore: () => new Map(seed) });
      const t = eng.trace(macro);
      return { capped: t.stats.capped, segs: t.segments.length };
    };
    return {
      macro,
      normal: run({}),
      zeroStepover: run({ stepoverPct: 0 }),   // t1325 — the surface field is the PERCENTAGE now; zero intent still means zero step
      zeroStepdown: run({ stepdown: 0 }),
      zeroTool: run({ toolDia: 0 }),
      zeroClear: run({ clearance: 0 }),
      negStepover: run({ stepoverPct: -3 }),
    };
  });
  // STRUCTURE: the four positive-param guards + the ramp bound are in the macro
  expect((r.macro.match(/IF #\d+ LE 0 GOTO 7/g) || []).length, 'four LE-0 param guards').toBe(4);
  expect(r.macro, 'the clean error label').toContain('N7');
  expect(r.macro, 'the ramp is bounded to the row span').toContain('bound the ramp to the row span');
  // NORMAL: a real raster, no runaway
  expect(r.normal.capped, 'a normal config resolves (no cap)').toBe(false);
  expect(r.normal.segs, 'a normal config rasters a real path').toBeGreaterThan(20);
  // BAD inputs: NEVER a runaway (the safety property), and errored out before rastering
  for (const bad of ['zeroStepover', 'zeroStepdown', 'zeroTool', 'zeroClear', 'negStepover']) {
    expect(r[bad].capped, `${bad}: NO infinite loop / step-cap`).toBe(false);
    expect(r[bad].segs, `${bad}: errors out before the raster (far fewer moves than a normal run)`).toBeLessThan(r.normal.segs / 2);
  }
});
