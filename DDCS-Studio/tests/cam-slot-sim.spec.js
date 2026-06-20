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
    const { slotMacro, mirrorVar } = await import('/data/camPack.js');
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
    const { slotMacro, mirrorVar } = await import('/data/camPack.js');
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
    const { slotMacro, mirrorVar } = await import('/data/camPack.js');
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
    const { slotMacro, mirrorVar } = await import('/data/camPack.js');
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
    const { slotMacro, mirrorVar } = await import('/data/camPack.js');
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
    const { slotMacro, mirrorVar } = await import('/data/camPack.js');
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
    const { slotMacro, mirrorVar } = await import('/data/camPack.js');
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

test('surfacing slot: rasters the full area with no inset and no wall pass', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { surfacingSlot } = await import('/data/millToSlot.js');
    const { slotMacro, mirrorVar } = await import('/data/camPack.js');
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

test('cutting slots manage the spindle with the proven Expert forms (M3 S[#var], G04 P ms, M5)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { slotFromOp } = await import('/data/opToSlot.js');
    const { pocketSlot, surfacingSlot } = await import('/data/millToSlot.js');
    const { slotMacro } = await import('/data/camPack.js');
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
    const { slotMacro, mirrorVar } = await import('/data/camPack.js');
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
