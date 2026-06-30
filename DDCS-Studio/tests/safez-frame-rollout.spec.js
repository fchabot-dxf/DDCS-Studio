import { test, expect } from '@playwright/test';

// SPATIAL MODEL 1c — the safe-Z FRAME rolled out via the shared toggle widget to every wizard with a clean FINAL-PARK safe-Z.
// Per wizard: relative (default) emits the park as the rapid lift (no G53 — byte-identical to today); machine parks the FINAL
// retract via G53 Z#<var>; the frame round-trips through the op marker. (corner is FLAGGED — #17 folds in scanDepth; atc has no
// safe-Z UI field — both deferred, see WORK-LOG.)
const WIZ = [
  { op: 'rotary_center', cls: 'RotaryCenterWizard', mod: 'rotaryCenterWizard.js', v: '#17', base: { method: 'known', diameter: 76.2, datum: 'top' } },
  { op: 'rotary_clock', cls: 'RotaryClockWizard', mod: 'rotaryClockWizard.js', v: '#17', base: {} },
  { op: 'alignment', cls: 'AlignmentWizard', mod: 'alignmentWizard.js', v: '#19', base: {} },
  { op: 'middle', cls: 'MiddleWizard', mod: 'middleWizard.js', v: '#17', base: { featureType: 'boss' } },
];

test('safe-Z frame rollout: each wizard relative byte-identical (no G53), machine = G53 final park, frame round-trips', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async (WIZ) => {
    const { markerLine, parseMarker } = await import('/blocks/opSchema.js');
    const { stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
    const out = {};
    for (const w of WIZ) {
      const mod = await import('/wizards/' + w.mod);
      const wiz = new mod[w.cls]();
      const rel = stripAnnotations(wiz.generate({ ...w.base }));
      const relExplicit = stripAnnotations(wiz.generate({ ...w.base, safeZFrame: 'relative' }));
      const mac = stripAnnotations(wiz.generate({ ...w.base, safeZFrame: 'machine' }));
      const g53 = (t) => (t.match(new RegExp('G53 Z' + w.v.replace('#', '\\#'), 'g')) || []).length;
      const parsed = parseMarker(markerLine(w.op, { ...w.base, safeZFrame: 'machine' }));
      out[w.op] = { defEqRel: rel === relExplicit, rel_g53: g53(rel), mac_g53: g53(mac), parsedFrame: parsed && parsed.params && parsed.params.safeZFrame };
    }
    return out;
  }, WIZ);
  console.log('ROLLOUT ' + JSON.stringify(r));
  for (const w of WIZ) {
    const x = r[w.op];
    expect(x.defEqRel, `${w.op}: frame defaults to relative`).toBe(true);
    expect(x.rel_g53, `${w.op}: relative emits NO G53 (byte-identical to today)`).toBe(0);
    expect(x.mac_g53, `${w.op}: machine parks the final retract via G53 ${w.v}`).toBeGreaterThanOrEqual(1);
    expect(x.parsedFrame, `${w.op}: safeZFrame round-trips through the op marker`).toBe('machine');
  }
});
