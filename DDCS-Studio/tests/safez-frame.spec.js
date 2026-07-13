import { test, expect } from '@playwright/test';

// SPATIAL MODEL inc1 — the declared safe-Z FRAME on the rotary FINAL retract/park (SPATIAL-MODEL-SPEC.md §A). A shared
// primitive (safeZ.frame param + the frame-aware safeZParkBlock helper): relative (DEFAULT) is byte-identical to today; machine
// parks via the DDCS-correct G53 (dialect.machineMove — ground-truth-confirmed). Scope = the final park only; the error-path
// retract stays relative. The frame round-trips through the op marker.
test('safe-Z frame on the rotary final park: relative byte-identical, machine = G53, frame round-trips', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { RotaryCenterWizard } = await import('/wizards/rotaryCenterWizard.js');
    const { markerLine, parseMarker } = await import('/blocks/opSchema.js');
    const { stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
    const w = new RotaryCenterWizard();
    const base = { method: 'known', diameter: 76.2, datum: 'top', safeZ: '15' };
    const def = stripAnnotations(w.generate({ ...base }));                          // default → relative
    const rel = stripAnnotations(w.generate({ ...base, safeZFrame: 'relative' }));
    const mac = stripAnnotations(w.generate({ ...base, safeZFrame: 'machine' }));
    const count = (t, re) => (t.match(re) || []).length;
    const marker = markerLine('rotary_center', { ...base, safeZFrame: 'machine' });   // round-trip via the op marker
    const parsed = parseMarker(marker);
    return {
      defEqRel: def === rel,
      rel_g53: count(rel, /G53 Z#17/g), rel_g0: count(rel, /G0 Z#17/g),
      mac_g53: count(mac, /G53 Z#17/g), mac_g0: count(mac, /G0 Z#17/g),
      hasMarkerFrame: /@DDCS/.test(marker) && marker.includes('machine'),
      parsedFrame: parsed && parsed.params && parsed.params.safeZFrame,
    };
  });
  console.log('SAFEZFRAME ' + JSON.stringify(r));
  // relative = today for the FINAL PARK: it defaults to relative (G0 Z#17). t824/t826 — the per-probe reposition lift + the
  // error retract are now the machine-frame safe-Z margin (G53 Z#520, NOT G53 Z#17), so only the final park is a G0 Z#17 here.
  expect(r.defEqRel, 'the frame defaults to relative (default emit === explicit relative)').toBe(true);
  expect(r.rel_g53, 'relative final park emits NO G53 Z#17').toBe(0);
  expect(r.rel_g0, 'relative: only the FINAL PARK is a G0 Z#17 lift (the reposition/error retracts are now G53 Z#520)').toBe(1);
  // machine = the new path: the FINAL park swaps to G53 Z#17; the reposition/error retracts already moved to G53 Z#520 (t824/t826)
  expect(r.mac_g53, 'machine parks the final retract via G53 Z#17').toBe(1);
  expect(r.mac_g0, 'no G0 Z#17 left in machine mode (final park + reposition + error all machine-frame)').toBe(0);
  // round-trip: the frame survives the op marker
  expect(r.parsedFrame, 'safeZFrame round-trips through the op marker').toBe('machine');
});
