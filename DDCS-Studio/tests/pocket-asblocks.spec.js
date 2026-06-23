import { test, expect } from '@playwright/test';

// The cutting wizards are REWRITTEN as block stacks — one implementation each (generate() emits its stack
// through emitMapped, no converter). Verify each is deterministic (regenerate → byte-identical) and produces
// real cutting passes, plus behaviour checks: circle pocket finishes with a G3 arc wall, a tiny pocket falls
// back to a single plunge, and drill `skip` omits holes.
test('cutting wizards emit through their block stacks (deterministic + correct)', async ({ page }) => {
  await page.goto('http://localhost:3211/blocks/blockly/dev.html');
  const r = await page.evaluate(async () => {
    const { SurfacingWizard } = await import('/wizards/surfacingWizard.js');
    const { PocketWizard } = await import('/wizards/pocketWizard.js');
    const { SlotWizard } = await import('/wizards/slotWizard.js');
    const { DrillWizard } = await import('/wizards/drillWizard.js');
    const cuts = (t) => t.split('\n').filter((l) => /^G[123]\b/.test(l.trim())).length;
    const det = (W, p) => new W().generate(p) === new W().generate(p);
    const holes = (t) => (t.match(/Array \d+ @/g) || []).length;
    const out = {};

    const sp = { w: 100, h: 80, toolDia: 12, stepoverPct: 60, depth: 0.5, stepdown: 0.5, feed: 800, plunge: 200, clearance: 5, strategy: 'raster' };
    out.surfacing = { det: det(SurfacingWizard, sp), cuts: cuts(new SurfacingWizard().generate(sp)) };

    const pp = { shape: 'rect', w: 80, h: 60, toolDia: 6, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5, strategy: 'raster' };
    out.pocket = { det: det(PocketWizard, pp), cuts: cuts(new PocketWizard().generate(pp)) };

    const pc = { shape: 'circle', dia: 50, toolDia: 6, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5, strategy: 'raster' };
    out.pocketCircleArc = /G3 /.test(new PocketWizard().generate(pc));
    const tiny = { shape: 'circle', dia: 4, toolDia: 6, depth: 3, stepdown: 1, feed: 600, plunge: 150, clearance: 5 };
    const tinyTxt = new PocketWizard().generate(tiny);
    out.pocketTinyGuard = /G1 Z-3/.test(tinyTxt) && !/G3 /.test(tinyTxt);

    const sl = { ax: 0, ay: 0, bx: 60, by: 0, toolDia: 6, width: 14, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5 };
    out.slot = { det: det(SlotWizard, sl), cuts: cuts(new SlotWizard().generate(sl)) };

    const dr = { pattern: 'grid', x0: 0, y0: 0, cols: 3, rows: 2, dx: 20, dy: 20, depth: 5, peck: 2, feed: 100, clearance: 5 };
    out.drill = { det: det(DrillWizard, dr), holes: holes(new DrillWizard().generate(dr)), cuts: cuts(new DrillWizard().generate(dr)) };
    out.drillSkip = holes(new DrillWizard().generate({ ...dr, skip: '2,5' }));
    return out;
  });

  for (const k of ['surfacing', 'pocket', 'slot', 'drill']) {
    expect(r[k].det, `${k} must be deterministic`).toBe(true);
    expect(r[k].cuts, `${k} must produce cutting passes`).toBeGreaterThan(0);
  }
  expect(r.pocketCircleArc, 'circle pocket finishes with a G3 arc wall').toBe(true);
  expect(r.pocketTinyGuard, 'tiny pocket falls back to a single plunge (no arc)').toBe(true);
  expect(r.drill.holes, 'drill grid 3x2 = 6 holes').toBe(6);
  expect(r.drillSkip, 'skip 2,5 → 4 holes').toBe(4);
});
