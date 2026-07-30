import { test, expect } from '@playwright/test';

/**
 * CAM Builder S1b — seedFromOp maps a program op to a CAM slot + a seeded expose/bake field table. Asserts (before the
 * S1c UI hides it): right camType incl. the encoded variant forks (t1043 rulings), ALIASED values, DERIVED stepover
 * (== the real wizard), exposed defaults, guard params NON-BAKEABLE, and the unsupported forks.
 */
test('seedFromOp: camType forks + aliased/derived values + non-bakeable guards + unsupported', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { seedFromOp } = await import('/data/opCamMap.js');
    const { stepoverMm } = await import('/wizards/ops/pocketfill.js');
    const { surfacingStack } = await import('/wizards/surfacingWizard.js');
    const op = (opType, params) => ({ opType, params });
    const byKey = (res, k) => (res.fields || []).find((f) => f.key === k);
    const find = (blocks, type) => { for (const b of (blocks || [])) { if (b && b.type === type) return b; const c = find(b.children, type) || find(b.uiChildren, type); if (c) return c; } return null; };

    const P_POCKET = { shape: 'rect', w: 120, h: 90, depth: 5, stepdown: 2, toolDia: 8, feed: 1500, plunge: 120, clearance: 6, rpm: 9000, stepoverPct: 45 };
    const P_SURF = { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 16, feed: 900, plunge: 180, clearance: 5, rpm: 12000, stepoverPct: 60 };
    const P_CORNER = { corner: 'FR', wcs: 'G55', probeZ: true, probeSeq: 'XY', dist: 80, retract: 4, radius: 3, safeZ: 12, travelDist: 40, scanDepth: 6, f_fast: 250, f_slow: 60 };
    const P_DRILL = { method: 'peck', pattern: 'circle', x0: 10, y0: 20, dia: 60, count: 8, startAngle: 15, holeDia: 6.5, depth: 12, peck: 3, feed: 280, clearance: 5, rpm: 8000 };

    const pocket = seedFromOp(op('pocket', P_POCKET));
    const surface = seedFromOp(op('surfacing', P_SURF));
    const corner = seedFromOp(op('corner', P_CORNER));
    const drill = seedFromOp(op('drill', P_DRILL));
    const slot = seedFromOp(op('slot', { ax: 0, ay: 0, bx: 100, by: 0, depth: 8, stepdown: 2, feed: 600, clearance: 5, rpm: 8000, width: 10, toolDia: 6 }));

    // the wizard's ACTUAL absolute stepover for the surface sample. t1361 — the switch retires the `surfacefill`
    // block AND its flat mm socket: `surfaceraster` carries the two knobs the millimetre is DERIVED from, which is
    // the same derivation the macro header does at the machine. So the wizard's mm is read the way the wizard now
    // holds it — as the product — and the assert below still compares the slot against it, unchanged in substance.
    const wizFill = find(surfacingStack(P_SURF), 'surfaceraster');

    return {
      camType: { pocket: pocket.camType, surface: surface.camType, corner: corner.camType, drill: drill.camType, slot: slot.camType,
        middleBoss: seedFromOp(op('middle', { featureType: 'boss', twoAxis: true, wcs: 'G54', dist: 60, retract: 3, f_fast: 200, f_slow: 50 })).camType,
        middleInside: seedFromOp(op('middle', { featureType: 'pocket', findBoth: true, dist: 30, retract: 2 })).camType,
        pocketCircle: seedFromOp(op('pocket', { shape: 'circle', dia: 50, depth: 4, stepdown: 1.5, stepoverPct: 40, toolDia: 6, feed: 600, plunge: 150, clearance: 5, rpm: 8000 })).camType,
        drillHelical: seedFromOp(op('drill', { method: 'helical', pattern: 'circle', holeDia: 12, toolDia: 6, pitch: 0.5, depth: 10, count: 4, dia: 40, startAngle: 0, feed: 200, clearance: 5, rpm: 8000 })).camType,
        // t1089 — 'single' MIGRATED from the unsupported group below. It used to have no slotFromOp pattern (the t1043 S1
        // gap) and fell through to the universal unroll, which was the WORST arm for it: measured at t1087, the universal
        // path cannot expose depth/peck at all (drill.js peckDrill drives a JS while loop → the pecks are unrolled and every
        // Z baked at build). A single hole is a degenerate pattern (count 1 at the anchor), so it is now a declared pattern
        // on the generator and depth/peck are live #2600 knobs. This is also the DEFAULT drill pattern, so it is the common
        // case. The other three entries below stay unsupported — they are genuinely generator-less.
        drillSingle: seedFromOp(op('drill', { method: 'peck', pattern: 'single' })).camType,
        boreSingle: seedFromOp(op('drill', { method: 'helical', pattern: 'single' })).camType },
      unsupported: {
        middleSingle: seedFromOp(op('middle', { featureType: 'pocket', twoAxis: false })).unsupported,
        polygon: seedFromOp(op('pocket', { shape: 'polygon', dia: 50 })).unsupported,
        contour: seedFromOp(op('contour', {})).unsupported,
      },
      val: {
        cornerMaxProbe: byKey(corner, 'maxProbe').value, cornerTravel: byKey(corner, 'travel').value, cornerFast: byKey(corner, 'fast').value,
        cornerSeq: byKey(corner, 'seq').value, cornerCorner: byKey(corner, 'corner').value, cornerRetract: byKey(corner, 'retract').value,
        drillPosX: byKey(drill, 'posX').value, drillDia: byKey(drill, 'dia').value, pocketToolDia: byKey(pocket, 'toolDia').value, surfDepth: byKey(surface, 'depth').value,
        // t1429 — the RECT POCKET's field is the percentage now too (the ruled blocker 2): its clearing body is the
        // raster atom, which composes `#44 = [tool Ø × % / 100]` and had no live-mm path at all, so a dialled mm was
        // DROPPED and 60% used instead. Same restatement t1325 made for the surface arm, for the same reason.
        pocketStepoverPct: byKey(pocket, 'stepoverPct').value,
        pocketStepoverGone: !pocket.fields.some((f) => f.key === 'stepover'),
        // t1325 — the surface field is now the PERCENTAGE (see the restated assert below); its mm is derived in the macro
        surfStepoverPct: byKey(surface, 'stepoverPct').value, surfStepoverGone: !surface.fields.some((f) => f.key === 'stepover'),
        surfToolDia: byKey(surface, 'toolDia').value,
        wizStepover: wizFill && (wizFill.params.toolDia * wizFill.params.stepoverPct / 100), expectPocketStepover: stepoverMm(P_POCKET) },
      bake: {
        cornerCorner: byKey(corner, 'corner').bakeable, cornerSeq: byKey(corner, 'seq').bakeable, cornerRetract: byKey(corner, 'retract').bakeable,
        surfStepdown: byKey(surface, 'stepdown').bakeable, surfDepth: byKey(surface, 'depth').bakeable, drillPosX: byKey(drill, 'posX').bakeable },
      allExposed: corner.fields.every((f) => f.exposed === true),
    };
  });

  // camType incl. the encoded forks
  expect(r.camType).toEqual({ pocket: 'pocket', surface: 'surface', corner: 'corner', drill: 'drill', slot: 'slot',
    middleBoss: 'boss', middleInside: 'inside', pocketCircle: 'cpocket', drillHelical: 'bore',
    drillSingle: 'drill', boreSingle: 'bore' });   // t1089 — 'single' is a generator pattern now, not an unsupported fork
  // unsupported forks
  expect(r.unsupported.middleSingle, 'middle single-axis unsupported').toContain('BOTH-AXIS');
  expect(r.unsupported.polygon, 'pocket polygon unsupported').toContain('no CAM generator');
  expect(r.unsupported.contour, 'contour unsupported').toContain('NO CAM generator');
  // t1089 — drill/bore 'single' is NO LONGER unsupported: it is a declared generator pattern (see the note at its seed
  // above). Asserting the POSITIVE invariant rather than deleting the case, so the suite guards the fix.
  expect(r.camType.drillSingle, 'drill single now seeds the DRILL generator (was: unsupported/universal)').toBe('drill');
  expect(r.camType.boreSingle, 'and a helical single seeds the BORE generator').toBe('bore');
  // aliased values
  expect(r.val.cornerMaxProbe).toBe(80); expect(r.val.cornerTravel).toBe(40); expect(r.val.cornerFast).toBe(250);
  expect(r.val.cornerSeq, 'seq enum XY -> int 1 (S1d)').toBe(1); expect(r.val.cornerCorner, 'corner enum FR -> int 2 (S1d)').toBe(2); expect(r.val.cornerRetract).toBe(4);
  expect(r.val.drillPosX).toBe(10); expect(r.val.drillDia).toBe(60); expect(r.val.pocketToolDia).toBe(8); expect(r.val.surfDepth).toBe(0.8);
  // t1429 — the pocket follows the surface, and the PROPERTY THAT MATTERED survives one step removed, exactly as it
  // did there: the mm field is gone, the intent (45%) is the field, and pct × the tool Ø the slot carries still
  // equals the canonical `stepoverMm` — the same cut, expressed the way the macro re-derives it at the machine.
  expect(r.val.pocketStepoverGone, 'the mm field is gone from the rect pocket generator — the % replaced it').toBe(true);
  expect(r.val.pocketStepoverPct, 'the pocket field is the intent: 45%').toBe(45);
  expect(r.val.pocketToolDia * r.val.pocketStepoverPct / 100, 'NO SILENT RASTER CHANGE — it still cuts stepoverMm(op)').toBe(r.val.expectPocketStepover);
  // t1325 — PREMISE CHANGED BY RULING, restated rather than deleted. This used to assert that the surface generator
  // seeded an absolute stepover in MM equal to the wizard's own (16 · 60% = 9.6). Stepover is now declared as the
  // PERCENTAGE and the mm is derived in the macro header from the two pendant knobs, so that mm is no longer a field
  // at all. The PROPERTY THAT MATTERED — the slot cuts what the wizard cuts — survives exactly, one step removed:
  // the pct times the tool Ø still equals the wizard's mm.
  expect(r.val.surfStepoverGone, 'the mm field is gone from the surface generator — the % replaced it').toBe(true);
  expect(r.val.surfStepoverPct, 'the surface field is the intent: 60%').toBe(60);
  expect(r.val.surfToolDia * r.val.surfStepoverPct / 100, 'and it still resolves to the actual surfacingStack value').toBe(r.val.wizStepover);
  expect(r.val.surfToolDia * r.val.surfStepoverPct / 100, 'which is 16*60/100 = 9.6, the number this assert has always guarded').toBe(9.6);
  // exposed defaults + NON-BAKEABLE guards
  expect(r.allExposed).toBe(true);
  expect(r.bake.cornerCorner, 'choice params ARE bakeable now (t1047 amend)').toBe(true); expect(r.bake.cornerSeq).toBe(true); expect(r.bake.cornerRetract).toBe(true);
  expect(r.bake.surfStepdown).toBe(false); expect(r.bake.surfDepth).toBe(true); expect(r.bake.drillPosX).toBe(true);
});

// t1047 amend — bake-safety: a CHOICE param baked to a valid literal must produce VALID G-code (it appears only in IF
// conditions / #var assignments, never as a GOTO/label target, so it CONSTANT-FOLDS). Verified per generator.
test('S1d bake-safety: choice params constant-fold to valid G-code when baked', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const CASES = [
    { gen: 'corner', key: 'corner', value: 1, read: 'Corner', folded: 'IF 1 EQ 2' },
    { gen: 'corner', key: 'seq', value: 1, read: 'Wall order', folded: 'IF 1 EQ 1 GOTO' },
    { gen: 'corner', key: 'wcs', value: 2, read: 'WCS', folded: '#71=2' },
    { gen: 'corner', key: 'probeZ', value: 1, read: 'Probe Z', folded: 'IF 1 EQ 0 GOTO' },
    { gen: 'edge', key: 'axis', value: 1, read: 'Axis', folded: 'IF 1 EQ 1 GOTO' },
    { gen: 'edge', key: 'dir', value: 1, read: 'Direction', folded: 'IF 1 EQ 1 THEN' },
  ];
  const r = await page.evaluate(async (CASES) => {
    const { cornerSlot, edgeSlot } = await import('/data/probeToSlot.js');
    const GEN = { corner: cornerSlot, edge: edgeSlot };
    return CASES.map((c) => {
      const body = GEN[c.gen](new Set(), 0, '', { [c.key]: { exposed: false, value: c.value } }).body;
      return { key: c.key, noRead: !new RegExp(';\s*' + c.read).test(body), validEnd: /\bM30\b/.test(body), folded: body.includes(c.folded), labelsIntact: /N10\b/.test(body) || /N20\b/.test(body) };
    });
  }, CASES);
  for (const x of r) {
    expect(x.noRead, `${x.key}: baked read line vanishes`).toBe(true);
    expect(x.folded, `${x.key}: the literal constant-folds into the IF/assignment`).toBe(true);
    expect(x.validEnd, `${x.key}: macro still ends M30 (structurally valid)`).toBe(true);
    expect(x.labelsIntact, `${x.key}: GOTO-target labels survive (choice is not a label target)`).toBe(true);
  }
});

// t1049 FIX #1 — real programs are built from DATA-OP TWINS (user_*_data), not built-in optypes. camTypeOf/isCamableType/
// seedFromOp must recognize + seed them via the declared opensAs bridge, with twin-aware param handling (surfacing flat
// stepover, corner probeZFirst, bore variant). The built-in path must still work (covered by the tests above).
test('S1 fix: data-op TWINS are CAM-able and seed correct values', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { seedFromOp, isCamableType } = await import('/data/opCamMap.js');
    const op = (opType, params) => ({ opType, params });
    const byKey = (res, k) => (res.fields || []).find((f) => f.key === k);
    // twin op.params keyed by the binding PARAM names (grounded from a runtime dump of the twin defs)
    const surf = seedFromOp(op('user_surfacing_data', { originX: 0, originY: 0, w: 200, h: 150, depth: 0.8, stepdown: 0.4, stepover: 9.6, strategy: 'parallel', feed: 900, plunge: 180, rpm: 12000, wcs: 'G54' }));
    const pocket = seedFromOp(op('user_pocket_data', { shape: 'rect', w: 120, h: 90, depth: 5, stepdown: 2, stepoverPct: 45, toolDia: 8, clearance: 6, feed: 1500, plunge: 120, rpm: 9000, originX: 0, originY: 0, wcs: 'active' }));
    const corner = seedFromOp(op('user_corner_data', { corner: 'FR', wcs: 'G55', probeZFirst: true, probeSeq: 'XY', dist: 80, retract: 4, radius: 3, safeZ: 12, travelDist: 40, scanDepth: 6, f_fast: 250, f_slow: 60 }));
    const bore = seedFromOp(op('user_bore_data', { pattern: 'grid', x0: 0, y0: 0, originX: 40, originY: 25, cols: 3, rows: 2, dx: 20, dy: 20, holeDia: 12, toolDia: 6, pitch: 0.5, depth: 10, feed: 200, rpm: 8000 }));
    return {
      camable: { surf: isCamableType('user_surfacing_data'), pocket: isCamableType('user_pocket_data'), corner: isCamableType('user_corner_data'), bore: isCamableType('user_bore_data'), contour: isCamableType('user_contour_data') },
      camType: { surf: surf.camType, pocket: pocket.camType, corner: corner.camType, bore: bore.camType },
      contourUniversal: !!seedFromOp(op('user_contour_data', {})).universal,   // U2 — the contour twin now routes to the universal unroll path (has a def to unroll)
      surf: { stepoverPct: byKey(surf, 'stepoverPct').value, toolDia: byKey(surf, 'toolDia').value, depth: byKey(surf, 'depth').value, w: byKey(surf, 'w').value },
      pocket: { stepoverPct: byKey(pocket, 'stepoverPct').value, toolDia: byKey(pocket, 'toolDia').value, depth: byKey(pocket, 'depth').value },
      corner: { corner: byKey(corner, 'corner').value, probeZ: byKey(corner, 'probeZ').value, wcs: byKey(corner, 'wcs').value, maxProbe: byKey(corner, 'maxProbe').value },
      bore: { holeDia: byKey(bore, 'holeDia').value, posX: byKey(bore, 'posX').value, camType: bore.camType },
    };
  });
  // the FIX: twins are CAM-able. U2 — contour (no dedicated generator) is now CAM-able too, via the universal unroll path.
  expect(r.camable).toEqual({ surf: true, pocket: true, corner: true, bore: true, contour: true });
  expect(r.camType).toEqual({ surf: 'surface', pocket: 'pocket', corner: 'corner', bore: 'bore' });
  expect(r.contourUniversal, 'contour twin now CAM-able via the universal path (no generator → unroll)').toBe(true);
  // surfacing twin: t1325 — PREMISE CHANGED BY RULING, restated. The twin still stores a FLAT mm (9.6) and has no
  // toolDia at all; the generator's field is now a PERCENTAGE. So the seed RECOVERS the pct against the tool Ø the
  // slot will carry (the generator default, Ø12) — and the cut is byte-for-byte the same one it always was, which is
  // what this assert has always been about: 9.6mm of stepover.
  expect(r.surf.stepoverPct, 'the twin’s flat 9.6mm recovers as 80% of the Ø12 the slot carries').toBe(80);
  expect(r.surf.toolDia * r.surf.stepoverPct / 100, 'NO SILENT RASTER CHANGE — it still cuts 9.6mm').toBe(9.6);
  expect(r.surf.depth).toBe(0.8); expect(r.surf.w).toBe(200);
  // pocket twin: t1429 — the twin already STORES the percentage, so the seed reads its intent straight through the
  // one source instead of pre-multiplying it into a millimetre the atom would only divide back out. Same 3.6mm cut.
  expect(r.pocket.stepoverPct, 'pocket twin seeds its own 45%').toBe(45);
  expect(r.pocket.toolDia * r.pocket.stepoverPct / 100, 'which is the 8·45% = 3.6mm it always cut').toBe(3.6);
  expect(r.pocket.toolDia).toBe(8); expect(r.pocket.depth).toBe(5);
  // corner twin: probeZ read from probeZFirst; enums -> ints
  expect(r.corner.corner, 'FR -> 2').toBe(2);
  expect(r.corner.probeZ, 'probeZ read from twin probeZFirst -> Yes -> 1').toBe(1);
  expect(r.corner.wcs, 'G55 -> 2').toBe(2); expect(r.corner.maxProbe, 'dist -> 80').toBe(80);
  // bore twin: resolved via the inverted variant (no method param); posX = the PLACED position (originX), not x0
  expect(r.bore.holeDia).toBe(12); expect(r.bore.posX, 'bore twin posX = the placed originX 40, not x0').toBe(40);
});

// t1051 HARDENING — the other 4 CAM-able twins (edge/slot/drill/middle inside+boss) driven through seedFromOp against
// their REAL twin values (the exact "tested-the-built-in-not-the-twin" gap that let FIX #1 through), + the drill/bore
// PLACEMENT fix: posX/posY = the op's placed originX/originY, not the pattern-local x0/y0 (default 0).
test('S1 fix hardening: edge/slot/drill/middle twins seeded + drill placement sources originX', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { seedFromOp } = await import('/data/opCamMap.js');
    const op = (opType, params) => ({ opType, params });
    const byKey = (res, k) => (res.fields || []).find((f) => f.key === k);
    const edge = seedFromOp(op('user_edge_data', { axis: 'Y', dir: 'neg', wcs: 'G56', dist: 60, retract: 3, radius: 2, f_fast: 200, f_slow: 40 }));
    const slot = seedFromOp(op('user_slot_data', { ax: 5, ay: 10, bx: 105, by: 10, depth: 8, stepdown: 2, feed: 600, rpm: 8000, toolDia: 6, width: 10 }));
    const drill = seedFromOp(op('user_drill_data', { pattern: 'grid', x0: 0, y0: 0, originX: 100, originY: 50, cols: 3, rows: 2, dx: 20, dy: 20, depth: 12, peck: 3, feed: 280, rpm: 8000 }));
    const inside = seedFromOp(op('user_middle_data', { featureType: 'pocket', twoAxis: true, wcs: 'G54', dist: 30, retract: 2, radius: 2, f_fast: 200, f_slow: 50 }));
    const boss = seedFromOp(op('user_middle_data', { featureType: 'boss', twoAxis: true, wcs: 'G55', dist: 60, retract: 3, radius: 2, f_fast: 200, f_slow: 50 }));
    return {
      camType: { edge: edge.camType, slot: slot.camType, drill: drill.camType, inside: inside.camType, boss: boss.camType },
      edge: { axis: byKey(edge, 'axis').value, dir: byKey(edge, 'dir').value, wcs: byKey(edge, 'wcs').value, maxProbe: byKey(edge, 'maxProbe').value },
      slot: { ax: byKey(slot, 'ax').value, bx: byKey(slot, 'bx').value, depth: byKey(slot, 'depth').value, feed: byKey(slot, 'feed').value },
      drill: { posX: byKey(drill, 'posX').value, posY: byKey(drill, 'posY').value, cols: byKey(drill, 'cols').value, depth: byKey(drill, 'depth').value },
      inside: { wcs: byKey(inside, 'wcs').value, maxProbe: byKey(inside, 'maxProbe').value },
      boss: { wcs: byKey(boss, 'wcs').value },
    };
  });
  expect(r.camType).toEqual({ edge: 'edge', slot: 'slot', drill: 'drill', inside: 'inside', boss: 'boss' });
  // edge twin: enums -> ints (Y=1, neg=1, G56=3), maxProbe <- dist
  expect(r.edge.axis).toBe(1); expect(r.edge.dir).toBe(1); expect(r.edge.wcs).toBe(3); expect(r.edge.maxProbe).toBe(60);
  // slot twin: identity keys
  expect(r.slot.ax).toBe(5); expect(r.slot.bx).toBe(105); expect(r.slot.depth).toBe(8); expect(r.slot.feed).toBe(600);
  // drill twin PLACEMENT fix: posX/posY = the placed originX/originY (100/50), NOT the pattern-local x0/y0 (0)
  expect(r.drill.posX, 'drill posX = placed originX 100 (not x0=0)').toBe(100);
  expect(r.drill.posY, 'drill posY = placed originY 50').toBe(50);
  expect(r.drill.cols).toBe(3); expect(r.drill.depth).toBe(12);
  // middle -> inside/boss (both-axis); wcs enum + maxProbe<-dist
  expect(r.inside.wcs, 'G54 -> 1').toBe(1); expect(r.inside.maxProbe).toBe(30);
  expect(r.boss.wcs, 'G55 -> 2').toBe(2);
});
