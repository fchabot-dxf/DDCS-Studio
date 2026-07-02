import { test, expect } from '@playwright/test';

/**
 * ② B4 step 3 (anchor pass-alignment). Under probeZFirst the corner Z→wall1 traverse is now a `REPOSITION:` delimiter
 * (cornerStack), so the engine's pass counter (it bumps _pass only on a REPOSITION: comment) counts it as its OWN pass:
 * Z-surface = _pass 0, wall-1 = _pass 1, wall-2 = _pass 2 → 3 passes == the 3 declared CORNER_SIM_STARTS markers, 1:1
 * (was 2 passes / 3 markers → wall-2's marker orphaned onto a nonexistent pass). Consistent with the middle wizard, whose
 * Z reposition is already a delimiter.
 *
 * verify-real-symptom (the exact fix, not "something changed"): the RAW emit carries TWO REPOSITION delimiters when
 * probeZ is on (Z→wall1 + wall1→wall2) and ONE when off (wall1→wall2 only). Byte-identical OFF (the Z→wall1 line only
 * exists when probeZ is on); the added prefix is stripAnnotations-invisible, so the functional emit specs are unaffected.
 */
test('corner pass-alignment: Z→wall1 is a REPOSITION delimiter under probeZ (3 passes == 3 markers)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const emit = (p) => emitMapped(cornerStack(p)).text;
    const reps = (t) => (t.match(/REPOSITION:/g) || []).length;
    const off = emit({ probeZ: false }), on = emit({ probeZ: true });
    return {
      offReps: reps(off), onReps: reps(on),
      offHasZWall1: /REPOSITION: Traverse to first wall/.test(off),
      onHasZWall1: /REPOSITION: Traverse to first wall/.test(on),
    };
  });
  expect(r.offReps, 'probeZ OFF: only the wall1→wall2 reposition delimiter (2 passes)').toBe(1);
  expect(r.onReps, 'probeZ ON: Z→wall1 + wall1→wall2 delimiters (3 passes == 3 markers)').toBe(2);
  expect(r.onHasZWall1, 'probeZ ON: the Z→wall1 traverse carries the REPOSITION: prefix (its own pass)').toBe(true);
  expect(r.offHasZWall1, 'probeZ OFF: no Z→wall1 traverse at all → byte-identical').toBe(false);
});
