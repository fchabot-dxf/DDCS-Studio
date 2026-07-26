import { test, expect } from '@playwright/test';

/**
 * t1211 — MIDDLE PROBE ORDER (which axis probes FIRST), the user's original report ("the axis order of probing in middle
 * is gone, it defaulting to X, cant choose Y then X").
 *
 * Declared exactly like Corner's Probe Order: one enum param (`axisOrder`: 'XY' | 'YX') that drives a 2-WAY GUARD FORK in
 * middleStack's superset, because instantiate() prunes a STATIC template and never rewrites params — a `move` block's
 * x/y sockets are NAMED, so the swap cannot be a param mapping and must be pre-built as arms.
 *
 * This asserts the three things that make it safe:
 *  (1) BACK-COMPAT — an op with no `axisOrder` emits byte-identically to today, and a legacy `axis:'Y'` resolves to 'YX'.
 *  (2) THE DIFF IS EXACTLY THE ORDER — the two arms have the SAME line count and differ ONLY in axis-bound tokens
 *      (G31 axis letters, per-axis probe/trigger registers, per-axis retract/cross-over words, per-axis WCS writes).
 *      Nothing structural moves; a stray difference anywhere else fails.
 *  (3) THE PREVIEW FOLLOWS — the sim-start markers re-order with the declared order, so marker numbering and the emitted
 *      probe sequence can't disagree (both resolve through the one `middleAxes` resolver).
 */
const BOSS = { featureType: 'boss', twoAxis: true, inAxis: 'auto', transAxis: 'auto' };
const STOCK = { x: 100, y: 80, z: 20 };

test('back-compat: no axisOrder emits byte-identically to today, and a legacy axis:Y resolves to the YX order', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async ({ BOSS }) => {
    const { middleStack, middleAxes } = await import('/wizards/middleWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const MD = await import('/blocks/dataOps/middleData.js');
    const base = { ...MD.MIDDLE_DEFAULTS, ...BOSS };
    const legacy = { ...base }; delete legacy.axisOrder;
    return {
      legacyEqXY: emitMapped(middleStack(legacy)).text === emitMapped(middleStack({ ...base, axisOrder: 'XY' })).text,
      legacyYeqYX: emitMapped(middleStack({ ...legacy, axis: 'Y' })).text === emitMapped(middleStack({ ...base, axisOrder: 'YX' })).text,
      resolveDefault: middleAxes({}).order,
      resolveLegacyY: middleAxes({ axis: 'Y' }).order,
      resolveExplicit: middleAxes({ axis: 'X', axisOrder: 'YX' }).order,   // the DECLARED param wins over the legacy field
    };
  }, { BOSS });
  expect(r.legacyEqXY, 'an op that never stored axisOrder emits EXACTLY what it did before').toBe(true);
  expect(r.legacyYeqYX, 'the legacy axis:Y (old "primary axis") resolves to the YX order').toBe(true);
  expect(r.resolveDefault, 'no params → XY (the historical bake)').toBe('XY');
  expect(r.resolveLegacyY, 'legacy axis:Y → YX').toBe('YX');
  expect(r.resolveExplicit, 'the declared axisOrder wins over the legacy axis field').toBe('YX');
});

test('the swapped order differs ONLY in axis-bound tokens — same line count, no structural change', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async ({ BOSS }) => {
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const MD = await import('/blocks/dataOps/middleData.js');
    const base = { ...MD.MIDDLE_DEFAULTS, ...BOSS };
    const A = emitMapped(middleStack({ ...base, axisOrder: 'XY' })).text.split('\n');
    const B = emitMapped(middleStack({ ...base, axisOrder: 'YX' })).text.split('\n');
    const diffs = [];
    for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) diffs.push([A[i] || '', B[i] || '']);
    // Normalising the AXIS-BOUND tokens must collapse every diff: the axis letter on a motion/probe word, and the
    // per-axis register pairs (probe status 1920/1921, trigger 1925/1926, stop-mode 1905/1906, limit 1915/1916,
    // cross-over 19/20, and the X-vs-Y WCS offset writes).
    const norm = (s) => s
      .replace(/\b(G0|G1|G31)\s+[XY]/g, '$1 A')            // the motion/probe AXIS LETTER
      .replace(/#(1920|1921)\b/g, '#19xx')                 // per-axis probe status
      .replace(/#(1925|1926)\b/g, '#19yy')                 // per-axis trigger position
      .replace(/#(1905|1906)\b/g, '#190x')                 // per-axis stop mode
      .replace(/#(1915|1916)\b/g, '#191x')                 // per-axis limit protect
      .replace(/#(19|20)\b/g, '#cross')                    // per-axis cross-over distance
      .replace(/\[#70\+[01]\]/g, '[#70+ax]')               // per-axis WCS offset write
      .replace(/2axis_(XtoY|YtoX)/g, '2axis_order')        // the declared order comment
      .replace(/the diagonal [XY] target/g, 'the diagonal AX target')   // comment prose that NAMES the axis
      .replace(/②\.[XY]/g, '②.AX');
    const unexplained = diffs.filter(([a, b]) => norm(a) !== norm(b));
    return { lenA: A.length, lenB: B.length, nDiff: diffs.length, unexplained: unexplained.slice(0, 6), nUnexplained: unexplained.length };
  }, { BOSS });

  expect(r.lenA, 'both orders emit the SAME number of lines (nothing structural moved)').toBe(r.lenB);
  expect(r.nDiff, 'the two orders really do differ (the fork is live, not a no-op)').toBeGreaterThan(10);
  expect(r.nUnexplained, `every difference is an axis-bound token; unexplained: ${JSON.stringify(r.unexplained)}`).toBe(0);
});

test('the preview follows the declared order: the marker sequence re-orders with it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async ({ BOSS, STOCK }) => {
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const MD = await import('/blocks/dataOps/middleData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const def = MD.middleDataDef(); registerUserOp(def);
    const base = { ...MD.MIDDLE_DEFAULTS, ...BOSS, inAxis: 'manual' };   // manual → one pass per wall, so order is visible
    const at = (o) => (opSimStarts('middle', { ...base, axisOrder: o }, STOCK) || []).map((m) => ({ x: Math.round(m.x), y: Math.round(m.y) }));
    const twin = (o) => (def.simStartsProvider({ ...base, axisOrder: o }, STOCK) || []).map((m) => ({ x: Math.round(m.x), y: Math.round(m.y) }));
    return { xy: at('XY'), yx: at('YX'), twinXY: twin('XY'), twinYX: twin('YX') };
  }, { BOSS, STOCK });

  expect(r.xy.length, 'the manual boss two-axis probe declares its per-wall passes').toBeGreaterThanOrEqual(4);
  expect(r.yx, 'flipping the declared order re-orders the markers (numbering follows the probe sequence)').not.toEqual(r.xy);
  // the FIRST pass is on the FIRST-probed axis: for XY it moves in X (y stays at the centre); for YX it moves in Y.
  expect(r.xy[0].y, 'XY: the first marker sits on the X approach line (y at the feature centre)').toBe(Math.round(STOCK.y / 2));
  expect(r.yx[0].x, 'YX: the first marker sits on the Y approach line (x at the feature centre)').toBe(Math.round(STOCK.x / 2));
  // built-in and twin must agree in BOTH orders (the pilot's parity invariant)
  expect(r.twinXY, 'twin == built-in for XY').toEqual(r.xy);
  expect(r.twinYX, 'twin == built-in for YX').toEqual(r.yx);
});
