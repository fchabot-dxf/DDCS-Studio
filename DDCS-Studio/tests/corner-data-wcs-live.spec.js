import { test, expect } from '@playwright/test';

/**
 * ② B4 step 4c — wcs goes LIVE on the "Corner (data)" twin (batch fork 2/3; the highest-risk 7-way). A 7-WAY enum toggle
 * (active|G54|G55|G56|G57|G58|G59): the superset `wcsFork` emits all 7 arms — the 'active' arm reads #578 → computes the base
 * #70; each fixed G54..G59 arm uses the literal base — each guarded by when(wcs==value); instantiate() prunes to the selected.
 * The derived `wcsLabel` bleeds into 4 comments (header + the X/Y/Z save notes), so wcsFork carries the label WITH each arm.
 *
 * HARDENED live-spec pattern: READS the 7-option enum binding's OWN wiring from def.bindings and DRIVES the emit from the
 * declared option values (never hardcoded), so a mis-wire fails. Asserts:
 *   (1) the binding declares type:'enum', default 'active', the 7 options;
 *   (2) FULL byte-for-byte parity with cornerStack for ALL 7 arms × both probeZFirst states (exercises the Z-compNote wcs
 *       fork too) — 14 combos;
 *   (3) the real toggle symptom: 'active' reads #578; a fixed target writes the literal base + "Target: G5x" + the labelled
 *       save notes, with the active read gone.
 */
test('wcs LIVE: 7-way enum binding drives all arms == cornerStack byte-for-byte across the wcs×probeZFirst matrix', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');

    const def = CD.cornerDataDef();
    registerUserOp(def);
    const build = builderOf(CD.CORNER_DATA_OPTYPE);
    const S = (o) => ({ ...CD.CORNER_DEFAULTS, ...o });
    const emit = (fn, p) => emitMapped(fn(p)).text;

    // (1) READ the enum binding's OWN wiring.
    const wcsBind = (def.bindings || []).find((b) => b.param === 'wcs');
    const opts = ((wcsBind && wcsBind.widgetConfig && wcsBind.widgetConfig.options) || []).map((o) => o[1]);

    // (2) FULL byte-for-byte parity — every declared wcs option × both probeZFirst states (the Z-compNote also forks on wcs).
    const parity = [];
    for (const wcs of opts) for (const pz of [0, 1]) {
      const p = S({ wcs, probeZFirst: pz });
      parity.push({ wcs, pz, equal: emit(build, p) === emit(cornerStack, p) });
    }

    // (3) the real toggle symptom
    const active = emit(build, S({ wcs: 'active' }));
    const g54    = emit(build, S({ wcs: 'G54' }));
    const g59    = emit(build, S({ wcs: 'G59' }));

    return {
      wcsType: wcsBind && wcsBind.type, wcsDefault: wcsBind && wcsBind.default, opts,
      parity,
      activeReads578: /#71=#578/.test(active),
      activeLabels:   /Save to Active WCS X/.test(active),
      g54HasLiteral:  /#70=805\b/.test(g54) && /Target: G54/.test(g54) && /Save to G54 X/.test(g54),
      g54NoActiveRead: !/#71=#578/.test(g54),
      g59HasLiteral:  /#70=830\b/.test(g59) && /Target: G59/.test(g59),
    };
  });

  // (1) the binding declares the 7-way enum wiring
  expect(r.wcsType, 'wcs is an enum binding (drives the form dropdown + the guard prune)').toBe('enum');
  expect(r.wcsDefault, 'wcs defaults to active (reads the controller #578)').toBe('active');
  expect(r.opts, 'the binding declares the 7 WCS options that drive the guards').toEqual(['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59']);
  // (2) FULL byte-for-byte parity across all 7 arms × both probeZFirst states
  for (const c of r.parity) {
    expect(c.equal, `twin == cornerStack byte-for-byte at wcs=${c.wcs} probeZFirst=${c.pz}`).toBe(true);
  }
  // (3) the toggle actually swaps the WCS-base shape + the labels
  expect(r.activeReads578 && r.activeLabels, 'active: reads #578 + labels the save notes "Active WCS"').toBe(true);
  expect(r.g54HasLiteral, 'G54: writes the literal base #70=805 + "Target: G54" + "Save to G54 X"').toBe(true);
  expect(r.g54NoActiveRead, 'G54: the #578 active read is GONE (fixed target)').toBe(true);
  expect(r.g59HasLiteral, 'G59: writes the literal base #70=830 + "Target: G59"').toBe(true);
});
