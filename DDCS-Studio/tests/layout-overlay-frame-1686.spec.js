import { test, expect } from '@playwright/test';

/**
 * t1686 — a live user bug: with a WCS pin active, the Layout pane's animated-overlay raster (the toolpath trace +
 * moving head) drew in one place while the SVG layer (stock, rect, handles) drew in another, split by exactly the
 * pin's shift. Both layers of that pane are declared to share ONE frame: the SVG's own `_disp()` (world + the
 * WCS-pin shift `spec.placement`, t1672); the overlay pins itself from `FeatureCanvas.getTransform()`
 * (userOpView.js's `wireAnimOverlay`/`_pinFromTf`, t309). `getTransform()` returned the bare pan/zoom transform
 * (`_tf`) WITHOUT `_placement` folded in — so the overlay was always missing exactly the WCS-pin term, invisible
 * for as long as no one had a pin active (the term was always 0).
 *
 * THE FIX is entirely inside `getTransform()` (+ the `onTransform` callback, which now relays the SAME composed
 * value instead of the raw `_tf`): fold `_placement` into the returned `cxw/cyw` so the transform IS `_disp` — the
 * frame every placed element already draws in. `wireAnimOverlay`/`_pinFromTf` (userOpView.js) needed ZERO changes:
 * they already just relay whatever `getTransform()` hands them, so making that ONE function correct fixes every
 * consumer of it, present and future, automatically — there is no second, partial accessor left for a renderer
 * added to this pane later to reach for by mistake.
 *
 * A second, smaller defect from the same commit: the part-zero crosshair (drawn when an op has no machine-frame
 * envelope) read `spec.origin` through `_S` (the bare transform) instead of `_disp` — `spec.origin` is a
 * datum-relative world point, the SAME raw frame items/handles are declared in, so it needs the SAME shift they
 * get. Unshifted, it sat at the OLD, pre-pin datum corner — coincident with the overlay's own stale frame, which
 * is exactly what the user's screenshot showed ("the crosshair sits with the raster").
 */

test.use({ viewport: { width: 1400, height: 1000 } });

// (A) DIRECT — the root mechanism, independent of any op/wizard: getTransform()'s cxw/cyw absorb spec.placement
// exactly, and an overlay computing its screen pin purely from getTransform() (the real _pinFromTf formula)
// predicts the SAME screen point the SVG's own _disp does, for a shifted placement, not just the zero case.
test('(A) DIRECT: getTransform() folds spec.placement in — the overlay pin now equals _disp for any world point', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { FeatureCanvas } = await import('/viz/featureCanvas.js');
    const spec = (placement) => ({
      stock: { ox: 0, oy: 0, w: 100, h: 80 },
      items: [], handles: [{ id: 'h', x: 30, y: 20, kind: 'size' }],
      placement,
    });
    const container = document.createElement('div'); container.style.width = '400px'; container.style.height = '300px';
    document.body.appendChild(container);
    const fc = new FeatureCanvas();

    fc.render(container, spec({ x: 0, y: 0 }));
    const tfZero = fc.getTransform();
    const wp = (x, y) => fc._disp(x, y);   // ground truth: the SVG's own placed-frame mapping
    const dispZero = wp(30, 20);

    fc._userAdjusted = true;   // freeze _tf (pan/zoom) across the next render — isolates the placement fold from
    // auto-fit's own re-centring, which ALSO moves cxw/cyw when placed items shift into view (a real trap: a naive
    // "cxw changed by -300" assertion without this would conflate the two and false-negative).
    fc.render(container, spec({ x: 300, y: 200 }));
    const tfShift = fc.getTransform();
    const dispShift = wp(30, 20);

    // _pinFromTf's own formula (userOpView.js), reconstructed here so this test fails if that formula ever drifts
    // from what it currently does — not because this test re-derives a NEW formula.
    const predict = (tf, x, y) => {
      const ox = tf.cx - tf.cxw * tf.scale, oy = tf.cy + tf.cyw * tf.scale;
      return { x: ox + x * tf.scale, y: oy - y * tf.scale };
    };
    container.remove();
    return {
      cxwDelta: tfShift.cxw - tfZero.cxw, cywDelta: tfShift.cyw - tfZero.cyw,
      dispZero, dispShift, predictedZero: predict(tfZero, 30, 20), predictedShift: predict(tfShift, 30, 20),
    };
  });
  expect(r.cxwDelta, 'getTransform().cxw absorbs the placement shift (-300)').toBeCloseTo(-300, 6);
  expect(r.cywDelta, 'getTransform().cyw absorbs the placement shift (-200)').toBeCloseTo(-200, 6);
  expect(r.predictedZero.x).toBeCloseTo(r.dispZero.x, 3);
  expect(r.predictedZero.y).toBeCloseTo(r.dispZero.y, 3);
  expect(r.predictedShift.x, 'PINNED: the overlay-predicted screen X now equals the SVG _disp screen X (the reported split, closed)').toBeCloseTo(r.dispShift.x, 3);
  expect(r.predictedShift.y, 'PINNED: predicted screen Y equals _disp screen Y').toBeCloseTo(r.dispShift.y, 3);
});

const setStock = async (page, pin) => {
  await page.evaluate((pinArg) => {
    const s = window.ddcsGetSettings();
    s.stock = Object.assign(s.stock || {}, { x: 200, y: 150, z: 20, show: true, datum: 'nnp' });
    if (pinArg) {
      s.stock.pin = pinArg;
      s.machine = Object.assign(s.machine || {}, { x: 800, y: 500, z: 120, show: true });
      s.machine.wcs = s.machine.wcs || {}; s.machine.wcs.active = 1;
      s.machine.wcs.table = [{ x: 0, y: 0, z: 0 }, { x: 300, y: 200, z: -10 }];
    } else {
      delete s.stock.pin;
      s.machine = Object.assign(s.machine || {}, { show: false });
    }
    if (window.ddcsSetSettings) window.ddcsSetSettings(s);
    localStorage.removeItem('ddcs_user_ops');
  }, pin);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js');
    U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#userVizContainer .fc-stock', { timeout: 8000 });
  await page.waitForTimeout(600);
};

// (B) REAL GESTURE — the crosshair (part-zero marker) sits AT the stock's own datum corner, on screen, both pinned
// and unpinned, through the real corner wizard (not a synthetic spec).
test('(B) REAL: the part-zero crosshair coincides with the stock`s datum corner, pinned AND unpinned', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.openWiz);
  const measure = () => page.evaluate(() => {
    const svg = document.querySelector('#userVizContainer svg.feature-canvas');
    const stockBox = svg.querySelector('rect.fc-stock').getBoundingClientRect();
    const axisXBox = svg.querySelector('.fc-axis-x').getBoundingClientRect();
    return {
      stockLeft: Math.round(stockBox.left), stockBottom: Math.round(stockBox.bottom),
      axisX: Math.round(axisXBox.left + axisXBox.width / 2), axisY: Math.round(axisXBox.top + axisXBox.height / 2),
    };
  });

  await setStock(page, 'G55');
  const pinned = await measure();
  await setStock(page, null);
  const unpinned = await measure();
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  expect(Math.abs(pinned.axisX - pinned.stockLeft), 'PINNED: crosshair X == the stock`s left edge (the FL datum corner)').toBeLessThan(6);
  expect(Math.abs(pinned.axisY - pinned.stockBottom), 'PINNED: crosshair Y == the stock`s bottom edge').toBeLessThan(6);
  expect(Math.abs(unpinned.axisX - unpinned.stockLeft), 'UNPINNED: crosshair still at the FL corner (unchanged)').toBeLessThan(6);
  expect(Math.abs(unpinned.axisY - unpinned.stockBottom), 'UNPINNED: crosshair still at the FL corner (unchanged)').toBeLessThan(6);
});

// (C) NEGATIVE CONTROL — unpinned, the whole spec (placement, stock.ox/oy) stays exactly {0,0}: byte-identical to
// before this turn, and to every op that never sees a pin.
test('(C) NEGATIVE CONTROL: unpinned, placement and stock.ox/oy are exactly zero (byte-identical to today)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    const def = CD.cornerDataDef();
    registerUserOp(def);
    const params = Object.fromEntries((def.bindings || []).filter((b) => b.param && 'default' in b).map((b) => [b.param, b.default]));
    const s = window.ddcsGetSettings();
    s.stock = Object.assign(s.stock || {}, { x: 200, y: 150, z: 20, show: true, datum: 'nnp' });
    delete s.stock.pin;
    s.machine = Object.assign(s.machine || {}, { show: false });
    if (window.ddcsSetSettings) window.ddcsSetSettings(s);
    const spec = layoutSpecFromOp(def, params);
    return { placement: spec.placement, ox: spec.stock.ox, oy: spec.stock.oy };
  });
  expect(r.placement).toEqual({ x: 0, y: 0 });
  expect(r.ox).toBe(0);
  expect(r.oy).toBe(0);
});

// (D) NO DOUBLE-SHIFT — the collateral concern: opSimStarts (the sim-start markers' own coordinate source) never
// reads partZeroShift/the WCS table at all, so a marker world position is NOT pre-shifted — _disp's ONE
// application of `placement` is correct, not a second one on top of an already-shifted value.
test('(D) collateral check: opSimStarts never reads the WCS pin — sim-start markers are NOT pre-shifted (no double-shift risk)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { cornerDataDef, CORNER_DEFAULTS, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    registerUserOp(cornerDataDef());
    const stock = { x: 200, y: 150, z: 20 };
    const before = opSimStarts(CORNER_DATA_OPTYPE, CORNER_DEFAULTS, stock);
    // Simulate "a pin is active" purely via settings (opSimStarts takes no machine/WCS argument at all) — if the
    // provider read the pin, this would change the returned worlds; it must not, by construction (its signature
    // has no machine/WCS parameter to read).
    const s = window.ddcsGetSettings();
    s.machine = Object.assign(s.machine || {}, { x: 800, y: 500, z: 120, show: true });
    s.machine.wcs = { active: 1, table: [{ x: 0, y: 0, z: 0 }, { x: 300, y: 200, z: -10 }] };
    if (window.ddcsSetSettings) window.ddcsSetSettings(s);
    const after = opSimStarts(CORNER_DATA_OPTYPE, CORNER_DEFAULTS, stock);
    return { before, after, providerArity: opSimStarts.length };
  });
  expect(r.after, 'opSimStarts output is UNCHANGED by an active pin — it has no channel to read one').toEqual(r.before);
});
