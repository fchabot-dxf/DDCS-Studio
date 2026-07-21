// t986 — the surfacing DATA-OP twin (opensAs) must emit Skim BYTE-IDENTICAL to the built-in surfacingStack(skim), via
// the applySkimStructure postInstantiate (progstart drops the absolute clearance + placeonstock→skim). The crash-guard
// (NO absolute Z before G91) MUST hold on the twin too. Normal stays byte-identical.
import { test, expect } from '@playwright/test';

test('twin Skim == built-in Skim byte-identical; crash-guard holds (no abs Z before G91); Normal byte-identical', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { surfacingStack } = await import('/wizards/surfacingWizard.js');
    const { surfacingDataDef, SURFACING_DEFAULTS, SURFACING_DATA_OPTYPE } = await import('/blocks/dataOps/surfacingData.js');
    const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    registerUserOp(surfacingDataDef());
    const dataBuilder = builderOf(SURFACING_DATA_OPTYPE);
    const base = { ...SURFACING_DEFAULTS, spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };
    const S = (o) => ({ ...base, ...o });

    // SKIM byte-parity across a sweep (twin == built-in)
    const skimSweep = [S({ zMode: 'skim' }), S({ zMode: 'skim', depth: 3, stepdown: 0.8 }), S({ zMode: 'skim', w: 150, h: 60, feed: 1200, stepover: 6 })];
    const skim = emitEquivalence(surfacingStack, dataBuilder, skimSweep);
    // NORMAL still byte-parity (absent + explicit)
    const normal = emitEquivalence(surfacingStack, dataBuilder, [S({}), S({ zMode: 'normal' })]);
    // the CRASH-GUARD on the TWIN: no absolute Z move before the G91
    const twinSkim = emitMapped(dataBuilder(S({ zMode: 'skim' }))).text;
    const lines = twinSkim.split('\n').map((l) => l.trim());
    const g91 = lines.findIndex((l) => /^G91\b/.test(l));
    const preZ = lines.slice(0, g91).filter((l) => /^G[0-3]\b/.test(l) && /Z-?\d/.test(l));
    const firstZafter = lines.slice(g91 + 1).find((l) => /Z-?\d/.test(l));
    return {
      skimPass: skim.pass, skimDiff: skim.firstDiff && { params: skim.firstDiff.params, a: skim.firstDiff.a.slice(0, 400), b: skim.firstDiff.b.slice(0, 400) },
      normalPass: normal.pass, normalDiff: normal.firstDiff && { a: normal.firstDiff.a.slice(0, 300), b: normal.firstDiff.b.slice(0, 300) },
      g91, preZ, firstZafter,
    };
  });
  expect(r.skimPass, `twin Skim == built-in Skim (diff: ${JSON.stringify(r.skimDiff)})`).toBe(true);
  expect(r.normalPass, `twin Normal byte-identical (diff: ${JSON.stringify(r.normalDiff)})`).toBe(true);
  expect(r.g91, 'twin Skim emits G91').toBeGreaterThan(0);
  expect(r.preZ, `twin crash-guard: NO absolute Z before G91 (found: ${r.preZ.join(' | ')})`).toEqual([]);
  expect(r.firstZafter, 'first Z after G91 is the +5 clearance lift').toMatch(/G0 Z5\b/);
});

test('Skim round-trips through the op marker — byte-identical re-emit', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const SD = await import('/blocks/dataOps/surfacingData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { markerLine, parseMarker } = await import('/blocks/opSchema.js');
    registerUserOp(SD.surfacingDataDef());
    const build = builderOf(SD.SURFACING_DATA_OPTYPE);
    const P = { ...SD.SURFACING_DEFAULTS, zMode: 'skim', spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };
    const e1 = emitMapped(build(P)).text;
    const marker = markerLine(SD.SURFACING_DATA_OPTYPE, P);   // op record → ( @DDCS … ) marker
    const parsed = parseMarker(marker);                       // marker → op record (internal keys)
    const e2 = emitMapped(build(parsed.params)).text;
    return { markerHasSkim: /"zMode":"skim"/.test(marker), backZMode: parsed.params.zMode, byteIdentical: e1 === e2 };
  });
  expect(r.markerHasSkim, 'the .nc marker carries zMode:skim').toBe(true);
  expect(r.backZMode, 'reimport restores zMode=skim').toBe('skim');
  expect(r.byteIdentical, 'the reimported Skim op re-emits byte-identical').toBe(true);
});
