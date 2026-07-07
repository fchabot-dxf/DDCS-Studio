import { test, expect } from '@playwright/test';

// POLYGON + ELLIPSE shape types in the Pocket and Contour wizards (rect/circle already existed). The geometry kernels
// (regionDesc / offsetRegion) handle all four; these tests assert the wizards inset (pocket) / offset (contour) the
// new shapes correctly and that the Blocks reconciler round-trips the typed size + sides.
test.use({ viewport: { width: 1280, height: 950 } });

test('pocket: polygon insets the circumradius by the tool radius; ellipse insets rx,ry; both round-trip', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const findType = (bs, t) => { for (const b of (bs || [])) { if (!b) continue; if (b.type === t) return b; const f = b.children && findType(b.children, t); if (f) return f; } return null; };
    const pw = await import('/wizards/pocketWizard.js');
    const { pocketInsetRegion } = await import('/wizards/ops/pocketfill.js');
    const ops = await import('/blocks/opSession.js');
    const rec = await import('/blocks/opRecord.js');

    const regionOf = (params) => {
      const stack = pw.pocketStack(params);
      const pf = findType(stack, 'pocketfill');   // E0 flatten: the FLAT pocketfill leaf holds the typed geometry + computes the tool-centre inset internally
      return pf && pf.params ? pw.regionParamsFromDesc(pocketInsetRegion(pf.params)) : null;   // → the same inset region-block params the stepover socket held
    };

    // Polygon Ø50, 6 sides, tool Ø6 (r=3). The circumradius insets by r/cos(π/6): 25 − 3/cos(30°) ≈ 21.536 → Ø≈43.07.
    const poly = regionOf({ shape: 'polygon', originX: 0, originY: 0, dia: 50, sides: 6, toolDia: 6, depth: 4, stepdown: 2, strategy: 'spiral' });
    // Ellipse w80×h60 (rx40, ry30), tool Ø6: rx→37, ry→27 → region w=74, h=54.
    const ell = regionOf({ shape: 'ellipse', originX: 0, originY: 0, w: 80, h: 60, toolDia: 6, depth: 4, stepdown: 2, strategy: 'spiral' });

    // Round-trip via the reconciler (record → build op-stack → reverse-sync). The form needs p_toolDia for the un-inset.
    const tdia = document.getElementById('p_toolDia'); const woff = document.getElementById('p_wallOffset');
    if (tdia) tdia.value = '6'; if (woff) woff.value = '0';

    const rtPoly = (() => {
      rec.recordOp('pocket', { shape: 'polygon', originX: 2, originY: 3, dia: 50, sides: 5, toolDia: 6, depth: 4, stepdown: 2, strategy: 'spiral' });
      const built = ops.buildActiveOpStack(); window.ddcsLoadBlockStack(built.blocks);
      return ops.reconcileActiveOp();
    })();
    const rtEll = (() => {
      rec.recordOp('pocket', { shape: 'ellipse', originX: 4, originY: 5, w: 80, h: 60, toolDia: 6, depth: 4, stepdown: 2, strategy: 'spiral' });
      const built = ops.buildActiveOpStack(); window.ddcsLoadBlockStack(built.blocks);
      return ops.reconcileActiveOp();
    })();

    return { poly, ell, rtPoly, rtEll };
  });

  // Pocket region is the tool-CENTRE boundary inset by the tool radius.
  expect(r.poly.shape, 'polygon region kept').toBe('polygon');
  expect(r.poly.sides, 'polygon sides carried into the region').toBe(6);
  expect(r.poly.w, 'polygon Ø inset by r/cos(π/6)').toBeCloseTo(43.07, 1);
  expect(r.ell.shape, 'ellipse region kept').toBe('ellipse');
  expect(r.ell.w, 'ellipse rx inset by r → Ø74').toBeCloseTo(74, 1);
  expect(r.ell.h, 'ellipse ry inset by r → Ø54').toBeCloseTo(54, 1);

  // Round-trip recovers the TYPED size + sides + shape.
  expect(r.rtPoly.type).toBe('pocket');
  expect(r.rtPoly.fields.p_shape).toBe('polygon');
  expect(Number(r.rtPoly.fields.p_dia), 'polygon Ø recovered').toBeCloseTo(50, 1);
  expect(Number(r.rtPoly.fields.p_sides), 'polygon sides recovered').toBe(5);
  expect(Number(r.rtPoly.fields.p_originX), 'polygon centre recovered').toBeCloseTo(2, 1);

  expect(r.rtEll.fields.p_shape).toBe('ellipse');
  expect(Number(r.rtEll.fields.p_w), 'ellipse W recovered').toBeCloseTo(80, 1);
  expect(Number(r.rtEll.fields.p_h), 'ellipse H recovered').toBeCloseTo(60, 1);
});

test('contour: polygon + ellipse offset (outside grows, inside shrinks) and round-trip side/shape/sides', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const { regionDesc } = await import('/wizards/ops/region.js');
    const { contourRegion } = await import('/wizards/ops/contour.js');
    const ops = await import('/blocks/opSession.js');
    const rec = await import('/blocks/opRecord.js');

    // Contour offsets the TRUE boundary by the side (outside = +r, inside = −r). tool Ø6 → r=3.
    const tool = 6;
    const polyDesc = (side) => contourRegion({ region: regionDesc({ shape: 'polygon', x: 0, y: 0, w: 50, sides: 6 }), side, tool });
    const ellDesc = (side) => contourRegion({ region: regionDesc({ shape: 'ellipse', x: 0, y: 0, w: 80, h: 60 }), side, tool });

    const polyOut = polyDesc('outside'), polyIn = polyDesc('inside');
    const ellOut = ellDesc('outside'), ellIn = ellDesc('inside');

    // Round-trip both shapes through the reconciler.
    const rt = (params) => {
      rec.recordOp('contour', params);
      const built = ops.buildActiveOpStack(); window.ddcsLoadBlockStack(built.blocks);
      return ops.reconcileActiveOp();
    };
    const rtPoly = rt({ shape: 'polygon', originX: 1, originY: 2, dia: 50, sides: 8, side: 'outside', toolDia: 6, depth: 4, stepdown: 2 });
    const rtEll = rt({ shape: 'ellipse', originX: 3, originY: 4, w: 80, h: 60, side: 'inside', toolDia: 6, depth: 4, stepdown: 2 });

    return {
      polyOutR: polyOut.r, polyInR: polyIn.r,
      ellOutRx: ellOut.rx, ellOutRy: ellOut.ry, ellInRx: ellIn.rx, ellInRy: ellIn.ry,
      rtPoly, rtEll,
    };
  });

  // Polygon Ø50 → circumradius 25. Outside grows by r/cos(π/6) (≈3.46), inside shrinks by it.
  expect(r.polyOutR, 'polygon outside grows').toBeGreaterThan(25);
  expect(r.polyInR, 'polygon inside shrinks').toBeLessThan(25);
  // Ellipse rx40, ry30. Outside +3, inside −3.
  expect(r.ellOutRx, 'ellipse outside rx grows').toBeCloseTo(43, 1);
  expect(r.ellOutRy, 'ellipse outside ry grows').toBeCloseTo(33, 1);
  expect(r.ellInRx, 'ellipse inside rx shrinks').toBeCloseTo(37, 1);
  expect(r.ellInRy, 'ellipse inside ry shrinks').toBeCloseTo(27, 1);

  // Round-trip: the Region IS the TRUE boundary (the Contour atom applies the offset) → read straight.
  expect(r.rtPoly.fields.ct_shape).toBe('polygon');
  expect(r.rtPoly.fields.ct_side).toBe('outside');
  expect(Number(r.rtPoly.fields.ct_dia), 'polygon Ø recovered').toBeCloseTo(50, 1);
  expect(Number(r.rtPoly.fields.ct_sides), 'polygon sides recovered').toBe(8);

  expect(r.rtEll.fields.ct_shape).toBe('ellipse');
  expect(r.rtEll.fields.ct_side).toBe('inside');
  expect(Number(r.rtEll.fields.ct_w), 'ellipse W recovered').toBeCloseTo(80, 1);
  expect(Number(r.rtEll.fields.ct_h), 'ellipse H recovered').toBeCloseTo(60, 1);
});
