import { test, expect } from '@playwright/test';

/**
 * CAM Builder S1b — seedFromOp maps a program op to a CAM slot + a seeded expose/bake field table. Asserts (before the
 * S1c UI hides it): right camType, ALIASED values (bare op.params -> generator field key), exposed defaults, guard
 * params NON-BAKEABLE, and the gated/unsupported forks (contour / middle / pocket-circle / drill-helical).
 */
test('seedFromOp: camType + aliased values + non-bakeable guards + gated forks', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { seedFromOp } = await import('/data/opCamMap.js');
    const op = (opType, params) => ({ opType, params });
    const byKey = (res, k) => (res.fields || []).find((f) => f.key === k);

    return {
      pocket: seedFromOp(op('pocket', { shape: 'rect', w: 120, h: 90, depth: 5, stepdown: 2, toolDia: 8, feed: 1500, plunge: 120, clearance: 6, rpm: 9000, stepoverPct: 45 })),
      surface: seedFromOp(op('surfacing', { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 16, feed: 900, plunge: 180, clearance: 5, rpm: 12000, stepoverPct: 60 })),
      corner: seedFromOp(op('corner', { corner: 'FR', wcs: 'G55', probeZ: true, probeSeq: 'XY', dist: 80, retract: 4, radius: 3, safeZ: 12, travelDist: 40, scanDepth: 6, f_fast: 250, f_slow: 60 })),
      drill: seedFromOp(op('drill', { method: 'peck', pattern: 'circle', x0: 10, y0: 20, dia: 60, count: 8, startAngle: 15, holeDia: 6.5, depth: 12, peck: 3, feed: 280, clearance: 5, rpm: 8000 })),
      slot: seedFromOp(op('slot', { ax: 0, ay: 0, bx: 100, by: 0, depth: 8, stepdown: 2, feed: 600, clearance: 5, rpm: 8000, width: 10, toolDia: 6 })),
      contour: seedFromOp(op('contour', {})),
      middle: seedFromOp(op('middle', { featureType: 'boss' })),
      pocketCircle: seedFromOp(op('pocket', { shape: 'circle', dia: 50, depth: 4 })),
      drillHelical: seedFromOp(op('drill', { method: 'helical', pattern: 'circle', holeDia: 12 })),
      _byKey: null,   // (helper used below via re-eval)
      pick: {
        pocket: { toolDia: byKey(seedFromOp(op('pocket', { shape: 'rect', w: 120, h: 90, depth: 5, stepdown: 2, toolDia: 8, feed: 1500, plunge: 120, clearance: 6, rpm: 9000, stepoverPct: 45 })), 'toolDia'),
                  stepover: byKey(seedFromOp(op('pocket', { shape: 'rect', w: 120, h: 90, depth: 5, stepdown: 2, toolDia: 8, feed: 1500, plunge: 120, clearance: 6, rpm: 9000, stepoverPct: 45 })), 'stepover') },
        surface: { stepdown: byKey(seedFromOp(op('surfacing', { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 16, feed: 900, plunge: 180, clearance: 5, rpm: 12000, stepoverPct: 60 })), 'stepdown'),
                   depth: byKey(seedFromOp(op('surfacing', { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 16, feed: 900, plunge: 180, clearance: 5, rpm: 12000, stepoverPct: 60 })), 'depth') },
        corner: { maxProbe: byKey(seedFromOp(op('corner', { corner: 'FR', wcs: 'G55', probeZ: true, probeSeq: 'XY', dist: 80, retract: 4, radius: 3, safeZ: 12, travelDist: 40, scanDepth: 6, f_fast: 250, f_slow: 60 })), 'maxProbe'),
                   travel: byKey(seedFromOp(op('corner', { corner: 'FR', wcs: 'G55', probeZ: true, probeSeq: 'XY', dist: 80, retract: 4, radius: 3, safeZ: 12, travelDist: 40, scanDepth: 6, f_fast: 250, f_slow: 60 })), 'travel'),
                   fast: byKey(seedFromOp(op('corner', { corner: 'FR', wcs: 'G55', probeZ: true, probeSeq: 'XY', dist: 80, retract: 4, radius: 3, safeZ: 12, travelDist: 40, scanDepth: 6, f_fast: 250, f_slow: 60 })), 'fast'),
                   seq: byKey(seedFromOp(op('corner', { corner: 'FR', wcs: 'G55', probeZ: true, probeSeq: 'XY', dist: 80, retract: 4, radius: 3, safeZ: 12, travelDist: 40, scanDepth: 6, f_fast: 250, f_slow: 60 })), 'seq'),
                   cornerF: byKey(seedFromOp(op('corner', { corner: 'FR', wcs: 'G55', probeZ: true, probeSeq: 'XY', dist: 80, retract: 4, radius: 3, safeZ: 12, travelDist: 40, scanDepth: 6, f_fast: 250, f_slow: 60 })), 'corner'),
                   retract: byKey(seedFromOp(op('corner', { corner: 'FR', wcs: 'G55', probeZ: true, probeSeq: 'XY', dist: 80, retract: 4, radius: 3, safeZ: 12, travelDist: 40, scanDepth: 6, f_fast: 250, f_slow: 60 })), 'retract') },
        drill: { posX: byKey(seedFromOp(op('drill', { method: 'peck', pattern: 'circle', x0: 10, y0: 20, dia: 60, count: 8, startAngle: 15, holeDia: 6.5, depth: 12, peck: 3, feed: 280, clearance: 5, rpm: 8000 })), 'posX'),
                 dia: byKey(seedFromOp(op('drill', { method: 'peck', pattern: 'circle', x0: 10, y0: 20, dia: 60, count: 8, startAngle: 15, holeDia: 6.5, depth: 12, peck: 3, feed: 280, clearance: 5, rpm: 8000 })), 'dia') },
      },
    };
  });

  // camType resolution
  expect(r.pocket.camType).toBe('pocket');
  expect(r.surface.camType).toBe('surface');
  expect(r.corner.camType).toBe('corner');
  expect(r.drill.camType).toBe('drill');
  expect(r.slot.camType).toBe('slot');

  // ALIASED values (bare op.params -> generator field key)
  expect(r.pick.corner.maxProbe.value, 'corner maxProbe <- op.dist').toBe(80);
  expect(r.pick.corner.travel.value, 'corner travel <- op.travelDist').toBe(40);
  expect(r.pick.corner.fast.value, 'corner fast <- op.f_fast').toBe(250);
  expect(r.pick.corner.retract.value, 'corner retract identity').toBe(4);
  expect(r.pick.corner.cornerF.value, 'corner corner enum pulled RAW (S1d converts)').toBe('FR');
  expect(r.pick.corner.seq.value, 'corner seq <- op.probeSeq (raw enum)').toBe('XY');
  expect(r.pick.drill.posX.value, 'drill posX <- op.x0').toBe(10);
  expect(r.pick.drill.dia.value, 'drill dia identity').toBe(60);
  expect(r.pick.pocket.toolDia.value, 'pocket toolDia identity').toBe(8);
  expect(r.pick.surface.depth.value, 'surface depth identity').toBe(0.8);
  // stepover has NO op source (op stores stepoverPct) -> unseeded -> generator default (POCKET stepover def = 2.4)
  expect(r.pick.pocket.stepover.value, 'pocket stepover unseeded -> generator default').toBe(2.4);

  // exposed defaults
  expect(r.corner.fields.every((f) => f.exposed === true), 'all seeded fields default exposed').toBe(true);

  // NON-BAKEABLE guard/branch params
  expect(r.pick.corner.cornerF.bakeable, 'corner (branch selector) NOT bakeable').toBe(false);
  expect(r.pick.corner.seq.bakeable, 'seq (branch selector) NOT bakeable').toBe(false);
  expect(r.pick.corner.retract.bakeable, 'retract (dimensional) IS bakeable').toBe(true);
  expect(r.pick.surface.stepdown.bakeable, 'surface stepdown (guard driver) NOT bakeable').toBe(false);
  expect(r.pick.surface.depth.bakeable, 'surface depth (loop bound) IS bakeable').toBe(true);
  expect(r.pick.drill.posX.bakeable, 'drill posX bakeable (no guard)').toBe(true);

  // gated / unsupported forks
  expect(r.contour.unsupported, 'contour excluded').toContain('NO CAM generator');
  expect(r.middle.unsupported, 'middle gated (inside/boss)').toContain('GATED');
  expect(r.pocketCircle.unsupported, 'pocket circle gated (cpocket)').toContain('GATED');
  expect(r.drillHelical.unsupported, 'drill helical gated (bore)').toContain('GATED');
});
