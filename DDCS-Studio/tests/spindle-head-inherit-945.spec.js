import { test, expect } from '@playwright/test';

/**
 * t945 — THE DEAD-SPINDLE FIX (a real machine-safety bug: a surfacing/cutting DATA-OP emitted NO M3 → the machine
 * plunged + cut with the spindle OFF). Root cause (gate t943): the 6 makeStart-framed cutting twins
 * (surfacing/drill/pocket/contour/bore/slot) seed their template with <op>Stack(<DEFAULTS>) — no spindle → makeStart
 * bakes the framing progstart with rpm 0 — and a data-op emits via instantiate() over that FROZEN template (rpm is not
 * a bound socket), so makeStart is NEVER re-run on data-op emit → progstart rpm 0 → no M3. The live FORM path never had
 * the bug (it injects spindle: s.spindle at generate → makeStart resolves the Head at insert).
 *
 * FIX = a shared spindleHeadPatch postInstantiate (blocks/dataOps/spindleHead.js) opted into by the 6 twins: it fills the
 * blank framing progstart's rpm/dir/spin-up from the LIVE machine Head at BUILD — the SAME insert-time resolution the form
 * does. This asserts the RESULT vs an independent truth (the live Head rpm), not golden==golden:
 *   (1) each of the 6 cutting twins' data-op emit now carries M3 S<Head> (spindle on);
 *   (2) TAP is untouched — no header M3 at the Head rpm (its cycle owns M3 at its own rpm) → no double-spindle;
 *   (3) TEXT is untouched — it bakes its own engrave default (12000) on both form + twin, never the Head → still M3 S12000.
 */

const CUTTING = [
  ['user_surfacing_data', '/blocks/dataOps/surfacingData.js', 'surfacingDataDef'],
  ['user_drill_data', '/blocks/dataOps/drillData.js', 'drillDataDef'],
  ['user_pocket_data', '/blocks/dataOps/pocketData.js', 'pocketDataDef'],
  ['user_contour_data', '/blocks/dataOps/contourData.js', 'contourDataDef'],
  ['user_bore_data', '/blocks/dataOps/boreData.js', 'boreDataDef'],
  ['user_slot_data', '/blocks/dataOps/slotData.js', 'slotDataDef'],
];

test('t945 dead-spindle fix: 6 cutting twins inherit the Head (M3 S<Head>); tap + text untouched', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async (CUTTING) => {
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const head = (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {};

    // Re-register each twin from its code def (independent of boot-seed timing), then emit its default-params data-op.
    const cutting = {};
    for (const [optype, mod, defFn] of CUTTING) {
      const m = await import(mod);
      registerUserOp(m[defFn]());
      cutting[optype] = emitMapped(builderOf(optype)()).text;   // no params → the builder falls back to defaultParams(def)
    }

    const tapMod = await import('/blocks/dataOps/tapData.js');
    registerUserOp(tapMod.tapDataDef());
    const tap = emitMapped(builderOf('user_tap_data')()).text;

    const textMod = await import('/blocks/dataOps/textData.js');
    registerUserOp(textMod.textDataDef());
    const text = emitMapped(builderOf('user_text_data')()).text;

    return { head, cutting, tap, text };
  }, CUTTING);

  expect(errs, 'no pageerrors').toEqual([]);

  // The fix is value-verified against the live Head — the assertions are meaningless if it is 0/absent.
  const rpm = Number(r.head.defaultRpm);
  expect(rpm, 'the default test machine declares a Head defaultRpm > 0').toBeGreaterThan(0);
  const onMcode = r.head.dir === 'ccw' ? 'M4' : 'M3';   // headerBlock picks M4 for a ccw Head
  const headerSpindle = new RegExp(`${onMcode} S${rpm}\\b`);

  // (1) every cutting twin data-op now spins the spindle up at the Head rpm (was DEAD — no M3 at all)
  for (const [optype] of CUTTING) {
    expect(r.cutting[optype], `${optype}: data-op emits the header spindle-on at the Head rpm`).toMatch(headerSpindle);
    expect(r.cutting[optype], `${optype}: the spindle-on annotation is present`).toContain('( spindle on )');
  }

  // (2) TAP: its cycle owns the spindle at its OWN rpm — the header must NOT inherit the Head (no double-spindle)
  expect(r.tap, 'tap does NOT inherit the Head rpm in its header (its cycle self-spindles)').not.toMatch(new RegExp(`S${rpm}\\b`));
  expect(r.tap, 'tap still drives its spindle from the tap cycle (M3/M4 present)').toMatch(/M[34] S\d+/);

  // (3) TEXT: bakes its own engrave default on BOTH form + twin (never the Head) → unchanged, and never dead
  expect(r.text, 'text keeps its baked engrave spindle (12000), NOT the Head').toContain('M3 S12000');
  expect(r.text, 'text does NOT inherit the Head rpm').not.toMatch(new RegExp(`S${rpm}\\b`));
});
