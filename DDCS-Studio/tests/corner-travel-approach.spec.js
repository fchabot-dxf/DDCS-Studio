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

  // AUTO (default) — the wall1→wall2 traverse is the G0 move on #23/#24; no jog prompt; explicit 'auto' == default.
  expect(r.auto, 'auto: wall1→wall2 is the hands-free G0 seq move').toMatch(/^G0 X#23 Y#24$/m);
  expect(r.auto, 'auto: NO manual reposition prompt').not.toMatch(/repositioned|Jog clear/i);
  expect(r.autoExplicit, 'explicit travelApproach:auto is byte-identical to the default').toBe(r.auto);

  // MANUAL — the move is GONE, replaced by the #1505 jog prompt + ESC guard; the drop #18 (→scan depth) REMAINS.
  expect(r.manual, 'manual: the auto G0 X#23 Y#24 move is GONE (operator jogs)').not.toMatch(/^G0 X#23 Y#24$/m);
  expect(r.manual, 'manual: the #1505 jog-and-wait prompt appears with the corner instruction').toMatch(/#1505=1 \( Jog clear, around to the next wall\. Press Enter \)/);
  expect(r.manual, 'manual: the ESC/cancel guard jumps to corner end label 2').toMatch(/IF #1505==0 GOTO2/);
  expect(r.manual, 'manual: still drops #18 back to scan depth for probe-2 (Z-state mirrors auto)').toMatch(/^G0 Z#18$/m);
  expect(r.manual, 'manual: the #23 cross assign still emits (inert dead assign, not gated)').toMatch(/^#23=/m);
  expect(r.manual, 'manual: the #24 cross assign still emits').toMatch(/^#24=/m);
  expect(r.manual, 'manual differs from auto (the toggle actually swaps the block shape)').not.toBe(r.auto);

  // Z-FIRST Call A (Z→wall1): auto = G0 move on #21/#22; manual = lift #19 + jog prompt, NO drop (stays lifted; :150 plunges).
  expect(r.autoZ, 'auto Z-first: the Z→wall1 traverse is a G0 move on #21/#22').toMatch(/^G0 X#21 Y#22$/m);
  expect(r.manualZ, 'manual Z-first: the Z→wall1 G0 move is GONE').not.toMatch(/^G0 X#21 Y#22$/m);
  expect(r.manualZ, 'manual Z-first: lifts #19 for safe-Z clearance before the jog').toMatch(/^G0 Z#19$/m);
  expect(r.manualZ, 'manual Z-first: the jog prompt for the first wall').toMatch(/#1505=1 \( Jog clear, over to the first wall\. Press Enter \)/);
});
