import { test, expect } from '@playwright/test';

/**
 * `syncA` FRONTIER GATE (a can't-forget guard; the LAST baked structural frontier — successor to the retired probeZFirst/
 * travelApproach/wcs frontiers as those went live). "Corner (data)" bakes syncA OFF: a dual-gantry sync APPENDS a block —
 * "Dual Gantry Sync" + G1 A0 + a slave-offset write (#74=[#70+slave], #[#74]=#883). That's a conditional block-ADD (like
 * probeZFirst's Z step), which the static template bakes. syncA-live is ② B4 step 4d (the same guard/prune), then the ④
 * release retires the built-in.
 *
 *   1. a LOUD `test.fixme` documenting the unbuilt syncA=on shape (un-fixme when 4d wires the guard), and
 *   2. a REAL gate asserting the twin BAKES syncA off (no sync block) + IGNORES a syncA param (proving it's baked), and
 *   3. the MOVED don't-retire-the-built-in gate: the built-in Corner MUST stay registered while ANY frontier (syncA + the
 *      corner quadrant / probeSeq) is baked — moved here from the wcs-frontier spec as wcs went live.
 */

// (1) The frontier itself — INTENTIONALLY not run. Un-fixme when the twin gains the syncA guard (② B4 step 4d):
//     cornerData's emit must then match cornerStack({...defaults, syncA:1}) (the dual-gantry-sync block).
test.fixme('cornerData reproduces the syncA=on emit (BLOCKED: static template bakes syncA off)', async ({ page }) => {
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
    return emitEquivalence(cornerStack, dataBuilder, [{ ...CORNER_DEFAULTS, syncA: 1 }], {}, stripAnnotations).pass;
  });
  expect(pass, 'the Corner (data) twin reproduces the syncA=on dual-gantry shape').toBe(true);
});

// (2) The gate — RUNS every suite. The twin bakes syncA OFF: no "Dual Gantry Sync" / G1 A0 / #74 slave write, and a syncA
//     param does NOT add it (the twin ignores it = baked). Wiring the guard makes build({syncA:1}) honor it → the sync block
//     appears → this gate goes RED, forcing the spec to retire in lockstep with 4d.
test('FRONTIER GATE: the Corner (data) twin BAKES syncA off (no dual-gantry sync block) and ignores a syncA param', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const { defaultHasSync, syncParamAddsIt } = await page.evaluate(async () => {
    const { cornerDataDef, CORNER_DATA_OPTYPE, CORNER_DEFAULTS } = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    registerUserOp(cornerDataDef());
    const build = builderOf(CORNER_DATA_OPTYPE);
    const hasSync = (t) => /Dual Gantry Sync/.test(t) || /G1 A0/.test(t) || /#74=/.test(t);
    return {
      defaultHasSync: hasSync(emitMapped(build({})).text),                                  // baked default (syncA off)
      syncParamAddsIt: hasSync(emitMapped(build({ ...CORNER_DEFAULTS, syncA: 1 })).text),   // ask for sync — twin bakes off anyway
    };
  });
  expect(defaultHasSync, 'the twin bakes syncA off → its default emit has NO dual-gantry sync block.').toBe(false);
  expect(syncParamAddsIt, 'the twin IGNORES a syncA param (bakes off) — proof it is BAKED, not live. Un-fixme (1) + retire this spec when 4d wires the guard.').toBe(false);
});

// (3) DON'T-RETIRE-THE-BUILT-IN gate (MOVED here from wcs-frontier as wcs went live). syncA (+ the corner quadrant / probeSeq)
//     stay baked, so the twin is STILL a limited port; retiring the built-in Corner would drop those. This assertion makes
//     that RED, on purpose. When 4d lands syncA, move this gate to the ④ release check that retires the built-in.
test('FRONTIER GATE: the built-in Corner wizard stays registered while ANY structural frontier (syncA/corner/probeSeq) is baked', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const builtinCorner = await page.evaluate(async () => {
    const { listEntries } = await import('/blocks/wizardLibrary.js');
    return listEntries().some((e) => e.id === 'corner' && e.type === 'corner' && e.kind === 'builtin');
  });
  expect(builtinCorner, 'built-in Corner (wizardLibrary id:corner) MUST stay registered until the twin reaches FULL parity — syncA (+ corner/probeSeq) are still baked, so retiring it would drop those. Do NOT retire it until 4d + the quadrant/probeSeq land (this test guards it).').toBe(true);
});
