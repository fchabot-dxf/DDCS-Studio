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
