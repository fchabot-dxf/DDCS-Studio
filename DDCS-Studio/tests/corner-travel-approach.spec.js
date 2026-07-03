import { test, expect } from '@playwright/test';

/**
 * ① AUTO/MANUAL TRAVEL — the built-in Corner adopts the shared travel primitive's auto/manual toggle for BOTH its
 * travels (Z→wall1 `#21/#22` + wall1→wall2 `#23/#24`), governed by ONE `travelApproach` param.
 *
 * verify-real-symptom, VALUES not just "changed":
 *  - AUTO (default): each travel is the hands-free G0 seq move; auto is byte-identical to today (guarded here + by the
 *    corner-data-emit golden which pins `^G0 X#23 Y#24$`).
 *  - MANUAL: the G0 XY move is REPLACED by a #1505 jog-and-wait prompt + ESC guard — and the Z-state MIRRORS auto so the
 *    next probe still lands at scan depth: wall1→wall2 keeps its drop #18 (→scan depth), Z→wall1 keeps its lift #19 with
 *    NO drop (stays lifted; the plunge follows). The #23/#24 assigns still emit (inert dead assigns under manual).
 */
test('corner travelApproach: AUTO = G0 move, MANUAL = #1505 jog prompt — both travels, Z-state mirrors auto', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const emit = (p) => emitMapped(cornerStack(p)).text;
    return {
      auto:         emit({}),                                              // default → auto
      autoExplicit: emit({ travelApproach: 'auto' }),
      manual:       emit({ travelApproach: 'manual' }),
      autoZ:        emit({ probeZFirst: 1 }),                              // Z-first, auto (exercises Call A #21/#22)
      manualZ:      emit({ probeZFirst: 1, travelApproach: 'manual' }),    // Z-first, manual (Call A)
    };
  });

  // AUTO (default) — the wall1→wall2 traverse is now a SAFE DOG-LEG (t89): TWO sequential single-axis rapids that route
  // AROUND the corner, not a diagonal THROUGH the stock. Default FL/YX → 2nd wall = X → X-first (G0 X#23 then G0 Y#24).
  expect(r.auto, 'auto: wall1→wall2 dog-leg — the X#23 leg').toMatch(/^G0 X#23$/m);
  expect(r.auto, 'auto: wall1→wall2 dog-leg — the Y#24 leg').toMatch(/^G0 Y#24$/m);
  expect(r.auto, 'auto: X#23 leg BEFORE Y#24 (2nd wall axis first = safe order); NOT the single diagonal').toMatch(/G0 X#23\nG0 Y#24/);
  expect(r.auto, 'auto: NO single-move diagonal').not.toMatch(/^G0 X#23 Y#24$/m);
  expect(r.auto, 'auto: NO manual reposition prompt').not.toMatch(/repositioned|Jog clear/i);
  expect(r.autoExplicit, 'explicit travelApproach:auto is byte-identical to the default').toBe(r.auto);

  // MANUAL (probeZ-off) — the move is GONE, replaced by the #1505 jog prompt + ESC guard. Z-TRUST (t102): NO auto-drop after
  // the jog (the operator RE-JOGS Z — never auto-adjust after a human jog), AND no wall-1 pre-plunge → NO `G0 Z#18` at all.
  expect(r.manual, 'manual: the auto reposition move is GONE (operator jogs) — no X#23 leg, no diagonal').not.toMatch(/^G0 X#23( Y#24)?$/m);
  expect(r.manual, 'manual: the #1505 jog-and-wait prompt appears with the corner instruction').toMatch(/#1505=1 \( Jog clear, around to the next wall\. Press Enter \)/);
  expect(r.manual, 'manual: the ESC/cancel guard jumps to corner end label 2').toMatch(/IF #1505==0 GOTO2/);
  expect(r.manual, 'manual (probeZ-off): Z-TRUST — NO G0 Z#18 (no wall-1 pre-plunge + no auto-drop after the jog; operator sets Z)').not.toMatch(/^G0 Z#18$/m);
  expect(r.manual, 'manual: the #23 cross assign still emits (inert dead assign, not gated)').toMatch(/^#23=/m);
  expect(r.manual, 'manual: the #24 cross assign still emits').toMatch(/^#24=/m);
  expect(r.manual, 'manual differs from auto (the toggle actually swaps the block shape)').not.toBe(r.auto);

  // Z-FIRST Call A (Z→wall1): auto = G0 move on #21/#22; manual = lift #19 + jog prompt, NO drop (stays lifted; :150 plunges).
  expect(r.autoZ, 'auto Z-first: the Z→wall1 traverse is a G0 move on #21/#22').toMatch(/^G0 X#21 Y#22$/m);
  expect(r.manualZ, 'manual Z-first: the Z→wall1 G0 move is GONE').not.toMatch(/^G0 X#21 Y#22$/m);
  expect(r.manualZ, 'manual Z-first: lifts #19 for safe-Z clearance before the jog').toMatch(/^G0 Z#19$/m);
  expect(r.manualZ, 'manual Z-first: the jog prompt for the first wall').toMatch(/#1505=1 \( Jog clear, over to the first wall\. Press Enter \)/);
});

/**
 * SAFE DOG-LEG — the CORRECTNESS property (t89), not just "two moves exist": the wall1→wall2 auto traverse (at SCAN DEPTH,
 * crossing material) must route AROUND the outside corner. After probing wall-1 the tool is OUTSIDE the stock along wall-1's
 * axis but INSIDE its span along wall-2's; the SAFE order moves wall-2's axis FIRST (clears past the corner) then wall-1's.
 * Since axesOf's 2nd wall = the last char of probeSeq, the FIRST dog-leg leg must be that axis — for ALL 8 corner×probeSeq
 * combos (only the signs flip per quadrant). This is the geometry-aware order (from axesOf), NOT a hardcoded X-then-Y.
 */
test('corner dog-leg: wall1→wall2 moves the SECOND wall axis FIRST (routes around the corner) — all 8 combos', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const rows = await page.evaluate(async () => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const emit = (p) => emitMapped(cornerStack(p)).text;
    const out = [];
    for (const corner of ['FL', 'FR', 'BL', 'BR']) for (const probeSeq of ['XY', 'YX']) {
      const t = emit({ corner, probeSeq });
      // isolate the wall1→wall2 reposition (its comment carries 'Traverse past corner') and read the 2 legs that follow
      const lines = t.split('\n');
      const ri = lines.findIndex((l) => /Traverse past corner/.test(l));
      const legs = lines.slice(ri + 1).filter((l) => /^G0 [XY]#2[34]$/.test(l)).slice(0, 2);
      out.push({ corner, probeSeq, first: legs[0], second: legs[1], count: legs.length, hasDiagonal: /G0 X#23 Y#24/.test(t) });
    }
    return out;
  });
  for (const r of rows) {
    const secondWallAxis = r.probeSeq[1];   // axesOf: probeSeq's 2nd char is the second wall's axis (the safe first-move axis)
    expect(r.count, `${r.corner}/${r.probeSeq}: the reposition is a 2-leg dog-leg`).toBe(2);
    expect(r.first, `${r.corner}/${r.probeSeq}: 1st leg moves the 2nd wall axis (${secondWallAxis}) — safe order`).toMatch(new RegExp('^G0 ' + secondWallAxis + '#2[34]$'));
    expect(r.first[3], `${r.corner}/${r.probeSeq}: 1st leg is a DIFFERENT axis than the 2nd`).not.toBe(r.second[3]);
    expect(r.hasDiagonal, `${r.corner}/${r.probeSeq}: no single-move diagonal survives`).toBe(false);
  }
});
