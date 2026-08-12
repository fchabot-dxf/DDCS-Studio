import { test, expect } from '@playwright/test';

/**
 * EDGE-PORT E2 — SIM-STARTS. The edge data-op declares ONE 'edge'-anchor preview pass (edge datum = a LINE / one wall → one
 * anchor, vs corner's multi-pass POINT). ASSERT-THE-VALUE: the marker sits AT the edge line — its position matches an
 * INDEPENDENT geometric truth (outset off the wall · perp axis centred · wall height), computed fresh from scratch, not by
 * reading the provider — not merely "a marker appears". Sim-only → the EMIT stays byte-identical (E1 goldens unchanged).
 * (t1730 — the built-in EdgeWizard.inferStart second-source check this originally also ran is gone: the legacy class was
 * deleted alongside its view, and unlike middle/alignment/rotary_center/rotary_clock, edge's inferStarts was never moved
 * into opSimStarts.js's BUILT_IN registry, so there is no surviving second source to compare against.)
 */
test('edge-sim-starts: ONE edge-anchor pass at the edge line (== independent geometry); emit byte-identical', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { edgeDataDef, EDGE_DEFAULTS, EDGE_DATA_OPTYPE } = await import('/blocks/dataOps/edgeData.js');
    const { edgeStack } = await import('/wizards/edgeWizard.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');

    registerUserOp(edgeDataDef());
    const stock = { x: 100, y: 80, z: 20 };
    const S = (o) => ({ ...EDGE_DEFAULTS, ...o });

    // INDEPENDENT geometric truth (NOT reading the provider): a probe-height edge marker parked off the wall, perp axis centred
    const truth = (params) => {
      const dist = 'dist' in params ? params.dist : 15;
      const outset = Math.max(6, Math.min(dist * 0.6, 15));
      const z = -Math.min(5, stock.z * 0.5);
      const pos = (params.dir || 'pos') !== 'neg';
      return (params.axis || 'X') === 'X'
        ? { x: pos ? -outset : stock.x + outset, y: stock.y / 2, z }
        : { x: stock.x / 2, y: pos ? -outset : stock.y + outset, z };
    };

    const combos = [];
    for (const axis of ['X', 'Y']) for (const dir of ['pos', 'neg']) for (const dist of [15, 300]) {
      const p = S({ axis, dir, dist });
      const viaOp = opSimStarts(EDGE_DATA_OPTYPE, p, stock);   // the PREVIEW path (the twin's registered USER_STARTS provider)
      combos.push({ k: `${axis}/${dir}/${dist}`, count: Array.isArray(viaOp) ? viaOp.length : -1, op: viaOp && viaOp[0], truth: truth(p), emits: viaOp && viaOp[0] && viaOp[0].emits });
    }

    // sim-only → the EMIT is byte-identical (the provider never touches the template)
    const dataBuilder = builderOf(EDGE_DATA_OPTYPE);
    const emitSame = emitMapped(dataBuilder(S({}))).text === emitMapped(edgeStack(S({}))).text
      && emitMapped(dataBuilder(S({ axis: 'Y', dir: 'neg', wcs: 'G55' }))).text === emitMapped(edgeStack(S({ axis: 'Y', dir: 'neg', wcs: 'G55' }))).text;

    return { combos, emitSame };
  });

  // t1730 — EdgeWizard (the legacy screen class) was deleted alongside its view; unlike middle/alignment/
  // rotary_center/rotary_clock, edge's inferStarts was NEVER moved into opSimStarts.js's BUILT_IN (confirmed by
  // reading the file — no `edge` key exists there), so it has no second registry-side source to compare against
  // anymore. The independent-geometry `truth()` recomputation below (built fresh from scratch, never reading the
  // provider) remains a fully valid second source on its own — kept as the sole cross-check.
  const near = (a, b) => a != null && b != null && Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.z - b.z) < 1e-6;
  for (const c of r.combos) {
    expect(c.count, `${c.k}: exactly ONE edge-anchor pass (a LINE datum, one marker)`).toBe(1);
    expect(near(c.op, c.truth), `${c.k}: the marker sits at the edge line — op ${JSON.stringify(c.op)} vs INDEPENDENT truth ${JSON.stringify(c.truth)}`).toBe(true);
    expect(c.emits, `${c.k}: the edge marker is SIM-ONLY (emits=false — the incremental probe macro never encodes the start)`).toBeFalsy();
  }
  expect(r.emitSame, 'sim-only: the emit stays byte-identical to the built-in edge (E1 goldens unchanged)').toBe(true);
});
