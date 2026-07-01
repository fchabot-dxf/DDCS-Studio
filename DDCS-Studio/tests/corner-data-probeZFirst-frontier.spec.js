import { test, expect } from '@playwright/test';

/**
 * CORNER-PORT inc B1 — the probeZFirst FRONTIER GATE (a can't-forget guard, human t178).
 *
 * The "Corner (data)" twin (blocks/dataOps/cornerData.js) bakes probeZFirst=off: ticking it INSERTS a Z-surface
 * probeSurfaceStack + a traverse — a conditional STRUCTURE swap that instantiate() (value-substitution into a FIXED
 * template) cannot perform. So the twin is a LIMITED port; the built-in Corner wizard keeps probeZFirst fully working.
 *
 * This file makes that limitation impossible to forget (unlike a backlog note):
 *   1. a LOUD `test.fixme` documenting the unimplemented probeZFirst shape (shows as fixme in every run), and
 *   2. a REAL gate asserting the built-in Corner stays registered — so any future attempt to RETIRE the built-in while
 *      the twin is still probeZFirst-limited turns the suite RED.
 */

// (1) The frontier itself — INTENTIONALLY not run. When the twin gains a shape-aware builder (def.build) or a Z-first
//     variant, un-fixme this: cornerData's emit must then match cornerStack({...defaults, probeZFirst:1}).
test.fixme('cornerData reproduces the probeZFirst=on emit (BLOCKED: static template cannot add the Z-surface step)', async ({ page }) => {
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
    return emitEquivalence(cornerStack, dataBuilder, [{ ...CORNER_DEFAULTS, probeZFirst: 1 }], {}, stripAnnotations).pass;
  });
  expect(pass, 'the Corner (data) twin reproduces the probeZFirst=on Z-surface shape').toBe(true);
});

// (2) The gate — RUNS every suite. Retiring the built-in Corner while the twin bakes probeZFirst off would silently drop
//     the Z-first capability operators rely on. This assertion makes that RED, on purpose.
test('FRONTIER GATE: the built-in Corner wizard stays registered while the data twin is probeZFirst-limited', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const builtinCorner = await page.evaluate(async () => {
    const { listEntries } = await import('/blocks/wizardLibrary.js');
    return listEntries().some((e) => e.id === 'corner' && e.type === 'corner' && e.kind === 'builtin');
  });
  expect(builtinCorner, 'built-in Corner (wizardLibrary id:corner) MUST stay registered — the data twin bakes probeZFirst OFF, so retiring the built-in would drop Z-first probing. Do NOT retire it until the twin does probeZFirst (this test guards it).').toBe(true);
});
