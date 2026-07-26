import { test, expect } from '@playwright/test';

/**
 * t1207 — THE CORNER RE-DESCEND, MEASURED THROUGH THE REAL STEPPED EDITOR (the regression t1205 flagged as blocked).
 *
 * A corner probe lifts to a machine-frame safe Z between walls, crosses in XY, then must DROP BACK to the same scan
 * depth so wall 2 is probed from the height wall 1 was. The emit declares that pairing with two markers —
 * `#95=#882 ( @saveProbeZ )` and `G53 Z#95 ( @returnProbeZ )` — which the sim reads off the raw line.
 *
 * WHY THIS TEST EXISTS AT THE EDITOR LEVEL, not just the trace: the editor is periodically RE-PROJECTED from the block
 * model (programModel → setValue(proj.text)), and gcodeToStack's machinemove parse used to DROP the trailing marker
 * comment, so the re-emitted program carried a bare `G53 Z#95`. The sim then could not recognise the pair, the return
 * degraded to the raw machine map, and wall 2 probed a full safe-Z margin off — while a pure trace-level test stayed
 * green because the trace never round-trips through the editor. So this asserts the property in the host where it broke.
 *
 * Non-circular: the expected value is wall 1's OWN measured probe height (an independent truth read from the same DRO),
 * never a literal. Asserted in BOTH columns — Work and Mach — because the WCS offset is what made the drift visible.
 */
const BASE = 'http://localhost:3211';
const STEP = '#viz3d-panel-host .pp-step';
const WCS = { x: 40, y: -550, z: -75 };   // shaped like the user's live G54 (a large Z offset makes any map-fallback obvious)

test('stepping the corner emit: the marked G53 return re-descends, so wall 2 probes at wall 1 height (Work AND Mach)', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.ddcsGetSettings && typeof window.setGcodeView === 'function' && !!window.ddcsGetBlockProgram);
  const program = await page.evaluate(async (wcs) => {
    const s = window.ddcsGetSettings();
    s.machine = { x: 600, y: 400, z: -120, show: true, safeZMargin: 5, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: [wcs] } };
    s.preview = s.preview || {}; s.preview.autoLoop = false;
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    return emitMapped(cornerStack({ ...CD.CORNER_DEFAULTS })).text;
  }, WCS);

  const lines = program.split('\n');
  const retIdx = lines.findIndex((t) => /@returnProbeZ/.test(t));
  const g31 = lines.map((t, i) => (/\bG31\b/.test(t) ? i : -1)).filter((i) => i >= 0);
  const wall1 = g31.filter((i) => i < retIdx).pop();          // wall 1's last (slow) probe, before the traverse
  const wall2 = g31.find((i) => i > retIdx);                  // wall 2's first probe, after the return
  expect(retIdx, 'the emit declares a @returnProbeZ marker').toBeGreaterThan(0);
  expect(wall1, 'a wall-1 G31 exists before the return').toBeGreaterThan(0);
  expect(wall2, 'a wall-2 G31 exists after the return').toBeGreaterThan(retIdx);

  await page.locator('#editor').fill(program);
  await page.evaluate(() => window.setGcodeView('3d'));
  await page.waitForSelector(STEP, { state: 'attached', timeout: 8000 });

  const readDro = () => page.evaluate(() => {
    const g = (ax, c) => { const r = document.querySelector(`#viz3d-panel-host .pp-dro-tbl tr[data-ax="${ax}"]`); return r ? parseFloat(r.querySelector(c).textContent) : NaN; };
    return { wz: g('z', '.pp-dro-w'), mz: g('z', '.pp-dro-m') };
  });

  // Step line-by-line; record the readout after the step that executed each line of interest.
  const at = {};
  for (let i = 0; i <= wall2; i++) {
    await page.locator(STEP).click();
    await page.waitForTimeout(30);
    if (i === wall1 || i === wall2 || i === retIdx) at[i] = await readDro();
  }

  // THE MARKER SURVIVED THE EDITOR ROUND-TRIP (the round-trip loss is what this guards)
  const editorNow = await page.evaluate(() => document.getElementById('editor').value);
  expect(/@returnProbeZ/.test(editorNow), 'the declared @returnProbeZ marker survives the editor re-projection').toBe(true);

  // THE RETURN RE-DESCENDS: it lands back at the saved probe depth, not at the safe-Z / raw-map height.
  expect(at[retIdx].mz, 'the marked G53 return restores the SAVED machine Z (the scan depth), not the lift height').toBeCloseTo(at[wall1].mz, 1);

  // THE PROPERTY THAT MATTERS: wall 2 is probed from wall 1's height — in BOTH columns.
  expect(at[wall2].wz, 'wall 2 probes at wall 1 Work Z').toBeCloseTo(at[wall1].wz, 1);
  expect(at[wall2].mz, 'wall 2 probes at wall 1 Mach Z').toBeCloseTo(at[wall1].mz, 1);
  // and the readout is a REAL machine height under the declared WCS — never the un-offset work number
  expect(at[wall1].mz, 'Mach = Work + the declared G54 Z (the readout is honest, not the pass-local number)').toBeCloseTo(at[wall1].wz + WCS.z, 1);
});
