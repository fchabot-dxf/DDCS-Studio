import { test, expect } from '@playwright/test';

// A generated CAM slot is a full DDCS macro (WHILE/DO/END loops, IF…THEN, COS/SIN in coordinates). The
// "▶ Simulate" button runs it through the shared preview engine with the #2600 mirrors seeded from each
// field's default. These checks pin the two things that make that possible end-to-end in the real browser:
// (1) the engine actually executes the loops + trig (not the old behaviour where trig coords collapsed to 0),
// (2) the preview panel mounts on a seeded macro without throwing.

test('engine traces a generated bore bolt-circle macro with seeded form vars', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { slotFromOp } = await import('/data/opToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const s = slotFromOp('bore', 'circle');
    const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
    const seed = new Map();
    s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
    const eng = new GcodeExecutionEngine({ createVarStore: () => new Map(seed) });
    const t = eng.trace(macro);
    return { segs: t.segments.length, capped: t.stats.capped, bounds: t.bounds, hasNamedM: /M_\w+/.test(macro) };
  });
  expect(r.hasNamedM, 'no invalid named M-codes in the macro').toBe(false);
  expect(r.capped, 'loops resolve (not hitting the step cap)').toBe(false);
  expect(r.segs, 'a real toolpath is drawn').toBeGreaterThan(50);
  // Ø50 bolt circle + ~3mm bore ring → the path must span both axes, NOT collapse to 0 (the old tokenizer bug).
  expect(r.bounds.maxX, 'X spans the bolt circle').toBeGreaterThan(20);
  expect(r.bounds.minX).toBeLessThan(-20);
  expect(r.bounds.maxY).toBeGreaterThan(20);
  expect(r.bounds.minY).toBeLessThan(-20);
});

test('corner probe slot: each corner probes the correct X/Y walls and every branch resolves', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { cornerSlot } = await import('/data/probeToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const s = cornerSlot();
    const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
    const dirs = (ov) => {
      const seed = new Map(); s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
      for (const [k, val] of Object.entries(ov)) { const f = s.fields.find((x) => x.key === k); if (f) seed.set(mirrorVar(f.idx), val); }
      const eng = new GcodeExecutionEngine({ createVarStore: () => new Map(seed) });
      const t = eng.trace(macro);
      const probes = t.segments.filter((g) => g.probe).map((g) => {
        const dx = g.x2 - g.x1, dy = g.y2 - g.y1, dz = g.z2 - g.z1;
        if (Math.abs(dz) > 1e-6) return 'Z' + (dz < 0 ? '-' : '+');
        if (Math.abs(dx) > 1e-6) return 'X' + (dx < 0 ? '-' : '+');
        if (Math.abs(dy) > 1e-6) return 'Y' + (dy < 0 ? '-' : '+');
        return '0';
      });
      return { capped: t.stats.capped, dirs: probes };
    };
    const lefts = (macro.match(/\[/g) || []).length, rights = (macro.match(/\]/g) || []).length;
    return {
      balanced: lefts === rights, hasNamedM: /M_\w+/.test(macro),
      fl: dirs({ corner: 1 }), fr: dirs({ corner: 2 }), bl: dirs({ corner: 3 }), br: dirs({ corner: 4 }),
      flXY: dirs({ corner: 1, seq: 1 }), brZ: dirs({ corner: 4, probeZ: 1 }),
    };
  });
  expect(r.balanced, 'brackets balance').toBe(true);
  expect(r.hasNamedM, 'no named M-codes').toBe(false);
  // two-pass probe (fast+slow) per axis; corner sets the wall directions.
  expect(r.fl.capped).toBe(false); expect(r.fl.dirs).toEqual(['Y+', 'Y+', 'X+', 'X+']);
  expect(r.fr.dirs).toEqual(['Y+', 'Y+', 'X-', 'X-']);
  expect(r.bl.dirs).toEqual(['Y-', 'Y-', 'X+', 'X+']);
  expect(r.br.dirs).toEqual(['Y-', 'Y-', 'X-', 'X-']);
  expect(r.flXY.dirs, 'XY sequence probes X wall first').toEqual(['X+', 'X+', 'Y+', 'Y+']);
  expect(r.brZ.dirs, 'Z-first prepends the Z surface probe').toEqual(['Z-', 'Z-', 'Y-', 'Y-', 'X-', 'X-']);
});

test('edge probe slot: axis/direction select the wall and the WCS axis written', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { edgeSlot } = await import('/data/probeToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const s = edgeSlot();
    const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
    const dirs = (ov) => {
      const seed = new Map(); s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
      for (const [k, val] of Object.entries(ov)) { const f = s.fields.find((x) => x.key === k); if (f) seed.set(mirrorVar(f.idx), val); }
      const t = new GcodeExecutionEngine({ createVarStore: () => new Map(seed) }).trace(macro);
      return t.segments.filter((g) => g.probe).map((g) => {
        const dx = g.x2 - g.x1, dy = g.y2 - g.y1;
        if (Math.abs(dx) > 1e-6) return 'X' + (dx < 0 ? '-' : '+');
        if (Math.abs(dy) > 1e-6) return 'Y' + (dy < 0 ? '-' : '+');
        return '0';
      });
    };
    const lefts = (macro.match(/\[/g) || []).length, rights = (macro.match(/\]/g) || []).length;
    // radius comp must be present (the bug we fixed): edge = trigger + sign*radius
    const hasComp = /#50=\[#1925\+#90\*#6\]/.test(macro.replace(/\s/g, ''));
    return { balanced: lefts === rights, hasComp, xp: dirs({ axis: 0, dir: 0 }), xn: dirs({ axis: 0, dir: 1 }), yp: dirs({ axis: 1, dir: 0 }) };
  });
  expect(r.balanced).toBe(true);
  expect(r.hasComp, 'edge applies radius comp').toBe(true);
  expect(r.xp).toEqual(['X+', 'X+']);
  expect(r.xn).toEqual(['X-', 'X-']);
  expect(r.yp).toEqual(['Y+', 'Y+']);
});

test('inside-centre slot: probes ±X then ±Y with a G53 re-centre between (bore = true diameter)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { insideCentreSlot } = await import('/data/probeToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const s = insideCentreSlot();
    const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
    const seed = new Map(); s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
    const t = new GcodeExecutionEngine({ createVarStore: () => new Map(seed) }).trace(macro);
    const probes = t.segments.filter((g) => g.probe).map((g) => {
      const dx = g.x2 - g.x1, dy = g.y2 - g.y1;
      return Math.abs(dx) > 1e-6 ? 'X' + (dx < 0 ? '-' : '+') : Math.abs(dy) > 1e-6 ? 'Y' + (dy < 0 ? '-' : '+') : '0';
    });
    const lefts = (macro.match(/\[/g) || []).length, rights = (macro.match(/\]/g) || []).length;
    return { balanced: lefts === rights, capped: t.stats.capped, probes, recentre: /G53 X#53/.test(macro), writesWcs: /#\[#70\]=#53/.test(macro) };
  });
  expect(r.balanced).toBe(true); expect(r.capped).toBe(false);
  expect(r.probes).toEqual(['X+', 'X+', 'X-', 'X-', 'Y+', 'Y+', 'Y-', 'Y-']);
  expect(r.recentre, 'G53 re-centre in X before Y').toBe(true);
  expect(r.writesWcs, 'writes the centre to WCS X').toBe(true);
});

test('boss-centre slot: probes 4 faces from outside, 3 reposition prompts, writes centre', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { bossCentreSlot } = await import('/data/probeToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const s = bossCentreSlot();
    const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
    const seed = new Map(); s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
    const t = new GcodeExecutionEngine({ createVarStore: () => new Map(seed) }).trace(macro);
    const probes = t.segments.filter((g) => g.probe).map((g) => {
      const dx = g.x2 - g.x1, dy = g.y2 - g.y1;
      return Math.abs(dx) > 1e-6 ? 'X' + (dx < 0 ? '-' : '+') : Math.abs(dy) > 1e-6 ? 'Y' + (dy < 0 ? '-' : '+') : '0';
    });
    const lefts = (macro.match(/\[/g) || []).length, rights = (macro.match(/\]/g) || []).length;
    return { balanced: lefts === rights, capped: t.stats.capped, probes, prompts: (macro.match(/REPOSITION/g) || []).length, writesWcs: /#\[#70\]=#53/.test(macro) && /#\[#73\]=#56/.test(macro) };
  });
  expect(r.balanced).toBe(true); expect(r.capped).toBe(false);
  expect(r.probes, 'each face probed from outside').toEqual(['X-', 'X-', 'X+', 'X+', 'Y-', 'Y-', 'Y+', 'Y+']);
  expect(r.prompts, '3 operator repositions around the boss').toBe(3);
  expect(r.writesWcs, 'writes the centre to WCS X/Y').toBe(true);
});

test('alignment slot: fence axis selects the probe axis; measures (no WCS write)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { alignmentSlot } = await import('/data/probeToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const s = alignmentSlot();
    const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
    const axes = (checkAxis) => {
      const seed = new Map(); s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
      const f = s.fields.find((x) => x.key === 'checkAxis'); seed.set(mirrorVar(f.idx), checkAxis);
      const t = new GcodeExecutionEngine({ createVarStore: () => new Map(seed) }).trace(macro);
      return { capped: t.stats.capped, ax: [...new Set(t.segments.filter((g) => g.probe).map((g) => Math.abs(g.x2 - g.x1) > 1e-6 ? 'X' : 'Y'))] };
    };
    return { fenceX: axes(0), fenceY: axes(1), atan2: /ATAN\[#52\]\/\[#53\]/.test(macro), noWcs: !/#\[#70\]=/.test(macro) };
  });
  expect(r.fenceX.capped).toBe(false);
  expect(r.fenceX.ax, 'fence along X → probe Y').toEqual(['Y']);
  expect(r.fenceY.ax, 'fence along Y → probe X').toEqual(['X']);
  expect(r.atan2, 'uses two-operand atan2').toBe(true);
  expect(r.noWcs, 'alignment only measures — no WCS write').toBe(true);
});

test('pocket slot: raster-clears the rect to depth in layers; guards a too-small pocket', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { pocketSlot } = await import('/data/millToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const s = pocketSlot();
    const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
    const run = (ov) => {
      const seed = new Map(); s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
      for (const [k, val] of Object.entries(ov || {})) { const f = s.fields.find((x) => x.key === k); if (f) seed.set(mirrorVar(f.idx), val); }
      return new GcodeExecutionEngine({ createVarStore: () => new Map(seed) }).trace(macro);
    };
    const t = run();
    const lefts = (macro.match(/\[/g) || []).length, rights = (macro.match(/\]/g) || []).length;
    const small = run({ w: 4 });   // 4mm pocket, 6mm tool → guard
    return {
      balanced: lefts === rights, hasNamedM: /M_\w+/.test(macro), capped: t.stats.capped,
      feed: t.stats.feed, maxX: t.bounds.maxX, maxY: t.bounds.maxY, minZ: t.bounds.minZ, smallFeed: small.stats.feed,
    };
  });
  expect(r.balanced).toBe(true); expect(r.hasNamedM).toBe(false); expect(r.capped).toBe(false);
  expect(r.feed, 'many clearing passes').toBeGreaterThan(50);
  expect(r.maxX, 'clears to the far X wall (80 − 3mm tool radius)').toBeCloseTo(77, 0);
  expect(r.maxY).toBeCloseTo(57, 0);
  expect(r.minZ, 'reaches full depth').toBeCloseTo(-4, 1);
  expect(r.smallFeed, 'a pocket smaller than the tool cuts nothing (guarded)').toBe(0);
});

test('circle-pocket slot: concentric rings clear the disc to depth (Ø − tool), guards too-small', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { circlePocketSlot } = await import('/data/millToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const s = circlePocketSlot();
    const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
    const run = (ov) => {
      const seed = new Map(); s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
      for (const [k, val] of Object.entries(ov || {})) { const f = s.fields.find((x) => x.key === k); if (f) seed.set(mirrorVar(f.idx), val); }
      return new GcodeExecutionEngine({ createVarStore: () => new Map(seed) }).trace(macro);
    };
    const t = run();
    const lefts = (macro.match(/\[/g) || []).length, rights = (macro.match(/\]/g) || []).length;
    const small = run({ dia: 4 });   // 4mm bore, 6mm tool → guard
    return { balanced: lefts === rights, capped: t.stats.capped, maxX: t.bounds.maxX, minX: t.bounds.minX, minZ: t.bounds.minZ, smallFeed: small.stats.feed };
  });
  expect(r.balanced).toBe(true); expect(r.capped).toBe(false);
  expect(r.maxX, 'clears to Ø/2 − tool radius (30−3)').toBeCloseTo(27, 0);
  expect(r.minX).toBeCloseTo(-27, 0);
  expect(r.minZ, 'full depth').toBeCloseTo(-4, 1);
  expect(r.smallFeed, 'bore smaller than tool cuts nothing (guarded)').toBe(0);
});

test('surfacing slot: rasters the full area with no inset and no wall pass', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { surfacingSlot } = await import('/data/millToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const s = surfacingSlot();
    const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
    const seed = new Map(); s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
    const t = new GcodeExecutionEngine({ createVarStore: () => new Map(seed) }).trace(macro);
    const lefts = (macro.match(/\[/g) || []).length, rights = (macro.match(/\]/g) || []).length;
    return { balanced: lefts === rights, capped: t.stats.capped, feed: t.stats.feed, maxX: t.bounds.maxX, maxY: t.bounds.maxY, minZ: t.bounds.minZ };
  });
  expect(r.balanced).toBe(true); expect(r.capped).toBe(false);
  expect(r.feed, 'raster passes').toBeGreaterThan(10);
  expect(r.maxX, 'sweeps the full area (no inset)').toBeCloseTo(100, 0);
  expect(r.maxY).toBeCloseTo(80, 0);
  expect(r.minZ, 'shallow skim').toBeCloseTo(-0.5, 2);
});

test('mill variants: raster direction rotates the rows (same coverage); circle arc direction is selectable', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { pocketSlot, circlePocketSlot } = await import('/data/millToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const trace = (s) => {
      const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
      const seed = new Map(); s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
      const t = new GcodeExecutionEngine({ createVarStore: () => new Map(seed) }).trace(macro);
      return { macro, maxX: t.bounds.maxX, maxY: t.bounds.maxY, minZ: t.bounds.minZ, capped: t.stats.capped };
    };
    const py = trace(pocketSlot(new Set(), 0, 'y'));     // raster rows along Y instead of X
    const cg2 = trace(circlePocketSlot(new Set(), 0, 'G2'));  // conventional rings
    return {
      py, cg2maxX: cg2.maxX, cg2cap: cg2.capped,
      g2arcs: /\bG2 X/.test(cg2.macro), noG3: !/\bG3 X/.test(cg2.macro),
    };
  });
  // Y-raster still clears the whole 80×60 pocket to the inset walls — same coverage, rows just run the other way.
  expect(r.py.capped).toBe(false);
  expect(r.py.maxX, 'far X wall still cleared').toBeCloseTo(77, 0);
  expect(r.py.maxY, 'far Y wall still cleared').toBeCloseTo(57, 0);
  expect(r.py.minZ, 'full depth').toBeCloseTo(-4, 1);
  // Circle pocket honours the conventional (G2) arc direction — every ring flips, none left as G3.
  expect(r.g2arcs, 'G2 rings emitted').toBe(true);
  expect(r.noG3, 'no G3 ring left when conventional chosen').toBe(true);
  expect(r.cg2cap).toBe(false);
  expect(r.cg2maxX, 'still clears to Ø/2 − tool radius').toBeCloseTo(27, 0);
});

test('cutting slots manage the spindle with the proven Expert forms (M3 S[#var], G04 P ms, M5)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { slotFromOp } = await import('/data/opToSlot.js');
    const { pocketSlot, surfacingSlot } = await import('/data/millToSlot.js');
    const { slotMacro } = await import('/data/slotPack.js');
    const macros = {
      drill: slotMacro({ slot: 22, ...slotFromOp('drill', 'circle') }),
      slot: slotMacro({ slot: 22, ...slotFromOp('slot') }),
      pocket: slotMacro({ slot: 22, ...pocketSlot() }),
      surface: slotMacro({ slot: 22, ...surfacingSlot() }),
    };
    const check = (m) => ({
      on: /M3 S\[#\d+\]/.test(m),          // bracketed var, not S#var (key-7.nc form)
      dwellMs: /G04 P2000\b/.test(m),       // ~2s spin-up; P is MILLISECONDS on Expert (slib-g.nc "P100 //100ms")
      off: /\bM5\b/.test(m),
    });
    return Object.fromEntries(Object.entries(macros).map(([k, m]) => [k, check(m)]));
  });
  for (const op of ['drill', 'slot', 'pocket', 'surface']) {
    expect(r[op].on, `${op}: M3 S[#var]`).toBe(true);
    expect(r[op].dwellMs, `${op}: G04 P ms`).toBe(true);
    expect(r[op].off, `${op}: M5`).toBe(true);
  }
});

test('probe-Z slot: two-pass Z touch down, writes WCS Z so the touch reads as Surface = Z', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { probeZSlot } = await import('/data/probeToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const s = probeZSlot();
    const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
    const seed = new Map(); s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
    const t = new GcodeExecutionEngine({ createVarStore: () => new Map(seed) }).trace(macro);
    const probes = t.segments.filter((g) => g.probe).map((g) => 'Z' + (g.z2 - g.z1 < 0 ? '-' : '+'));
    const lefts = (macro.match(/\[/g) || []).length, rights = (macro.match(/\]/g) || []).length;
    return {
      balanced: lefts === rights, capped: t.stats.capped, probes,
      // WCS Z offset = trigger − surfaceZ, written to the Z slot of the WCS table (#70+2)
      wcsMath: /#50=\[#1927-#\d+\]/.test(macro.replace(/\s/g, '')), writesZ: /#73=\[#70\+2\]/.test(macro.replace(/\s/g, '')),
    };
  });
  expect(r.balanced).toBe(true); expect(r.capped).toBe(false);
  expect(r.probes, 'two-pass Z touch down').toEqual(['Z-', 'Z-']);
  expect(r.wcsMath, 'WCS Z = trigger − surfaceZ').toBe(true);
  expect(r.writesZ, 'writes the Z slot of the WCS table').toBe(true);
});

test('rotateProgram rotates XY + arc I/J about a pivot; tracks partial moves; flags G91', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { rotateProgram } = await import('/data/rotateProgram.js');
    return {
      pt: rotateProgram('G1 X10 Y0 F100', 90).text,
      arc: rotateProgram('G2 X10 Y0 I5 J0', 90).text,
      partial: rotateProgram('G1 X10', 90).text,          // Y implied 0 → both emitted
      pivot: rotateProgram('G0 X5 Y5', 90, 5, 5).text,     // pivot = point → unchanged
      rform: rotateProgram('G3 X10 Y0 R5', 90).text,       // R invariant
      inc: rotateProgram('G91\nG1 X10 Y0', 90).hadIncremental,
      passthru: rotateProgram('G0 Z5\nM3 S8000', 90).text, // no XY → untouched
    };
  });
  expect(r.pt.replace(/\s+/g, ' ')).toContain('X0 Y10');
  expect(r.arc.replace(/\s+/g, ' ')).toContain('X0 Y10 I0 J5');
  expect(r.partial.replace(/\s+/g, ' ')).toContain('X0 Y10');
  expect(r.pivot.replace(/\s+/g, ' '), 'rotating about the point leaves it put').toContain('X5 Y5');
  expect(r.rform).toContain('R5');
  expect(r.inc, 'incremental flagged, not silently mis-rotated').toBe(true);
  expect(r.passthru).toBe('G0 Z5\nM3 S8000');
});

test('mergeEng appends pack params, preserves the eng, and flags collisions', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { mergeEng } = await import('/data/slotPack.js');
    const existing = '#100 -s1"Existing setting" -m1\n#1116 -s1"Community param" -m33\n';
    const additions = '#1100 -p0 =0 -t1 -s1"My field" -s2"mm" -m42 -min=0 -max=10\n#1116 -p0 =0 -t1 -s1"Clash" -m42\n';
    const m = mergeEng(existing, additions);
    return {
      keepsExisting: m.merged.includes('#100 -s1"Existing setting"'),
      appendsNew: m.merged.includes('#1100') && m.merged.indexOf('#1100') > m.merged.indexOf('#100'),
      paramCollisions: m.paramCollisions, groupCollisions: m.groupCollisions, added: m.added,
    };
  });
  expect(r.keepsExisting, 'never replaces the eng').toBe(true);
  expect(r.appendsNew, 'appends new params after existing').toBe(true);
  expect(r.paramCollisions, '#1116 already defined → flagged').toContain(1116);
  expect(r.groupCollisions, 'group m42 is new, m33 belongs to existing → no group clash').toEqual([]);
  expect(r.added, '#1100 is new').toContain(1100);
});

test('auto-icon renders a valid 360x180 BMP from the op name/kind', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { autoIconBmp } = await import('/data/autoIcon.js');
    const url = autoIconBmp('Probe corner', 'corner');
    const bin = atob(url.split(',')[1]);
    const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const rd = (o) => u[o] | (u[o + 1] << 8) | (u[o + 2] << 16) | (u[o + 3] << 24);   // LE int32
    return { isBmp: url.startsWith('data:image/bmp;base64,'), magic: bin.slice(0, 2), w: rd(18), h: rd(22), pocketOk: autoIconBmp('Pocket (rect)', 'pocket').startsWith('data:image/bmp') };
  });
  expect(r.isBmp).toBe(true);
  expect(r.magic, 'BMP signature').toBe('BM');
  expect(r.w, 'width 360').toBe(360);
  expect(r.h, 'height 180').toBe(180);
  expect(r.pocketOk).toBe(true);
});

test('preview panel mounts on a seeded slot macro without throwing', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const ok = await page.evaluate(async () => {
    const { slotFromOp } = await import('/data/opToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/slotPack.js');
    const { createPreviewPanel } = await import('/viz/createPreviewPanel.js');
    const s = slotFromOp('drill', 'grid');
    const macro = slotMacro({ slot: 22, name: s.name, fields: s.fields, body: s.body });
    const seed = new Map();
    s.fields.forEach((f) => seed.set(mirrorVar(f.idx), Number(f.def)));
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;width:400px;height:300px;left:-9999px';
    document.body.appendChild(host);
    const panel = createPreviewPanel(host, { getGcode: () => macro, createVarStore: () => new Map(seed) });
    panel.setActive(true);
    // createPreviewPanel tags the CONTAINER itself and injects its controls/status DOM into it.
    const mounted = host.classList.contains('preview-panel') && !!host.querySelector('.viz3d-controls') && typeof panel.stop === 'function';
    panel.stop(); panel.setActive(false); host.remove();
    return mounted;
  });
  expect(ok, 'createPreviewPanel built its DOM + exposed stop()').toBe(true);
});

test('duplicate a legacy (hand-built) slot remaps its #params off the original — no collision', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    localStorage.setItem('ddcs_campack', JSON.stringify({ meta: { name: 't', baseSlot: 22 }, slots: [{
      slot: 22, name: 'Manual', fields: [
        { idx: 1100, var: '#1', label: 'Depth', units: 'mm', def: 5, min: 0, max: 99, type: 1, key: 'depth' },
        { idx: 1101, var: '#2', label: 'Feed', units: 'mm/min', def: 300, min: 1, max: 9999, type: 0, key: 'feed' },
      ], body: '#1=#2600   ;Depth [mm] =5 [0~99]\n#2=#2601   ;Feed [mm/min] =300 [1~9999]\nG1 Z[0-#1] F#2\nM30' }] }));
    const mod = await import('/ui/macrosApp.js'); mod.initMacrosApp();
    const root = document.getElementById('macros-app');
    root.querySelector('.cam-slot [data-act="dupslot"]').click();   // dupslot is KEPT in the read-mostly display
    // S1 — the settings field-table + macro textarea DOM is gone; assert on the persisted slot DATA instead
    // (the duplicated slot's fields idx + its body) rather than re-reading the removed second-editor UI.
    const pack = JSON.parse(localStorage.getItem('ddcs_campack'));
    const orig = pack.slots[0], clone = pack.slots[1];
    return {
      camNums: pack.slots.map((s) => s.slot),
      origIdx: orig.fields.map((f) => f.idx),
      cloneShares: clone.fields.some((f) => orig.fields.some((g) => g.idx === f.idx)),
      origKeeps2600: /=#2600/.test(orig.body),
      cloneRemapped: /#1=#2602/.test(clone.body),
      calcUntouched: /G1 Z\[0-#1\] F#2/.test(clone.body),
      noCollision: !/⛔/.test(root.querySelector('#cam_validate').textContent),
    };
  });
  expect(r.camNums, 'clone minted the next cam number').toEqual([22, 23]);
  expect(r.origIdx, 'the original params are unchanged').toEqual([1100, 1101]);
  expect(r.cloneShares, 'clone remapped to params disjoint from the original — no collision').toBe(false);
  expect(r.origKeeps2600).toBe(true);
  expect(r.cloneRemapped, 'clone read-line mirror remapped').toBe(true);
  expect(r.calcUntouched, 'working-var calc lines untouched by the remap').toBe(true);
  expect(r.noCollision).toBe(true);
});
