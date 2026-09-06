import { test, expect } from './support/harness.mjs';

/**
 * SCALAR PARITY (t138) — the Corner (data) twin's emit must equal cornerStack byte-for-byte when the 6 SUMMARY SCALARS
 * (dist / retract / f_fast / f_slow / safeZ / scanDepth) are NON-DEFAULT — not just the structural params. The twin's
 * static template froze the 2 human-readable header comments at CORNER_DEFAULTS; its postInstantiate hook recomposes them
 * from the resolved params (via the shared cornerHeaderComments format) so the comment tracks the live scalars. This spec
 * closes the previously-missed gap: skipping that recompose leaves the header stale → these asserts go RED.
 *
 * t2693 — TIER MIGRATION BATCH 4: moved browser→node. No twin-seeding fix needed: this file already calls
 * `registerUserOp(cornerDataDef())` explicitly.
 */
test('the twin == cornerStack byte-for-byte across NON-DEFAULT scalars (header comment tracks them)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const def = CD.cornerDataDef(); registerUserOp(def);
    const build = builderOf(CD.CORNER_DATA_OPTYPE);
    const S = (o) => ({ ...CD.CORNER_DEFAULTS, ...o });
    const em = (fn, p) => emitMapped(fn(p)).text;

    // vary EACH scalar on its own + a combined set, and cross a couple with structural params
    const sets = [
      { dist: 321 }, { retract: 7 }, { f_fast: 333 }, { f_slow: 44 }, { safeZ: 15 }, { scanDepth: 8 },
      { dist: 321, retract: 7, f_fast: 333, f_slow: 44, safeZ: 15, scanDepth: 8 },
      { dist: 321, safeZ: 15, probeZFirst: 1, corner: 'BR', probeSeq: 'XY' },
      { scanDepth: 8, syncA: 1, wcs: 'G56' },
    ];
    const fails = [];
    for (const o of sets) { const p = S(o); if (em(build, p) !== em(cornerStack, p)) fails.push(o); }

    // VALUE assert: the twin's emitted header comment shows the ACTUAL dist/safeZ (not the frozen defaults)
    const nd = em(build, S({ dist: 321, safeZ: 15 }));
    const probeLine = nd.split('\n').find((l) => /Probe dist:/.test(l)) || '';
    const feedLine = nd.split('\n').find((l) => /SafeZ:/.test(l)) || '';
    return { fails, probeLine: probeLine.trim(), feedLine: feedLine.trim() };
  });
  expect(r.fails, 'every non-default scalar set emits byte-identical to cornerStack').toEqual([]);
  expect(r.probeLine, 'the header comment shows the live probe distance (321mm), not the frozen default').toContain('Probe dist: 321mm');
  expect(r.feedLine, 'the header comment shows the live safe-Z (15mm), not the frozen default').toContain('SafeZ: 15mm');
});
