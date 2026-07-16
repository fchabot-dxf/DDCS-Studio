import { test, expect } from '@playwright/test';

/**
 * ② B4 step 4e (t328) — travelShape goes LIVE on the "Corner (data)" twin: an ENUM structural toggle (dogleg|diagonal) that
 * reshapes ONLY the wall1→wall2 AUTO traverse. dogleg (default) routes AROUND the outside corner (firstAxis=sA → two axis-aligned
 * rapids) = BYTE-IDENTICAL to today; diagonal omits firstAxis (a single straight XY) at the EXISTING post-retract height —
 * OPT-A (advisor t328): the wall retract ALREADY lifted the tool to the safe-traverse height, so the diagonal crosses STRAIGHT
 * with ZERO added Z and the SAME drop.
 *
 * It READS the enum binding's OWN wiring from def.bindings (a mis-declaration fails here), then asserts:
 *   (1) the binding declares type:'enum', default 'dogleg', options {dogleg, diagonal};
 *   (2) DOGLEG DEFAULT is a byte-for-byte no-op: twin==cornerStack across probeZFirst AND cornerStack(dogleg)==cornerStack(omitted)
 *       — proving the goldens (which run at CORNER_DEFAULTS) are untouched;
 *   (3) DIAGONAL = the single straight XY at the retract height, ZERO added Z (assert the VALUE + a mutation), BOTH probeZ states —
 *       the tightest proof: diagonal === dogleg with the two-move L merged into one combined move, nothing else changed;
 *   (4) MANUAL is travelShape-agnostic (the operator jogs — firstAxis is a no-op there).
 */
test('travelShape LIVE: dogleg==cornerStack byte-for-byte (default no-op); diagonal = one straight XY at the retract height, ZERO added Z, both probeZ states', async ({ page }) => {
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

    // (1) READ the enum binding's OWN wiring — a mis-declaration fails here.
    const tsBind = (def.bindings || []).find((b) => b.param === 'travelShape');
    const opts = ((tsBind && tsBind.widgetConfig && tsBind.widgetConfig.options) || []).map((o) => o[1]);

    // (2) DOGLEG default = byte-for-byte no-op (twin==built-in AND dogleg==omitted), both probeZ states.
    const parity = [];
    for (const pz of [0, 1]) {
      const pDog = S({ probeZFirst: pz, travelShape: 'dogleg' });
      const pOmit = S({ probeZFirst: pz });               // travelShape ABSENT → resolves to dogleg default
      delete pOmit.travelShape;
      parity.push({
        pz,
        twinEqBuiltin: emit(build, pDog) === emit(cornerStack, pDog),   // twin == cornerStack at dogleg
        doglegEqOmitted: emit(cornerStack, pDog) === emit(cornerStack, pOmit),   // dogleg == pre-feature (goldens untouched)
      });
    }

    // (3) DIAGONAL = the single straight XY at the retract height, ZERO added Z, both probeZ states.
    const diag = [];
    for (const pz of [0, 1]) {
      const dogleg = emit(build, S({ probeZFirst: pz, travelShape: 'dogleg' }));
      const diagonal = emit(build, S({ probeZFirst: pz, travelShape: 'diagonal' }));
      diag.push({
        pz,
        mutated: diagonal !== dogleg,
        // FL/YX → 2nd wall = X → firstAxis='X' → dogleg is `G0 X#23` then `G0 Y#24`; diagonal merges to one combined move.
        diagHasCombined: /^G0 X#23 Y#24$/m.test(diagonal),
        doglegIsTwoMove: /G0 X#23\nG0 Y#24/.test(dogleg) && !/^G0 X#23 Y#24$/m.test(dogleg),
        // ZERO added Z: the count of rapid-Z moves is IDENTICAL (the diagonal only merges the two XY rapids).
        zCountEqual: (diagonal.match(/G0 Z/g) || []).length === (dogleg.match(/G0 Z/g) || []).length,
        // the correct OPT-A drop is present + UNCHANGED from the dogleg: ON → #18 (=-#17), OFF → [0-#19] (=-safeZ).
        dropValueOk: pz ? /G0 Z#18/.test(diagonal) : /G0 Z\[0-#19\]/.test(diagonal),
        // THE TIGHTEST PROOF: the diagonal IS the dogleg with the two-move L merged into one — nothing else changed (no Z, no reorder).
        onlyDiffIsTheMerge: diagonal === dogleg.replace('G0 X#23\nG0 Y#24', 'G0 X#23 Y#24'),
      });
    }

    // (4) MANUAL is travelShape-agnostic (the operator jogs; firstAxis is a no-op on the manual arm).
    const manualAgnostic = emit(build, S({ travelApproach: 'manual', travelShape: 'diagonal' }))
                        === emit(build, S({ travelApproach: 'manual', travelShape: 'dogleg' }));

    return { tsType: tsBind && tsBind.type, tsDefault: tsBind && tsBind.default, opts, parity, diag, manualAgnostic };
  });

  // (1) the binding declares the enum wiring
  expect(r.tsType, 'travelShape is an enum binding (drives the segmented control + the guard prune)').toBe('enum');
  expect(r.tsDefault, 'travelShape defaults to dogleg (the twin ships the safe around-the-corner shape)').toBe('dogleg');
  expect(r.opts, 'the binding declares the dogleg/diagonal options that drive the guards').toEqual(['dogleg', 'diagonal']);

  // (2) DOGLEG DEFAULT is byte-identical to today (goldens untouched)
  for (const c of r.parity) {
    expect(c.twinEqBuiltin, `dogleg: twin == cornerStack byte-for-byte at probeZFirst=${c.pz}`).toBe(true);
    expect(c.doglegEqOmitted, `dogleg == travelShape-omitted (a pure no-op default) at probeZFirst=${c.pz}`).toBe(true);
  }

  // (3) DIAGONAL = the single straight XY, ZERO added Z, both probeZ states
  for (const c of r.diag) {
    expect(c.mutated, `diagonal ACTUALLY changes the emit at probeZFirst=${c.pz}`).toBe(true);
    expect(c.diagHasCombined, `diagonal: one combined G0 X#23 Y#24 straight move at probeZFirst=${c.pz}`).toBe(true);
    expect(c.doglegIsTwoMove, `dogleg (contrast): the two-move L, NOT the combined move, at probeZFirst=${c.pz}`).toBe(true);
    expect(c.zCountEqual, `diagonal adds ZERO Z moves (same rapid-Z count as the dogleg) at probeZFirst=${c.pz}`).toBe(true);
    expect(c.dropValueOk, `diagonal keeps the correct OPT-A drop (${c.pz ? '#18' : '[0-#19]'}) at probeZFirst=${c.pz}`).toBe(true);
    expect(c.onlyDiffIsTheMerge, `diagonal IS the dogleg with the two-move L merged into one — nothing else changed at probeZFirst=${c.pz}`).toBe(true);
  }

  // (4) manual ignores travelShape
  expect(r.manualAgnostic, 'MANUAL travel is travelShape-agnostic (the operator jogs — firstAxis is a no-op)').toBe(true);
});

/**
 * t328 → t893 — the DIAGONAL traverse is a LIFTED safe-height positioning move (a horizontal rapid, z1≈z2). t328 painted it
 * rapid-yellow (not the old source-cyan); t893 makes it DISTINCT as SAFE-TRAVEL (the dimmed/dashed PATH_TYPES.lifted) so a
 * top-down view can never read the lifted corner-diagonal cross-over as a cutting move. The segment TYPE stays 'rapid' (the
 * reclassification to `lifted` is render-time in toolpath2d.typeOf); it is NEVER source-cyan. Colour is render-only —
 * byte-parity untouched (proven by the emit test above).
 */
test('travelShape=diagonal: the traverse renders as LIFTED safe-travel (dimmed, distinct), not source-cyan, in the Layout (t893)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js'); localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef()); });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form .seg-control[data-param="travelShape"]', { timeout: 8000 });
  await page.waitForTimeout(700);

  // select DIAGONAL via the REAL segmented control → re-emit + re-trace + re-paint the Layout overlay
  await page.evaluate(() => document.querySelector('#wiz_user_form .seg-control[data-param="travelShape"] .seg-btn[data-value="diagonal"]').click());
  await page.waitForTimeout(900);

  const r = await page.evaluate(async () => {
    const { segColor } = await import('/viz/toolpath2d.js');
    const { PATH_TYPES, hexCss } = await import('/viz/pathStyle.js');
    const box = document.getElementById('userViz3dContainer');
    const host = box && box.parentElement && box.parentElement.querySelector('.wiz-viz3d');
    const panel = host && host.__panel;
    const segs = (panel && panel.getSegments && panel.getSegments()) || [];
    // the diagonal reposition = the trans-axis RAPID (both dx,dy non-zero). Under probeZ-off default it's the only one.
    const trans = segs.find((s) => (s.type === 'rapid' || s.rapid) && Math.abs((s.x2 || 0) - (s.x1 || 0)) > 0.05 && Math.abs((s.y2 || 0) - (s.y1 || 0)) > 0.05);
    const liftedHex = hexCss(PATH_TYPES.lifted.color), cyanHex = hexCss(PATH_TYPES.probeFast.color);

    // real paint — sample the Layout overlay canvas: t893 — the diagonal draws DIMMED lifted-safe-travel pixels (grey-blue
    // #8a97ad), NOT source-cyan and NOT the old rapid-yellow. A count of the lifted grey-blue band proves the distinct render.
    const c = document.querySelector('#userVizContainer .fc-anim-overlay');
    const ctx = c && c.getContext('2d');
    let lifted = 0;
    if (ctx) {
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 4) {
        const R = d[i], G = d[i + 1], B = d[i + 2], A = d[i + 3];
        if (A < 15) continue;
        if (B > R + 6 && B > G && R > 55 && R < 175 && B > 90 && B < 215) lifted++;   // dimmed grey-blue #8a97ad (blue dominant, moderate brightness — tolerant of the alpha blend)
      }
    }
    return { transType: trans && (trans.type || (trans.rapid ? 'rapid' : 'other')), transColor: trans ? segColor(trans, 0, 1, 0) : null, liftedHex, cyanHex, lifted };
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  // t893 — the diagonal reposition's segment TYPE stays 'rapid', but segColor renders it as the DISTINCT dimmed lifted safe-travel
  expect(r.transType, 'the diagonal reposition traced segment carries type=rapid').toBe('rapid');
  expect(r.transColor, 'segColor paints the diagonal reposition the DIMMED lifted safe-travel (distinct; NEVER source-cyan)').toBe(r.liftedHex);
  expect(r.transColor, 'the lifted safe-travel is NOT the probe cyan').not.toBe(r.cyanHex);
  // the real Layout paint: dimmed lifted grey-blue present on the diagonal traverse
  expect(r.lifted, 'the Layout draws dimmed lifted-safe-travel pixels for the diagonal traverse').toBeGreaterThan(2);
});

