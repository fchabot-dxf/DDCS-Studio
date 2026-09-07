import { test, expect } from './support/harness.mjs';

/**
 * EDGE-PORT E1 — EMIT. The edge built-in expressed as a DATA def (blocks/dataOps/edgeData.js) emits G-code byte-identical
 * to the hand-coded edgeStack across the axis/dir/wcs combos + a scalar sweep — with binding blockIndexes DERIVED by
 * macro-var IDENTITY (deriveBindings), never hand-counted. THE PILOT PAYOFF: edge is a strict SUBSET of corner and the
 * SAME emitEquivalence harness proves the twin == the built-in (an INDEPENDENT truth). RADIUS-COMP = true-wall-face (parity).
 */
test('edge-data-emit: byte-identical to the built-in edge across axis/dir/wcs + a bound-scalar sweep', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { edgeStack } = await import('/wizards/edgeWizard.js');
    const { edgeDataDef, EDGE_DEFAULTS, EDGE_DATA_OPTYPE, EDGE_BINDINGS } = await import('/blocks/dataOps/edgeData.js');
    const { emitEquivalence, stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');

    registerUserOp(edgeDataDef());
    const dataBuilder = builderOf(EDGE_DATA_OPTYPE);   // === instantiate(def, …): an INDEPENDENT path from edgeStack
    const S = (o) => ({ ...EDGE_DEFAULTS, ...o });

    // (1) SCALAR sweep (structural at the X/pos/active default) — FUNCTIONAL byte (stripAnnotations, corner's yardstick)
    const scalarSweep = [S({}), S({ dist: 300 }), S({ dist: 800, retract: 8 }), S({ retract: 2 }), S({ f_fast: 250, f_slow: 40 }), S({ f_slow: 80 }), S({ port: 5 }), S({ radius: 3 }), S({ radius: 2.5 }), S({ dist: 250, retract: 6, f_fast: 220, f_slow: 45, port: 4, radius: 2.5 })];
    const scalar = emitEquivalence(edgeStack, dataBuilder, scalarSweep, {}, stripAnnotations);

    // (2) STRUCTURAL combos — FULL byte (no stripAnnotations): the axis×dir / axis×wcs KIND-B comments prune to the same text
    const structSweep = [];
    for (const axis of ['X', 'Y']) for (const dir of ['pos', 'neg']) for (const wcs of ['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59']) structSweep.push(S({ axis, dir, wcs }));
    const struct = emitEquivalence(edgeStack, dataBuilder, structSweep, {});   // FULL byte

    // (3) wiring — every scalar binding derived a blockIndex + carries its identity var
    const wiring = EDGE_BINDINGS.map((b) => ({ param: b.param, var: b.match && b.match.var, blockIndex: b.blockIndex }));

    // (4) the DEFAULT twin emits a real G31 + the single #[#70+0]=#50 write (a LINE datum — one axis)
    const def0 = dataBuilder(S({}));
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const t0 = emitMapped(def0).text;

    return { scalar, struct, wiring, nBindings: EDGE_BINDINGS.length, hasG31: /G31/.test(t0), hasWrite: /#\[#70\+0\]=#50/.test(t0), hasWriteY: /#\[#70\+1\]/.test(t0) };
  });

  expect(r.nBindings, '6 scalar bindings derived').toBe(6);
  expect(r.wiring.every((w) => typeof w.blockIndex === 'number'), `every scalar binding derived a blockIndex: ${JSON.stringify(r.wiring)}`).toBe(true);
  expect(r.scalar.pass, `scalar sweep functional byte-identical (${r.scalar.diffs.length} diffs; first: ${JSON.stringify(r.scalar.firstDiff && r.scalar.firstDiff.params)})`).toBe(true);
  expect(r.struct.pass, `axis/dir/wcs combos FULL byte-identical (${r.struct.diffs.length} diffs; first params: ${JSON.stringify(r.struct.firstDiff && r.struct.firstDiff.params)})`).toBe(true);
  expect(r.hasG31, 'the default twin emits a real G31 probe').toBe(true);
  expect(r.hasWrite, 'the default (X) twin writes ONE axis register #[#70+0]=#50 (a LINE datum)').toBe(true);
  expect(r.hasWriteY, 'the default (X) twin does NOT write the Y register (only one axis — the edge line)').toBe(false);
});
