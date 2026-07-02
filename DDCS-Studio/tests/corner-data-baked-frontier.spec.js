import { test, expect } from '@playwright/test';

/**
 * BAKED-FRONTIER GATE — the FINAL frontier guard. All the operator-facing structural params are now LIVE: probeZFirst /
 * travelApproach / wcs / syncA (② B4 4a–4d, via guard/prune) + corner / probeSeq (③b, the 8-way corner×probeSeq guard). What
 * REMAINS baked:
 *   • `level` — the G31 probe LEVEL (a literal-in-G31 multi-socket value, no macro var, non-operator-facing): a DELIBERATE
 *     baked-FINAL (it does NOT get a live toggle; the ④ release carries that decision forward — do not relitigate).
 *
 * The built-in Corner is now RETIRED (④ move 2a) — the twin is its replacement. Test (2) asserts the retirement landed +
 * guards re-registration; the SHIM (cornerStack / BUILDERS.corner / SCHEMA.corner) stays so legacy saved 'corner' ops render.
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

// (2) The built-in Corner is now RETIRED (④ move 2a) — replaced by the "Corner (data)" twin. This asserts the retirement
//     LANDED (no built-in 'corner' entry in wizardLibrary) + guards against an accidental re-registration. The SHIM stays:
//     cornerStack / BUILDERS.corner / SCHEMA.corner keep legacy saved 'corner' ops rendering.
test('RETIRED: the built-in Corner wizard is no longer registered (replaced by the Corner (data) twin)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const builtinCorner = await page.evaluate(async () => {
    const { listEntries } = await import('/blocks/wizardLibrary.js');
    return listEntries().some((e) => e.id === 'corner' && e.type === 'corner' && e.kind === 'builtin');
  });
  expect(builtinCorner, 'the built-in Corner (wizardLibrary id:corner) is RETIRED ④ — replaced by user_corner_data; do NOT re-register it').toBe(false);
});
