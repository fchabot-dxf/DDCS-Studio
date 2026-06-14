import { test, expect } from '@playwright/test';

// "View as blocks": a STUDIO PocketWizard converts to the StepDown{ StepOver(Region) [+ Wall] } atom stack,
// and the emitted CUTTING PASSES (G1/G2/G3) are byte-identical to the wizard — the pocket analogue of
// drill = array(bore). Proven for raster-rect / concentric-rect / concentric-circle (the wizard's
// raster-circle G3 arc-finish is wizard chrome and intentionally not reproduced — see fromWizard.js).
test('pocket wizard == StepDown{StepOver(Region)+Wall} atom stack (cutting passes match)', async ({ page }) => {
  await page.goto('http://localhost:3211/blocks/blockly/dev.html');

  const results = await page.evaluate(async () => {
    const { emitMapped } = await import('/blocks/blockModel.js');
    const { pocketToBlocks } = await import('/blocks/fromWizard.js');
    const { PocketWizard } = await import('/wizards/pocketWizard.js');
    const wiz = new PocketWizard();
    const cuts = (txt) => txt.split('\n').map((s) => s.trim()).filter((l) => /^G[123]\b/.test(l));
    const cases = [
      { name: 'rect raster',       p: { shape: 'rect',   w: 80, h: 60, toolDia: 6, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5, strategy: 'raster' } },
      { name: 'rect concentric',   p: { shape: 'rect',   w: 80, h: 60, toolDia: 6, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5, strategy: 'spiral' } },
      { name: 'circle concentric', p: { shape: 'circle', dia: 50,      toolDia: 6, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5, strategy: 'spiral' } },
    ];
    return cases.map((c) => {
      const w = cuts(wiz.generate(c.p)), b = cuts(emitMapped(pocketToBlocks(c.p), {}).text);
      return { name: c.name, wlen: w.length, blen: b.length, same: w.length === b.length && w.every((l, i) => l === b[i]) };
    });
  });

  for (const r of results) {
    expect(r.wlen, `${r.name} should have cutting passes`).toBeGreaterThan(0);
    expect(r.same, `${r.name}: wizard ${r.wlen} cuts vs blocks ${r.blen} cuts`).toBe(true);
  }
});

// Slot is a self-contained leaf (depth baked in, like Line) sharing the slotPath kernel with SlotWizard,
// so the toolpath is identical — straight/narrow/angled.
test('slot wizard == Slot atom (cutting passes match)', async ({ page }) => {
  await page.goto('http://localhost:3211/blocks/blockly/dev.html');
  const results = await page.evaluate(async () => {
    const { emitMapped } = await import('/blocks/blockModel.js');
    const { slotToBlocks } = await import('/blocks/fromWizard.js');
    const { SlotWizard } = await import('/wizards/slotWizard.js');
    const wiz = new SlotWizard();
    const cuts = (txt) => txt.split('\n').map((s) => s.trim()).filter((l) => /^G[123]\b/.test(l));
    const cases = [
      { name: 'straight wide',  p: { ax: 0, ay: 0, bx: 60, by: 0,  toolDia: 6, width: 14, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5 } },
      { name: 'narrow (=tool)', p: { ax: 0, ay: 0, bx: 50, by: 0,  toolDia: 6, width: 6,  stepoverPct: 40, depth: 3, stepdown: 1.0, feed: 600, plunge: 150, clearance: 5 } },
      { name: 'angled wide',    p: { ax: 10, ay: 5, bx: 70, by: 40, toolDia: 6, width: 12, stepoverPct: 50, depth: 6, stepdown: 2.0, feed: 500, plunge: 120, clearance: 5 } },
    ];
    return cases.map((c) => {
      const w = cuts(wiz.generate(c.p)), b = cuts(emitMapped(slotToBlocks(c.p), {}).text);
      return { name: c.name, wlen: w.length, blen: b.length, same: w.length === b.length && w.every((l, i) => l === b[i]) };
    });
  });
  for (const r of results) {
    expect(r.wlen, `${r.name} should have cutting passes`).toBeGreaterThan(0);
    expect(r.same, `${r.name}: wizard ${r.wlen} cuts vs blocks ${r.blen} cuts`).toBe(true);
  }
});

// Surfacing converts the same way: StepDown{ StepOver(Region) } with NO radius inset (the area is the
// tool-centre sweep) and no wall pass. Cutting passes match for raster + concentric.
test('surfacing wizard == StepDown{StepOver(Region)} atom stack (cutting passes match)', async ({ page }) => {
  await page.goto('http://localhost:3211/blocks/blockly/dev.html');

  const results = await page.evaluate(async () => {
    const { emitMapped } = await import('/blocks/blockModel.js');
    const { surfacingToBlocks } = await import('/blocks/fromWizard.js');
    const { SurfacingWizard } = await import('/wizards/surfacingWizard.js');
    const wiz = new SurfacingWizard();
    const cuts = (txt) => txt.split('\n').map((s) => s.trim()).filter((l) => /^G[123]\b/.test(l));
    const cases = [
      { name: 'surface raster',     p: { w: 100, h: 80, toolDia: 12, stepoverPct: 60, depth: 0.5, stepdown: 0.5, feed: 800, plunge: 200, clearance: 5, strategy: 'raster' } },
      { name: 'surface concentric', p: { w: 100, h: 80, toolDia: 12, stepoverPct: 60, depth: 1.0, stepdown: 0.5, feed: 800, plunge: 200, clearance: 5, strategy: 'spiral' } },
    ];
    return cases.map((c) => {
      const w = cuts(wiz.generate(c.p)), b = cuts(emitMapped(surfacingToBlocks(c.p), {}).text);
      return { name: c.name, wlen: w.length, blen: b.length, same: w.length === b.length && w.every((l, i) => l === b[i]) };
    });
  });

  for (const r of results) {
    expect(r.wlen, `${r.name} should have cutting passes`).toBeGreaterThan(0);
    expect(r.same, `${r.name}: wizard ${r.wlen} cuts vs blocks ${r.blen} cuts`).toBe(true);
  }
});
