import { test, expect } from '@playwright/test';

/**
 * BAKED-FRONTIER GATE — the FINAL frontier guard after all FOUR prune-shaped structural toggles (probeZFirst / travelApproach
 * / wcs / syncA) went live (② B4 steps 4a–4d). What REMAINS baked in the "Corner (data)" twin:
 *   • `corner` quadrant + `probeSeq` — SIGN/ORDER swaps (they permute direction signs + axis order INSIDE atoms, not
 *     add/remove blocks), so they are NOT prune-shaped and can't ride guard/prune; they go live later via VALUE-bindings.
 *   • `level` — a literal-in-G31 multi-socket fan-out (no macro var, non-operator-facing): a DELIBERATE baked-final.
 *
 * This holds the DON'T-RETIRE-THE-BUILT-IN gate (moved here from the retired syncA-frontier as syncA went live), re-anchored
 * to these remaining baked items. Retiring the built-in Corner is the ④ RELEASE's decision (it handles level's deliberate
 * baked-final status + the corner/probeSeq value-binding work) — NOT unblocked here.
 */

// (1) The remaining baked frontiers — corner quadrant + probeSeq STILL diverge from cornerStack (the twin bakes FL / YX). This
//     documents they are baked (not silently dropped): flip either and the twin emit stays the seeded shape.
test('BAKED FRONTIER: corner quadrant + probeSeq are still baked (sign/order swaps → the twin diverges from cornerStack)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const { cornerDiverges, probeSeqDiverges } = await page.evaluate(async () => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { cornerDataDef, CORNER_DEFAULTS, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
    const { emitEquivalence, stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    registerUserOp(cornerDataDef());
    const build = builderOf(CORNER_DATA_OPTYPE);
    return {
      cornerDiverges:   !emitEquivalence(cornerStack, build, [{ ...CORNER_DEFAULTS, corner: 2 }], {}, stripAnnotations).pass,     // FR ≠ the baked FL
      probeSeqDiverges: !emitEquivalence(cornerStack, build, [{ ...CORNER_DEFAULTS, probeSeq: 1 }], {}, stripAnnotations).pass,   // XY ≠ the baked YX
    };
  });
  expect(cornerDiverges, 'corner quadrant is baked (FL) — a different quadrant diverges (goes live later via value-bindings, NOT prune)').toBe(true);
  expect(probeSeqDiverges, 'probeSeq is baked (YX) — the other order diverges (value-binding follow-on)').toBe(true);
});

// (2) DON'T-RETIRE-THE-BUILT-IN gate (MOVED here from syncA-frontier as syncA went live). corner/probeSeq/level remain baked,
//     so the twin is STILL a limited port; retiring the built-in Corner would drop those. This assertion makes that RED, on
//     purpose. The ④ RELEASE owns the retirement decision (handling level's deliberate baked-final status) — not this test.
test('BAKED FRONTIER GATE: the built-in Corner wizard stays registered while corner/probeSeq/level remain baked', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const builtinCorner = await page.evaluate(async () => {
    const { listEntries } = await import('/blocks/wizardLibrary.js');
    return listEntries().some((e) => e.id === 'corner' && e.type === 'corner' && e.kind === 'builtin');
  });
  expect(builtinCorner, 'built-in Corner (wizardLibrary id:corner) MUST stay registered — corner/probeSeq (value-binding follow-ons) + level (deliberate baked-final) are still baked. The ④ release decides retirement; this test guards it until then.').toBe(true);
});
