import { test, expect } from './support/harness.mjs';

/**
 * ② B4 step 4b — travelApproach goes LIVE on the "Corner (data)" twin (batch fork 1/3). An ENUM structural toggle
 * (auto|manual): the superset `taPair` emits BOTH arms of each traverse — the hands-free G0 seq move AND the #1505
 * jog-and-wait prompt — each guarded by value-equality when(travelApproach=='auto'|'manual'); instantiate() prunes to the
 * selected shape. It forks TWO traverses (the Z→wall1, nested inside the probeZFirst guard, and the wall1→wall2 reposition).
 *
 * This follows the HARDENED live-spec pattern (from 4a-harden): it READS the enum binding's OWN wiring from def.bindings and
 * DRIVES the emit from the declared option values (never a hardcoded literal), so a mis-wired binding fails. It asserts:
 *   (1) the binding declares type:'enum', default 'auto', options {auto, manual};
 *   (2) FULL byte-for-byte parity with cornerStack across the WHOLE 2×2 (probeZFirst × the binding's options) — incl the
 *       #1505 jog-prompt KIND-B text — proving the nested guards prune correctly in every combination;
 *   (3) the real toggle symptom on BOTH traverses: manual → the "Jog clear" #1505 prompts + no G0 seq move; auto → the
 *       G0 X#.. Y#.. seq moves + no jog prompt.
 *
 * t2693 — TIER MIGRATION BATCH 4: moved browser→node. No twin-seeding fix needed: this file already calls
 * `registerUserOp(cornerDataDef())` explicitly.
 */
test('travelApproach LIVE: enum binding drives auto/manual == cornerStack byte-for-byte across the probeZFirst×travelApproach matrix', async ({ page }) => {
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
    const taBind = (def.bindings || []).find((b) => b.param === 'travelApproach');
    const opts = ((taBind && taBind.widgetConfig && taBind.widgetConfig.options) || []).map((o) => o[1]);

    // (2) FULL byte-for-byte parity across the 2×2, DRIVEN by the binding's declared option values.
    const parity = [];
    for (const pz of [0, 1]) for (const ta of opts) {
      const p = S({ probeZFirst: pz, travelApproach: ta });
      parity.push({ pz, ta, equal: emit(build, p) === emit(cornerStack, p) });
    }

    // (3) the real toggle symptom on BOTH traverses (probeZFirst on → the Z→wall1 traverse also exists).
    const manual = emit(build, S({ probeZFirst: 1, travelApproach: 'manual' }));
    const auto   = emit(build, S({ probeZFirst: 1, travelApproach: 'auto' }));

    return {
      taType: taBind && taBind.type, taDefault: taBind && taBind.default, opts,
      parity,
      manualHasJogToWall1: /Jog clear, over to the first wall/.test(manual),
      manualHasJogToNext:  /Jog clear, around to the next wall/.test(manual),
      manualHasSeqMove:    /G0 X#21 Y#22/.test(manual) || /G0 X#23/.test(manual) || /G0 X#23 Y#24/.test(manual),
      autoHasSeqZWall1:    /G0 X#21 Y#22/.test(auto),   // Z→wall1 stays a single diagonal (above the stock — t89)
      autoHasSeqRepo:      /G0 X#23/.test(auto) && /G0 Y#24/.test(auto),   // wall1→wall2 is now a 2-leg dog-leg (t89)
      autoHasJog:          /Jog clear/.test(auto),
    };
  });

  // (1) the binding declares the enum wiring
  expect(r.taType, 'travelApproach is an enum binding (drives the form dropdown + the guard prune)').toBe('enum');
  expect(r.taDefault, 'travelApproach defaults to auto (the twin ships the hands-free shape)').toBe('auto');
  expect(r.opts, 'the binding declares the manual/auto options that drive the guards (t328 — DISPLAY order [Manual|Auto], default stays auto)').toEqual(['manual', 'auto']);
  // (2) FULL byte-for-byte parity across every (probeZFirst × travelApproach) combination
  for (const c of r.parity) {
    expect(c.equal, `twin == cornerStack byte-for-byte at probeZFirst=${c.pz} travelApproach=${c.ta}`).toBe(true);
  }
  // (3) the toggle actually swaps the shape on BOTH traverses
  expect(r.manualHasJogToWall1 && r.manualHasJogToNext, 'manual: BOTH traverses emit a "Jog clear" #1505 prompt').toBe(true);
  expect(r.manualHasSeqMove, 'manual: NO hands-free G0 seq move (the operator jogs)').toBe(false);
  expect(r.autoHasSeqZWall1 && r.autoHasSeqRepo, 'auto: BOTH traverses emit a hands-free G0 seq move (Z→wall1 + wall1→wall2)').toBe(true);
  expect(r.autoHasJog, 'auto: NO jog prompt').toBe(false);
});
