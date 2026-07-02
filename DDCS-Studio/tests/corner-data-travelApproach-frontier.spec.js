import { test, expect } from '@playwright/test';

/**
 * ① AUTO/MANUAL TRAVEL — the travelApproach FRONTIER GATE (a can't-forget guard; mirrors the probeZFirst frontier).
 *
 * "Corner (data)" (blocks/dataOps/cornerData.js) bakes travelApproach='auto': each wall-to-wall traverse is a hands-free
 * G0 seq move (safeTraverseStack seq → `G0 X#23 Y#24`). MANUAL travel is a DIFFERENT block shape — a `#1505` "jog +
 * Press Enter" operator prompt (middle's reposition() helper), not a move — so auto→manual is a conditional STRUCTURE
 * swap that instantiate() (value-substitution into a FIXED template) cannot perform. The twin is therefore auto-ONLY; the
 * LIVE toggle lands with the structural-toggle capability (② / B4).
 *
 * This makes that limitation impossible to forget (same two-test shape as corner-data-probeZFirst-frontier.spec.js):
 *   1. a LOUD `test.fixme` documenting the unbuilt manual shape (shows as fixme in every run), and
 *   2. a REAL gate asserting the twin's default emit IS the auto travel (a G0 move on #23/#24) and NOT a #1505 jog prompt —
 *      so if the baked default is flipped to 'manual' before the structural toggle is wired, this test goes RED.
 */

// (1) The frontier itself — INTENTIONALLY not run. Un-fixme when the twin gains a shape-aware builder / manual variant:
//     cornerData's emit must then match cornerStack({...defaults, travelApproach:'manual'}) (the #1505 jog-prompt shape).
test.fixme('cornerData reproduces the travelApproach=manual emit (BLOCKED: static template cannot swap the G0 move for a #1505 jog prompt)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const pass = await page.evaluate(async () => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { cornerDataDef, CORNER_DEFAULTS, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
    const { emitEquivalence, stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    registerUserOp(cornerDataDef());
    const dataBuilder = builderOf(CORNER_DATA_OPTYPE);
    return emitEquivalence(cornerStack, dataBuilder, [{ ...CORNER_DEFAULTS, travelApproach: 'manual' }], {}, stripAnnotations).pass;
  });
  expect(pass, 'the Corner (data) twin reproduces the travelApproach=manual jog-prompt shape').toBe(true);
});

// (2) The gate — RUNS every suite. The twin bakes AUTO travel: its default emit MUST contain the hands-free G0 seq move to
//     wall 2 (X#23 Y#24) and must NOT contain a #1505 "jog + Press Enter" reposition prompt. Flipping the baked default to
//     'manual' without wiring the structural block-swap makes this RED (the emit stays auto, contradicting the intent).
test('FRONTIER GATE: the Corner (data) twin emits AUTO travel (G0 move on #23/#24), NOT a #1505 jog prompt', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const { gcode, hasAutoMove, hasManualPrompt } = await page.evaluate(async () => {
    const { cornerDataDef, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
    const { stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    registerUserOp(cornerDataDef());
    const gcode = stripAnnotations(emitMapped(builderOf(CORNER_DATA_OPTYPE)({})).text);   // {} → all baked defaults (travelApproach='auto')
    return {
      gcode,
      hasAutoMove: /^G0 X#23 Y#24$/m.test(gcode),          // the wall1→wall2 seq traverse (auto)
      hasManualPrompt: /#1505=1 .*(repositioned|Jog clear)/i.test(gcode),   // the middle-style operator jog-and-wait prompt
    };
  });
  expect(hasAutoMove, `the twin bakes travelApproach='auto' → its wall-to-wall traverse MUST be a hands-free G0 move on #23/#24. Missing it means the auto bake broke or the default was flipped. Emitted:\n${gcode}`).toBe(true);
  expect(hasManualPrompt, `the twin must NOT emit a manual #1505 jog prompt — that shape is ②/B4 structural-toggle work the static template cannot instantiate. If this is true, someone flipped travelApproach to 'manual' without wiring the block swap.`).toBe(false);
});

// (3) DON'T-RETIRE-THE-BUILT-IN gate (MOVED here when the probeZFirst frontier was retired — probeZFirst is now live via
//     guard/prune, but travelApproach/wcs/syncA stay baked, so the twin is STILL a limited port). Retiring the built-in
//     Corner now would drop those still-baked capabilities operators rely on. This assertion makes that RED, on purpose.
test('FRONTIER GATE: the built-in Corner wizard stays registered while ANY structural frontier (travelApproach/wcs/syncA) is baked', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const builtinCorner = await page.evaluate(async () => {
    const { listEntries } = await import('/blocks/wizardLibrary.js');
    return listEntries().some((e) => e.id === 'corner' && e.type === 'corner' && e.kind === 'builtin');
  });
  expect(builtinCorner, 'built-in Corner (wizardLibrary id:corner) MUST stay registered until the twin reaches FULL parity — travelApproach/wcs/syncA are still baked, so retiring it would drop those. Do NOT retire it until 4b/4c/4d land (this test guards it).').toBe(true);
});
