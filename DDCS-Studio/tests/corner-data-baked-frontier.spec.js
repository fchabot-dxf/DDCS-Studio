import { test, expect } from '@playwright/test';

/**
 * BAKED-FRONTIER GATE — the FINAL frontier guard. All the operator-facing structural params are now LIVE: probeZFirst /
 * travelApproach / wcs / syncA (② B4 4a–4d, via guard/prune) + corner / probeSeq (③b, the 8-way corner×probeSeq guard). What
 * REMAINS baked:
 *   • `level` — the G31 probe LEVEL (a literal-in-G31 multi-socket value, no macro var, non-operator-facing): a DELIBERATE
 *     baked-FINAL (it does NOT get a live toggle; the ④ release carries that decision forward — do not relitigate).
 *
 * This holds the DON'T-RETIRE-THE-BUILT-IN gate: the twin is the release replacement, but retiring the built-in Corner is the
 * ④ RELEASE's call (end-to-end verify + version bump), not unblocked here.
 */

// (1) `level` is the last baked frontier — DELIBERATELY baked-final (non-operator-facing). The twin diverges from cornerStack
//     when level changes (it bakes level=0), documenting the deliberate bake. (corner/probeSeq's divergence tripwires were
//     RETIRED in lockstep with ③b — they now CONVERGE full-byte; see corner-data-cornerseq-live.spec.)
test('BAKED FRONTIER: `level` stays baked-final (non-operator-facing) — the twin diverges from cornerStack when level changes', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const levelDiverges = await page.evaluate(async () => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { cornerDataDef, CORNER_DEFAULTS, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
    const { emitEquivalence, stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    registerUserOp(cornerDataDef());
    const build = builderOf(CORNER_DATA_OPTYPE);
    return !emitEquivalence(cornerStack, build, [{ ...CORNER_DEFAULTS, level: 5 }], {}, stripAnnotations).pass;   // L5 ≠ the baked L0
  });
  expect(levelDiverges, 'level is baked-final (the twin bakes level=0); a non-zero level diverges — DELIBERATE (non-operator-facing), not a follow-on').toBe(true);
});

// (2) DON'T-RETIRE-THE-BUILT-IN gate. The twin is the release replacement, but retiring the built-in Corner is the ④ RELEASE's
//     decision (end-to-end verify + version bump + retire the wizardLibrary entry). This assertion guards it until then.
test('BAKED FRONTIER GATE: the built-in Corner wizard stays registered until the ④ release retires it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const builtinCorner = await page.evaluate(async () => {
    const { listEntries } = await import('/blocks/wizardLibrary.js');
    return listEntries().some((e) => e.id === 'corner' && e.type === 'corner' && e.kind === 'builtin');
  });
  expect(builtinCorner, 'built-in Corner (wizardLibrary id:corner) MUST stay registered until the ④ release retires it (end-to-end verify + version bump). All operator params are live now, but the release owns the retirement; this test guards it until then.').toBe(true);
});
