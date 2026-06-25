import { test, expect } from '@playwright/test';

// Engine fast-trace (preview foundation). trace() runs the program to completion through the engine's OWN
// _executeStep — resolving #vars, following IF/GOTO loops, auto-detecting probes — and returns the EXACT
// path the engine takes as drawable segments. This is what feeds the preview route (option B): what you see
// is what the engine did. The contrast target is parseGcode (the static parser), which can't follow loops or
// resolve probe-result vars, so it drops exactly the moves that make a probe macro a probe macro.
test.use({ viewport: { width: 1000, height: 800 } });

test('trace resolves a probe-result coordinate that the static parser drops', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const { parseGcode } = await import('/gcodeParser.js');
    // Retract is relative to the probe's TRIGGER position (#1927) — the coordinate only exists after a touch.
    const code = [
      'G90',
      'G0 Z5',
      'G31 Z-10 F50',          // probe down — trace auto-detects, sets #1927 = -10 (the trigger Z)
      'G0 Z[#1927+2]',         // retract 2mm above the touch  → Z-8  (static parser can't resolve #1927)
      'G1 X20 Y0 F300',
      'M30',
    ].join('\n');
    const eng = new GcodeExecutionEngine({ autoAnswer: true });   // stock null → probe runs full travel, auto-detects at Z-10
    const traced = eng.trace(code);
    const parsed = parseGcode(code);
    const endsAtZ = (segs, z) => segs.some((s) => Math.abs(s.z2 - z) < 1e-6);
    return {
      traceCount: traced.segments.length,
      parseCount: parsed.segments.length,
      traceHasRetract: endsAtZ(traced.segments, -8),   // the #1927-derived move
      parseHasRetract: endsAtZ(parsed.segments, -8),
      capped: traced.stats.capped,
      drawable: traced.stats.drawable,
    };
  });
  expect(r.drawable).toBe(true);
  expect(r.traceHasRetract, 'trace resolved Z[#1927+2] → Z-8 from the probe touch').toBe(true);
  expect(r.parseHasRetract, 'static parser cannot resolve the probe-result var, so it drops that move').toBe(false);
  expect(r.traceCount).toBeGreaterThan(r.parseCount);
  expect(r.capped, 'a well-formed macro terminates without hitting the loop cap').toBe(false);
});

test('trace follows an IF/GOTO probe loop and terminates', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    // Loop: probe, if Z-axis detected (#1922==2) jump out, else retract and retry. The trace auto-detects on
    // the first probe so it exits at N100 — a real machine would too. It must NOT spin to the step cap.
    const code = [
      'G90',
      'G0 X0 Y0 Z5',
      'N10 G31 Z-10 F50',
      'IF #1922==2 GOTO 100',
      'G0 Z5',
      'GOTO 10',
      'N100 G0 Z2',
      'M30',
    ].join('\n');
    const eng = new GcodeExecutionEngine({ autoAnswer: true });
    const t = eng.trace(code);
    return { count: t.segments.length, capped: t.stats.capped, probes: t.stats.probe, last: t.segments[t.segments.length - 1] };
  });
  expect(r.capped, 'the loop resolved on the auto-detected probe — no runaway').toBe(false);
  expect(r.probes, 'probed exactly once before detecting').toBe(1);
  expect(r.last && Math.abs(r.last.z2 - 2) < 1e-6, 'took the success branch to N100 (G0 Z2)').toBe(true);
});

test('trace bounds a loop that never resolves (no hang)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const code = ['N10 G0 X1', 'G0 X0', 'GOTO 10', 'M30'].join('\n');   // unconditional infinite loop
    const eng = new GcodeExecutionEngine({ autoAnswer: true });
    const t = eng.trace(code);
    return { capped: t.stats.capped, count: t.segments.length };
  });
  expect(r.capped, 'an unconditional infinite loop is bounded by the step cap').toBe(true);
  expect(r.count).toBeGreaterThan(0);
});

test('trace linearizes G2/G3 arcs into chord segments', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const code = ['G90', 'G0 X0 Y0', 'G1 F300', 'G2 X10 Y0 I5 J0', 'M30'].join('\n');   // half-circle, dia 10
    const eng = new GcodeExecutionEngine({ autoAnswer: true });
    const t = eng.trace(code);
    const arcs = t.segments.filter((s) => s.type === 'feed' && !s.rapid);
    const end = t.segments[t.segments.length - 1];
    return { arcChords: arcs.length, endX: end.x2, endY: end.y2 };
  });
  expect(r.arcChords, 'the arc became many small chords, not one straight line').toBeGreaterThan(8);
  expect(Math.abs(r.endX - 10) < 0.2 && Math.abs(r.endY) < 0.2, 'arc ends at its programmed endpoint').toBe(true);
});

test('trace counts manual-REPOSITION passes (rotary 3-point fit → 3 passes, distinct probes)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const { rotaryCenterStack } = await import('/wizards/rotaryCenterWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const code = emitMapped(rotaryCenterStack({ method: 'fit' })).text;
    const eng = new GcodeExecutionEngine({ autoAnswer: true });
    const t = eng.trace(code);
    // Probe segments grouped by pass; offset each pass by a per-pass start (as the viz does) and take the
    // probe ENDPOINT (the touch) — they must be distinct, not all the degenerate single-start point.
    const starts = [{ x: 75, y: 38, z: 5 }, { x: 75, y: 76, z: -38 }, { x: 75, y: 0, z: -38 }];
    const tips = [];
    for (let p = 0; p < 3; p++) {
      const seg = t.segments.filter((s) => s.probe && (s.pass | 0) === p).pop();
      const o = starts[p];
      if (seg) tips.push({ x: seg.x2 + o.x, y: seg.y2 + o.y, z: seg.z2 + o.z });
    }
    const distinct = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > 1;
    return {
      passes: t.stats.passes,
      passSet: [...new Set(t.segments.map((s) => s.pass | 0))].sort(),
      tipCount: tips.length,
      allDistinct: tips.length === 3 && distinct(tips[0], tips[1]) && distinct(tips[1], tips[2]) && distinct(tips[0], tips[2]),
    };
  });
  expect(r.passes, 'two repositions → three passes').toBe(3);
  expect(r.passSet, 'segments carry pass 0/1/2').toEqual([0, 1, 2]);
  expect(r.tipCount, 'a probe touch in each of the three passes').toBe(3);
  expect(r.allDistinct, 'the three probes hit distinct points once offset by their per-pass starts').toBe(true);
});

test('trace counts the alignment reposition (point A + B → 2 passes)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const { alignmentStack } = await import('/wizards/alignmentWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const code = emitMapped(alignmentStack({ checkAxis: 'X' })).text;
    const eng = new GcodeExecutionEngine({ autoAnswer: true });
    const t = eng.trace(code);
    return { passes: t.stats.passes, passSet: [...new Set(t.segments.map((s) => s.pass | 0))].sort() };
  });
  expect(r.passes, 'one reposition (jog A→B) → two passes').toBe(2);
  expect(r.passSet, 'segments carry pass 0 and 1').toEqual([0, 1]);
});

test('trace resolves a direct #var coordinate', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const code = ['G90', '#5=-3.5', 'G1 Z#5 F100', 'M30'].join('\n');
    const eng = new GcodeExecutionEngine({ autoAnswer: true });
    const t = eng.trace(code);
    return t.segments.map((s) => s.z2);
  });
  expect(r.some((z) => Math.abs(z + 3.5) < 1e-6), 'G1 Z#5 resolved to Z-3.5').toBe(true);
});
