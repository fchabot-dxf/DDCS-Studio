import { test, expect } from '@playwright/test';

/**
 * Custom-op preview intent (#5, rotary-only sound subset). A user_* op now DECLARES its preview intent at register
 * time: userOps derives the 4th-axis rotary rig from the op's atoms (an A/B/C-axis move/probe/DRO-read) and
 * registers it in opSimContext, so a custom rotary op gets the same rig as a built-in rotary wizard. Only rotary
 * is inferred (G31→machine / tool-change→magazine would contradict the built-ins — those stay declared). Locks:
 * the derivation, the registry round-trip, the program union, and that delete clears it.
 */

test('custom-op rotary intent: A-axis atoms → rotary rig; program union; delete clears', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    localStorage.removeItem('ddcs_user_ops');
    const U = await import('/blocks/userOps.js');
    const sim = await import('/viz/opSimContext.js');

    // a custom op with an A-axis MOVE (the rotaryClock idiom: { mode:'rapid', a:… })
    U.createUserOp(U.userOpFromStack('rotmove_test', 'Rot Move', [
      { type: 'comment', params: { text: 'index' } },
      { type: 'move', params: { mode: 'rapid', a: 90 } },
    ], []));
    // a custom op that PROBES the A axis
    U.createUserOp(U.userOpFromStack('rotprobe_test', 'Rot Probe',
      [{ type: 'probe', params: { axis: 'A', to: -10, feed: 100, port: 3, level: 0 } }], []));
    // a plain XY/Z cutting op — no rotary axis
    U.createUserOp(U.userOpFromStack('flat_test', 'Flat',
      [{ type: 'move', params: { mode: 'cut', x: 10, y: 5, z: -2, feed: 200 } }], []));

    const rotMove = sim.opSimContext('user_rotmove_test');
    const rotProbe = sim.opSimContext('user_rotprobe_test');
    const flat = sim.opSimContext('user_flat_test');
    const progFlatOnly = sim.programSimContext(['user_flat_test']);
    const progWithRot = sim.programSimContext(['user_flat_test', 'user_rotmove_test']);

    U.deleteUserOp('user_rotmove_test');
    const afterDelete = sim.opSimContext('user_rotmove_test');

    localStorage.removeItem('ddcs_user_ops');
    return { rotMove, rotProbe, flat, progFlatOnly, progWithRot, afterDelete };
  });

  // an A-axis move/probe → the rotary rig; the dubious mappings stay false (rotary-only)
  expect(r.rotMove).toEqual({ showRotaryRig: true, forceMachine: false, showMagazine: false });
  expect(r.rotProbe.showRotaryRig).toBe(true);
  // a plain cut op → no rig
  expect(r.flat.showRotaryRig).toBe(false);
  // program union: rig appears iff ANY op is rotary
  expect(r.progFlatOnly.showRotaryRig).toBe(false);
  expect(r.progWithRot.showRotaryRig).toBe(true);
  // delete clears the declared intent → falls back to the all-false default
  expect(r.afterDelete.showRotaryRig).toBe(false);
});

test('custom-op rotary intent survives a persistence reload (loadUserOps re-declares it)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    localStorage.removeItem('ddcs_user_ops');
    const U = await import('/blocks/userOps.js');
    const sim = await import('/viz/opSimContext.js');
    U.createUserOp(U.userOpFromStack('persist_rot', 'Persist Rot',
      [{ type: 'move', params: { mode: 'rapid', a: 45 } }], []));
    // simulate a fresh session: clear the live registry, then re-register from storage
    sim.setUserSimIntent('user_persist_rot', null);
    const beforeReload = sim.opSimContext('user_persist_rot').showRotaryRig;
    U.loadUserOps();
    const afterReload = sim.opSimContext('user_persist_rot').showRotaryRig;
    localStorage.removeItem('ddcs_user_ops');
    return { beforeReload, afterReload };
  });

  expect(r.beforeReload, 'cleared registry → no intent').toBe(false);
  expect(r.afterReload, 'loadUserOps re-derives + re-declares the intent').toBe(true);
});
