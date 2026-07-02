import { test, expect } from '@playwright/test';

/**
 * `wcs` FRONTIER GATE (a can't-forget guard; the successor to the retired probeZFirst/travelApproach frontiers as those went
 * live). "Corner (data)" bakes wcs='active': the twin reads the active WCS (#71=#578 → computes the base address #70). A
 * FIXED G54..G59 target is a DIFFERENT shape — a literal `#70=805..830` and a "Target: G5x" header, with the #71/#72 active
 * read GONE — so active→fixed is a 7-way STRUCTURE swap the static template bakes. wcs-live is ② B4 step 4c (same guard/prune).
 *
 * This makes the limitation impossible to forget (same shape as the earlier frontier specs):
 *   1. a LOUD `test.fixme` documenting the unbuilt fixed-WCS shape (un-fixme when 4c wires the 7-way guard), and
 *   2. a REAL gate asserting the twin BAKES the active read + IGNORES a fixed wcs param (proving it's baked, not live), and
 *   3. the MOVED don't-retire-the-built-in gate: the built-in Corner MUST stay registered while ANY frontier (wcs/syncA/
 *      corner/probeSeq) is baked — moved here from the travelApproach-frontier spec as travelApproach went live.
 */

// (1) The frontier itself — INTENTIONALLY not run. Un-fixme when the twin gains the 7-way wcs guard (② B4 step 4c):
//     cornerData's emit must then match cornerStack({...defaults, wcs:1}) (the fixed-G54 literal shape).
test.fixme('cornerData reproduces the wcs=G54 emit (BLOCKED: static template bakes the active-WCS read)', async ({ page }) => {
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
    return emitEquivalence(cornerStack, dataBuilder, [{ ...CORNER_DEFAULTS, wcs: 1 }], {}, stripAnnotations).pass;
  });
  expect(pass, 'the Corner (data) twin reproduces the fixed-WCS (G54) shape').toBe(true);
});

// (2) The gate — RUNS every suite. The twin bakes ACTIVE wcs: its default emit reads #71=#578 and computes #70; and a fixed
//     wcs param does NOT change that (the twin ignores it = baked). Wiring the 7-way guard makes build({wcs:1}) honor it →
//     the active read vanishes → this gate goes RED, forcing the spec to retire in lockstep with 4c.
test('FRONTIER GATE: the Corner (data) twin BAKES the active-WCS read (#71=#578) and ignores a fixed wcs param', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const { defaultReadsActive, g54StillReadsActive, g54HasFixedLiteral } = await page.evaluate(async () => {
    const { cornerDataDef, CORNER_DATA_OPTYPE, CORNER_DEFAULTS } = await import('/blocks/dataOps/cornerData.js');
    const { stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    registerUserOp(cornerDataDef());
    const build = builderOf(CORNER_DATA_OPTYPE);
    const def = stripAnnotations(emitMapped(build({})).text);                                   // baked default (wcs=active)
    const g54 = stripAnnotations(emitMapped(build({ ...CORNER_DEFAULTS, wcs: 1 })).text);       // ask for G54 — twin bakes active anyway
    return {
      defaultReadsActive: /^#71=#578$/m.test(def),
      g54StillReadsActive: /^#71=#578$/m.test(g54),
      g54HasFixedLiteral: /^#70=805$/m.test(g54),
    };
  });
  expect(defaultReadsActive, 'the twin bakes wcs=active → its default emit reads #71=#578 (compute the base address).').toBe(true);
  expect(g54StillReadsActive, 'the twin IGNORES a fixed wcs param (bakes active) — proof it is BAKED, not live. Un-fixme (1) + retire this spec when 4c wires the 7-way guard.').toBe(true);
  expect(g54HasFixedLiteral, 'the twin must NOT emit the fixed #70=805 literal yet — that shape is ② B4 step 4c work the static template bakes.').toBe(false);
});

// (3) DON'T-RETIRE-THE-BUILT-IN gate (MOVED here from travelApproach-frontier as travelApproach went live). wcs/syncA (+ the
//     corner quadrant / probeSeq) stay baked, so the twin is STILL a limited port; retiring the built-in Corner would drop
//     those capabilities operators rely on. This assertion makes that RED, on purpose.
test('FRONTIER GATE: the built-in Corner wizard stays registered while ANY structural frontier (wcs/syncA/corner/probeSeq) is baked', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const builtinCorner = await page.evaluate(async () => {
    const { listEntries } = await import('/blocks/wizardLibrary.js');
    return listEntries().some((e) => e.id === 'corner' && e.type === 'corner' && e.kind === 'builtin');
  });
  expect(builtinCorner, 'built-in Corner (wizardLibrary id:corner) MUST stay registered until the twin reaches FULL parity — wcs/syncA (+ corner/probeSeq) are still baked, so retiring it would drop those. Do NOT retire it until those land (this test guards it).').toBe(true);
});
