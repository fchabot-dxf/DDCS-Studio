import { test, expect } from './support/harness.mjs';

/**
 * ② B4 step 4d — syncA goes LIVE on the "Corner (data)" twin (batch fork 3/3 — the LAST prune-shaped toggle). A BOOL
 * block-ADD (like probeZFirst's Z step) but VALUE-CARRYING: the dual-gantry sync appends ONLY the slave-offset WCS write
 * (#74=[#70+slave], #[#74]=#883) — t124 REMOVED the unsafe `G1 A0` motion (driving the slave/A axis alone to 0 racks a
 * dual gantry). The superset wraps the sync blocks in when(syncA); instantiate() keeps/drops them.
 *
 * HARDENED live-spec pattern WITH THE VALUE-PIN (from 4c-harden): reads the bool binding's OWN wiring + asserts ON/OFF ==
 * cornerStack byte-for-byte + the toggle symptom, AND pins the slave-offset VALUE against an INDEPENDENT hardcoded truth
 * (#74=[#70+3] + #[#74]=#883) — NOT twin-vs-self parity, which is blind to a value both the prune + the source share.
 *
 * t2693 — TIER MIGRATION BATCH 4: moved browser→node. No twin-seeding fix needed: this file already calls
 * `registerUserOp(cornerDataDef())` explicitly.
 */
test('syncA LIVE: bool binding toggles the dual-gantry sync == cornerStack byte-for-byte; slave-offset value PINNED independently', async ({ page }) => {
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

    // (1) READ the bool binding's OWN wiring.
    const syncBind = (def.bindings || []).find((b) => b.param === 'syncA');

    // (2) ON/OFF FULL byte-for-byte parity with cornerStack (default other toggles).
    const offEqual = emit(build, S({ syncA: 0 })) === emit(cornerStack, S({ syncA: 0 }));
    const onEqual  = emit(build, S({ syncA: 1 })) === emit(cornerStack, S({ syncA: 1 }));

    // (3) toggle symptom + (4) INDEPENDENT VALUE PIN
    const off = emit(build, S({ syncA: 0 }));
    const on  = emit(build, S({ syncA: 1 }));
    return {
      syncType: syncBind && syncBind.type, syncDefault: syncBind && syncBind.default,
      offEqual, onEqual,
      onHasSyncHeader: /Dual Gantry Sync/.test(on),
      onHasA0move: /G1\s+A0/.test(on),   // t124 — must now be ABSENT (the racking A-axis motion was removed)
      offHasSync: /Dual Gantry Sync/.test(off) || /G1 A0/.test(off) || /#74=/.test(off),
      // INDEPENDENT PINS — hardcoded expected, not read from cornerStack's source (slave default '3' → offset 3):
      onSlaveOffset: /#74=\[#70\+3\]/.test(on),
      onSyncWrite:   /#\[#74\]=#883/.test(on),
    };
  });

  // (1) the binding declares the bool wiring
  expect(r.syncType, 'syncA is a bool binding (drives the form toggle + the guard prune)').toBe('bool');
  expect(r.syncDefault, 'syncA defaults OFF (the twin ships the no-sync shape)').toBe(false);
  // (2) byte-for-byte parity both states
  expect(r.offEqual, 'syncA OFF: twin emit == cornerStack byte-for-byte (default shape unchanged)').toBe(true);
  expect(r.onEqual, 'syncA ON: twin reproduces cornerStack({syncA:1}) byte-for-byte (the dual-gantry sync block)').toBe(true);
  // (3) the toggle adds/removes the sync block — t124: ON emits the comment + the WCS-write lines but NO A-axis MOTION
  expect(r.onHasSyncHeader, 'ON: emits the "Dual Gantry Sync" comment block').toBe(true);
  expect(r.onHasA0move, 'ON: NO "G1 A0" A-axis motion (removed — driving the slave axis alone to 0 racks a dual gantry)').toBe(false);
  expect(r.offHasSync, 'OFF: NO sync block at all (byte-identical to today)').toBe(false);
  // (4) INDEPENDENT VALUE PIN — the slave offset + the sync-offset write, vs a HARDCODED expected (a wrong value = the slave
  //     axis synced to the WRONG offset on a real dual-gantry machine; twin-vs-self parity can't catch it). ASSERT THE VALUE.
  expect(r.onSlaveOffset, 'ON: the slave offset writes #74=[#70+3] (independent pin — slave default 3, not read from source)').toBe(true);
  expect(r.onSyncWrite, 'ON: the sync writes #[#74]=#883 (the Y offset into the slave WCS address)').toBe(true);
});
