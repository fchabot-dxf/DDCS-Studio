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

    // (4) INDEPENDENT VALUE PINS — the parity above is twin-vs-SELF (both prune the SAME cornerStack superset, sharing
    //     WCS_BASE + wcsLabelOf), so a wrong base VALUE for a middle arm can't be caught by parity. Extract the literal #70
    //     each fixed WCS writes (`#70=<n>`; `#[#70]` indirect refs don't match) so the assertions can pin it vs an
    //     INDEPENDENT truth table. Also pin the Y-save + Z-compNote LABELS for a fixed WCS (only the X-note@G54 was pinned).
    const fixedBases = {};
    for (const w of ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']) {
      fixedBases[w] = Number((emit(build, S({ wcs: w })).match(/#70=(\d+)/) || [])[1]);
    }
    const g54Z = emit(build, S({ wcs: 'G54', probeZFirst: 1 }));

    return {
      wcsType: wcsBind && wcsBind.type, wcsDefault: wcsBind && wcsBind.default, opts,
      parity,
      activeReads578: /#71=#578/.test(active),
      activeLabels:   /Save to Active WCS X/.test(active),
      g54HasLiteral:  /#70=805\b/.test(g54) && /Target: G54/.test(g54) && /Save to G54 X/.test(g54),
      g54NoActiveRead: !/#71=#578/.test(g54),
      g59HasLiteral:  /#70=830\b/.test(g59) && /Target: G59/.test(g59),
      fixedBases,
      g54YNote: /Save to G54 Y/.test(g54),          // the Y save note carries the fixed label
      g54ZNote: /Save G54 Z offset/.test(g54Z),      // the Z-surface compNote (only emitted at probeZFirst:1)
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
  // (4) INDEPENDENT LITERAL PINS — assert every fixed WCS writes the CORRECT #70 base against a HARDCODED truth table (NOT
  //     read from WCS_BASE), cross-checked vs the active formula 805+idx*5. A wrong base = the corner written to the WRONG
  //     WCS register on a real machine; twin-vs-self parity can't catch it (both sides share WCS_BASE). ASSERT THE VALUE.
  const WCS_TRUTH = { G54: 805, G55: 810, G56: 815, G57: 820, G58: 825, G59: 830 };
  Object.keys(WCS_TRUTH).forEach((w, i) => {
    expect(WCS_TRUTH[w], `truth table self-consistent: ${w} == 805 + idx*5 (idx=${i})`).toBe(805 + i * 5);
    expect(r.fixedBases[w], `${w} writes the base address #70=${WCS_TRUTH[w]} (independent literal pin — a WCS_BASE typo here fails, unlike twin-vs-self parity)`).toBe(WCS_TRUTH[w]);
  });
  expect(r.g54YNote, 'the Y save note carries the fixed label "Save to G54 Y" at wcs=G54').toBe(true);
  expect(r.g54ZNote, 'the Z-surface compNote carries the fixed label "Save G54 Z offset" at wcs=G54 probeZFirst=1').toBe(true);
});
