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

// (2) t339 E4 — IN-PLACE SWAP: the Corner slot is BACK in the Probe bar (in-place, human t332), but it `opensAs` the
//     "Corner (data)" twin — the built-in VIEW stays retired (the click opens user_corner_data, never the built-in corner
//     wizard). This asserts the in-place entry EXISTS + re-points to the twin. The SHIM stays: cornerStack / BUILDERS.corner
//     / SCHEMA.corner keep legacy saved 'corner' ops rendering. (Supersedes the ④ "no corner entry" assertion — corner was
//     retired-and-RELOCATED to a data-wiz folder [the pilot gap]; E4 makes it truly in-place via opensAs.)
test('IN-PLACE: the Corner Probe slot opens the data-op twin (opensAs), the built-in view stays retired', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const cornerEntry = await page.evaluate(async () => {
    const { listEntries } = await import('/blocks/wizardLibrary.js');
    const e = listEntries().find((x) => x.id === 'corner' && x.type === 'corner' && x.kind === 'builtin');
    return e ? { opensAs: e.opensAs, group: e.group } : null;
  });
  expect(cornerEntry, 'the Corner slot is back IN-PLACE (a built-in entry in the Probe group)').toBeTruthy();
  expect(cornerEntry.group, 'in its Probe slot (not a separate Data Wiz folder)').toBe('probe');
  expect(cornerEntry.opensAs, 'but it OPENS the data-op twin (opensAs → user_corner_data); the built-in corner VIEW stays retired').toBe('user_corner_data');
});
