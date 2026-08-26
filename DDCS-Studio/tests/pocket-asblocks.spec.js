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
    const { traceToolpath } = await import('/engine/trace.js');
    const cuts = (t) => t.split('\n').filter((l) => /^G[123]\b/.test(l.trim())).length;
    const det = (W, p) => new W().generate(p) === new W().generate(p);
    /**
     * t1385 — COUNT THE HOLES DRILLED, not the `( Array N @ … )` STAMP COMMENTS.
     *
     * The old count read those comments, which the `array` CONTAINER emitted once per stamped point. The switch folded the
     * pattern into `holecycle`, which walks it at runtime: there is no per-hole comment, so the count read 0 for every
     * pattern — including the `skip` case, which made "skip omits holes" pass against 0 === 0.
     *
     * A hole is now counted where it is real: a DISTINCT XY position at which the traced path cuts DOWNWARD. That survives
     * however the pattern is spelled, and it is what the assert always meant.
     */
    const holes = (t) => {
        const segs = traceToolpath(t).segments || [];
        const at = new Set();
        for (const s of segs) if (!s.rapid && s.z2 < s.z1) at.add(`${(+s.x2.toFixed(3)) + 0},${(+s.y2.toFixed(3)) + 0}`);
        return at.size;
    };
    const out = {};

    const sp = { w: 100, h: 80, toolDia: 12, stepoverPct: 60, depth: 0.5, stepdown: 0.5, feed: 800, plunge: 200, clearance: 5, strategy: 'raster' };
    out.surfacing = { det: det(SurfacingWizard, sp), cuts: cuts(new SurfacingWizard().generate(sp)) };

    const pp = { shape: 'rect', w: 80, h: 60, toolDia: 6, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5, strategy: 'raster' };
    out.pocket = { det: det(PocketWizard, pp), cuts: cuts(new PocketWizard().generate(pp)) };

    const pc = { shape: 'circle', dia: 50, toolDia: 6, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5, strategy: 'raster' };
    out.pocketCircleArc = /G3 /.test(new PocketWizard().generate(pc));

    /**
     * t1391 — THE TOO-SMALL FALLBACK NOW GOES THROUGH holecycle, so its plunge is an EXPRESSION, not a baked depth.
     *
     * This asserted `/G1 Z-3/` — a literal negative depth. Pocket's too-small arm re-points through the parametric family
     * (so `drill.js` could retire), which seeds the depth into a register (`#81=3`) and feeds against it
     * (`G1 Z[0 - #83] F150`). The CLAIM is unchanged — a pocket narrower than its tool becomes a single plunge with no arc
     * wall — so it is asserted where that is now visible: one hole in the parametric header, the depth reaching the
     * register, a Z FEED move driven by a register, and still no arc.
     *
     * ⚠ t1444 — THE SAMPLE MOVED FROM Ø4 TO Ø6, and the reason is the whole of the user's ruling. A Ø4 pocket asked of
     * a Ø6 tool is STRICTLY SMALLER: it now refuses with no motion, because the plunge it used to emit made a Ø6 hole
     * where Ø4 was asked. The plunge ARM is unchanged and still shipping — for a pocket the tool EXACTLY fills — so
     * the sample is the equal case and the claim it carries is untouched. The refusal gets its own assertion below
     * rather than replacing this one: retiring live coverage of a shipping arm to make a red test pass is how an arm
     * stops being tested at all.
     */
    const tiny = { shape: 'circle', dia: 6, toolDia: 6, depth: 3, stepdown: 1, feed: 600, plunge: 150, clearance: 5 };
    const tinyTxt = new PocketWizard().generate(tiny);
    const refuseTxt = new PocketWizard().generate({ ...tiny, dia: 4 });   // t1444 — strictly smaller: no motion at all
    out.pocketRefuse = { says: /cannot fit/.test(refuseTxt), flags: /#1505=1/.test(refuseTxt), noMotion: !/^\s*G[0-9]+\s+[XY]/m.test(refuseTxt) };
    // t2305 — the header used to nest `(single)` inside the comment's own outer `( … )`, invalid G-code
    // (DDCS closes at the first `)`); fixed at the emitter (holecycle.js) by replacing the nesting with `:`.
    const tinyHeader = /parametric: 1 hole: single x peck/.test(tinyTxt);
    const tinyDepthSeed = /^#81=3/m.test(tinyTxt);
    const tinyZFeed = /G1 Z\[[^\]]*#\d+[^\]]*\] F/.test(tinyTxt);
    const tinyNoArc = !/G3 /.test(tinyTxt);
    out.pocketTiny = { tinyHeader, tinyDepthSeed, tinyZFeed, tinyNoArc };

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
  // Asserted PART BY PART rather than as one boolean: a composed `a && b && c` reports only "false" and says nothing
  // about which half of the claim broke, which cost real time when this assert first went red at t1391.
  expect(r.pocketRefuse, 't1444 — a pocket STRICTLY smaller than its tool refuses: the reason, the flag, and NO motion')
    .toEqual({ says: true, flags: true, noMotion: true });
  expect(r.pocketTiny, 'an EXACTLY tool-sized pocket still falls back to a single parametric plunge, no arc (t1391: through holecycle)').toEqual({
    tinyHeader: true, tinyDepthSeed: true, tinyZFeed: true, tinyNoArc: true,
  });
  expect(r.drill.holes, 'drill grid 3x2 = 6 holes').toBe(6);
  expect(r.drillSkip, 'skip 2,5 → 4 holes').toBe(4);
});
