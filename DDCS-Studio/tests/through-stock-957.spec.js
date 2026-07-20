import { test, expect } from '@playwright/test';

/**
 * t957 B2b-3 — THE RUNTIME THROUGH-STOCK PRE-FLIGHT (Option B). A MIDDLE clearance traverse that crosses the stock BELOW
 * the stock top (a Plane below the top, or a low Hop) would PLOW the part. checkEnvelope reproduces the FAITHFUL per-pass
 * operator start via opSimStarts (the same derivation the sim uses) + the real wcsOffset, then a mid-segment rayBox on
 * clearance-traverse-owned segments (block TYPE from the projection map → probes excluded by construction) flags
 * kind:'through-stock'. The t955 spike proved the FRAME; this drives the REAL checkEnvelope and locks the 4-mode verdicts
 * (the frame-regression guard) + the tighten (Max must NOT over-flag; a probe must NOT false-positive).
 */
const STOCK = { x: 100, y: 100, z: 30, show: true, code: 'ccp' };
const MACHINE = { x: 1000, y: 1000, z: -500, wcs: { active: 1, table: [{ x: -200, y: -200, z: -5 }] } };

const check = (page, extra, post) => page.evaluate(async ({ extra, post, STOCK, MACHINE }) => {
  const { middleStack } = await import('/wizards/middleWizard.js');
  const { emitMapped } = await import('/blocks/blockEmitter.js');
  const { getDialect } = await import('/wizards/dialects/index.js');
  const { checkEnvelope } = await import('/engine/envelopeCheck.js');
  // t961 — the plane clearance is offered only with its guarantee (Active WCS + Z-first); establish it so a Plane-below
  // traverse actually EMITS (else the safety backstop folds it to Hop) and the through-stock check has a plane to catch.
  const params = { featureType: 'boss', twoAxis: true, inAxis: 'auto', transAxis: 'auto', dia: 40, probeZ: true, wcs: 'active', ...extra };
  const em = emitMapped(middleStack(params), post ? { dialect: getDialect(post) } : {});
  // the pre-flight reads the block program (opSimStarts source) + the projection (blockMap) off these globals
  window.ddcsGetBlockProgram = () => [{ type: 'op', opType: 'middle', params }];
  window.ddcsGetProjection = () => ({ text: em.text, map: em.map });
  const r = checkEnvelope(em.text, { machine: MACHINE, stock: STOCK });
  const ts = (r.violations || []).filter((v) => v.kind === 'through-stock');
  return { hasThroughStock: ts.length > 0, tsLines: ts.map((v) => v.line), nViol: (r.violations || []).length };
}, { extra, post, STOCK, MACHINE });

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
});

test('through-stock: a MIDDLE Plane-below traverse FLAGS (mid-segment plow, at its line)', async ({ page }) => {
  const r = await check(page, { clearMode: 'plane', planeZ: -2 });   // plane 2mm below the stock top → the cross plows
  expect(r.hasThroughStock, 'a Plane-below-top traverse is flagged through-stock').toBe(true);
  expect(r.tsLines.length, 'flagged at a specific line').toBeGreaterThan(0);
});

test('through-stock: a HOP clears (protected by construction) — a below-top cross would flag via the SAME path as Plane-below', async ({ page }) => {
  // FINDING (t957): a low-Hop-through-stock is not realizably constructable in the current ops. A capped post (Expert/V4.1)
  // caps the hop at the machine margin → clear BY CONSTRUCTION (the cap IS the protection). A boss wall-probe sits at the
  // stock top → any hop lands above it. A pocket uses plain `move` blocks between walls (no clearance-traverse lift). So the
  // realizable through-stock risk is PLANE-below (see the first test) — and the tighten has NO hop special-casing, so a hop
  // that DID render below the top flags via the identical horizontal-cross-below-top path proven by the Plane-below test.
  const r = await check(page, { clearMode: 'hop', hopDist: 3 });
  expect(r.hasThroughStock, 'a hop clears (the cap + the shallow boss probe keep it at/above the top)').toBe(false);
});

test('through-stock: a Plane-ABOVE traverse does NOT flag (clear) — and probes crossing the footprint do NOT false-positive', async ({ page }) => {
  const r = await check(page, { clearMode: 'plane', planeZ: 10 });   // plane 10mm above the top → clear; the G31 probes still cross the footprint
  expect(r.hasThroughStock, 'a Plane-above-top traverse is clear (and the probe approaches are excluded by construction)').toBe(false);
});

test('through-stock: MAX does NOT over-flag (the tighten excludes the lift-to-margin cross + the vertical lifts)', async ({ page }) => {
  const r = await check(page, { clearMode: 'max' });
  expect(r.hasThroughStock, 'a Max traverse lifts clear of the stock → not a plow (post-tighten)').toBe(false);
});
