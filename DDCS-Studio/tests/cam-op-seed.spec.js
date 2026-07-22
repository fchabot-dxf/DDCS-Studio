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

    // the wizard's ACTUAL absolute stepover for the surface sample (the surfacefill block's stepover param)
    const wizFill = find(surfacingStack(P_SURF), 'surfacefill');

    return {
      camType: { pocket: pocket.camType, surface: surface.camType, corner: corner.camType, drill: drill.camType, slot: slot.camType,
        middleBoss: seedFromOp(op('middle', { featureType: 'boss', twoAxis: true, wcs: 'G54', dist: 60, retract: 3, f_fast: 200, f_slow: 50 })).camType,
        middleInside: seedFromOp(op('middle', { featureType: 'pocket', findBoth: true, dist: 30, retract: 2 })).camType,
        pocketCircle: seedFromOp(op('pocket', { shape: 'circle', dia: 50, depth: 4, stepdown: 1.5, stepoverPct: 40, toolDia: 6, feed: 600, plunge: 150, clearance: 5, rpm: 8000 })).camType,
        drillHelical: seedFromOp(op('drill', { method: 'helical', pattern: 'circle', holeDia: 12, toolDia: 6, pitch: 0.5, depth: 10, count: 4, dia: 40, startAngle: 0, feed: 200, clearance: 5, rpm: 8000 })).camType },
      unsupported: {
        middleSingle: seedFromOp(op('middle', { featureType: 'pocket', twoAxis: false })).unsupported,
        polygon: seedFromOp(op('pocket', { shape: 'polygon', dia: 50 })).unsupported,
        contour: seedFromOp(op('contour', {})).unsupported,
        drillSingle: seedFromOp(op('drill', { method: 'peck', pattern: 'single' })).unsupported },
      val: {
        cornerMaxProbe: byKey(corner, 'maxProbe').value, cornerTravel: byKey(corner, 'travel').value, cornerFast: byKey(corner, 'fast').value,
        cornerSeq: byKey(corner, 'seq').value, cornerCorner: byKey(corner, 'corner').value, cornerRetract: byKey(corner, 'retract').value,
        drillPosX: byKey(drill, 'posX').value, drillDia: byKey(drill, 'dia').value, pocketToolDia: byKey(pocket, 'toolDia').value, surfDepth: byKey(surface, 'depth').value,
        pocketStepover: byKey(pocket, 'stepover').value, surfStepover: byKey(surface, 'stepover').value,
        wizStepover: wizFill && wizFill.params.stepover, expectPocketStepover: stepoverMm(P_POCKET) },
      bake: {
        cornerCorner: byKey(corner, 'corner').bakeable, cornerSeq: byKey(corner, 'seq').bakeable, cornerRetract: byKey(corner, 'retract').bakeable,
        surfStepdown: byKey(surface, 'stepdown').bakeable, surfDepth: byKey(surface, 'depth').bakeable, drillPosX: byKey(drill, 'posX').bakeable },
      allExposed: corner.fields.every((f) => f.exposed === true),
    };
  });

  // camType incl. the encoded forks
  expect(r.camType).toEqual({ pocket: 'pocket', surface: 'surface', corner: 'corner', drill: 'drill', slot: 'slot',
    middleBoss: 'boss', middleInside: 'inside', pocketCircle: 'cpocket', drillHelical: 'bore' });
  // unsupported forks
  expect(r.unsupported.middleSingle, 'middle single-axis unsupported').toContain('BOTH-AXIS');
  expect(r.unsupported.polygon, 'pocket polygon unsupported').toContain('no CAM generator');
  expect(r.unsupported.contour, 'contour unsupported').toContain('NO CAM generator');
  expect(r.unsupported.drillSingle, 'drill single unsupported').toContain('single');
  // aliased values
  expect(r.val.cornerMaxProbe).toBe(80); expect(r.val.cornerTravel).toBe(40); expect(r.val.cornerFast).toBe(250);
  expect(r.val.cornerSeq).toBe('XY'); expect(r.val.cornerCorner).toBe('FR'); expect(r.val.cornerRetract).toBe(4);
  expect(r.val.drillPosX).toBe(10); expect(r.val.drillDia).toBe(60); expect(r.val.pocketToolDia).toBe(8); expect(r.val.surfDepth).toBe(0.8);
  // DERIVED stepover == the real wizard value (surface) + the canonical stepoverMm (pocket)
  expect(r.val.surfStepover, 'surface stepover == the actual surfacingStack value').toBe(r.val.wizStepover);
  expect(r.val.surfStepover, 'surface stepover = 16*60/100 = 9.6').toBe(9.6);
  expect(r.val.pocketStepover, 'pocket stepover == stepoverMm(op)').toBe(r.val.expectPocketStepover);
  // exposed defaults + NON-BAKEABLE guards
  expect(r.allExposed).toBe(true);
  expect(r.bake.cornerCorner).toBe(false); expect(r.bake.cornerSeq).toBe(false); expect(r.bake.cornerRetract).toBe(true);
  expect(r.bake.surfStepdown).toBe(false); expect(r.bake.surfDepth).toBe(true); expect(r.bake.drillPosX).toBe(true);
});
