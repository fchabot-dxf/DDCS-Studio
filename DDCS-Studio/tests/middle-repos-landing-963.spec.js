import { test, expect } from '@playwright/test';

/**
 * t963 B1 — PROBE-START INVERSION. The middle sim's wall-2 marker (a boss two-axis AUTO trans-traverse) must LAND where the
 * tool actually goes: the declared #21/#22 point, NOT an independent edge+outset guess that drifts as the operator edits Diag
 * travel (#21) or the geometry changes. This asserts the sim marker == the landing PARSED FROM THE ACTUAL EMITTED PROGRAM
 * (the #21 value + the emitted trans-traverse SIGN — dir2:neg `G0 Y#21`=+#21 / dir2:pos `G0 Y[0-#21]`=-#21; primary #22=centre),
 * evaluated with the test geometry — NON-CIRCULAR (the emit is ground truth, not a re-run of the sim JS). BOTH travelShapes +
 * BOTH dir2 signs; built-in provider + the data-op twin. Emit BYTE-IDENTICAL (sim-only). This test FAILS against the pre-fix
 * edge+outset sim (proven by a git-stash of opSimStarts) — it provably catches the inversion, not just passes green.
 */
const STOCK = { x: 100, y: 80, z: 20 };

test('middle wall-2 sim marker == the emit-declared #21/#22 landing (both shapes, both dir2); built-in + twin', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async ({ STOCK }) => {
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { middleDataDef } = await import('/blocks/dataOps/middleData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const def = middleDataDef(); registerUserOp(def);
    const twinProvider = def.simStartsProvider;
    const cx = STOCK.x / 2, cy = STOCK.y / 2;
    const cases = [];
    for (const shape of ['dogleg', 'diagonal']) for (const dir2 of ['neg', 'pos']) {
      const params = { featureType: 'boss', twoAxis: true, inAxis: 'auto', transAxis: 'auto', axis: 'X', dir1: 'pos', dir2, travelShape: shape };
      const t = emitMapped(middleStack(params)).text;   // the ACTUAL emitted program (ground truth)
      const dt = parseFloat((t.match(/#21=(-?\d+(?:\.\d+)?)/) || [])[1]);
      const secSign = t.includes('Y[0-#21]') ? -1 : (t.includes('Y#21') ? +1 : 0);   // the emitted trans-traverse Y sign
      const parsed = { x: cx, y: cy + secSign * dt };   // primary lands at #22=centre; secondary at centre + signed #21
      const bi = opSimStarts('middle', params, STOCK); const biW2 = bi[bi.length - 1];
      const tw = twinProvider(params, STOCK); const twW2 = tw[tw.length - 1];
      cases.push({ shape, dir2, dt, secSign, parsed, hasTwin: !!twinProvider, biW2: { x: Math.round(biW2.x), y: Math.round(biW2.y) }, twW2: { x: Math.round(twW2.x), y: Math.round(twW2.y) } });
    }
    return { cases };
  }, { STOCK });

  for (const c of r.cases) {
    expect(c.hasTwin, 'the twin exposes a sim-starts provider').toBe(true);
    expect(c.secSign, `${c.shape}/${c.dir2}: parsed a real trans-traverse sign from the emit`).not.toBe(0);
    expect(c.dt, `${c.shape}/${c.dir2}: parsed the #21 value`).toBeGreaterThan(0);
    expect(c.biW2, `${c.shape}/${c.dir2}: BUILT-IN sim wall-2 == the emit-declared #21/#22 landing`).toEqual(c.parsed);
    expect(c.twW2, `${c.shape}/${c.dir2}: TWIN sim wall-2 == the emit-declared #21/#22 landing`).toEqual(c.parsed);
  }
});
