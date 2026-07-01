import { test, expect } from '@playwright/test';

/**
 * Custom-op preview intent (#5) — DECLARED, never inferred. A user_* op is open-world (an unknown user may wire the
 * A axis to anything on an unknown machine), so its preview intent (rotary rig / forceMachine / magazine) is taken
 * ONLY from what `def.sim` declares — never read from the stack's motion. (A built-in's A-move is safe to read as
 * rotary because WE authored it; that's why the static sets in opSimContext gate built-ins, not custom ops.)
 * Showing the rotary rig is what reveals the A± jog row, so a false positive = a spurious jog control. Locks: no
 * inference from an A-move, the declared intent round-trips through the registry, program union, delete clears.
 */

test('custom-op sim intent is DECLARED, never inferred from motion', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    localStorage.removeItem('ddcs_user_ops');
    const U = await import('/blocks/userOps.js');
    const sim = await import('/viz/opSimContext.js');

    // an A-axis MOVE alone must NOT infer a rotary rig — motion text doesn't carry intent for a custom op
    U.createUserOp(U.userOpFromStack('amove_test', 'A Move',
      [{ type: 'move', params: { mode: 'rapid', a: 90 } }], []));
    const amove = sim.opSimContext('user_amove_test');

    // intent is DECLARED via def.sim (6th positional arg) — the panel-block-style declaration, not the motion
    U.createUserOp(U.userOpFromStack('declared_test', 'Declared',
      [{ type: 'move', params: { mode: 'rapid', x: 5 } }], [], 'form3d', { showRotaryRig: true }));
    const declared = sim.opSimContext('user_declared_test');
    const prog = sim.programSimContext(['user_amove_test', 'user_declared_test']);

    U.deleteUserOp('user_declared_test');
    const afterDel = sim.opSimContext('user_declared_test');

    localStorage.removeItem('ddcs_user_ops');
    return { amove, declared, prog, afterDel };
  });

  expect(r.amove.showRotaryRig, 'an A-move alone is NOT inferred as rotary (open-world op)').toBe(false);
  expect(r.declared, 'declared intent is honoured').toEqual({ showRotaryRig: true, forceMachine: false, showMagazine: false });
  expect(r.prog.showRotaryRig, 'program union picks up the DECLARED rotary op, not the A-move one').toBe(true);
  expect(r.afterDel.showRotaryRig, 'delete clears the declared intent').toBe(false);
});

test('declared custom-op sim intent persists + re-registers via loadUserOps', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    localStorage.removeItem('ddcs_user_ops');
    const U = await import('/blocks/userOps.js');
    const sim = await import('/viz/opSimContext.js');
    U.createUserOp(U.userOpFromStack('persist_decl', 'Persist',
      [{ type: 'move', params: { mode: 'rapid', x: 5 } }], [], 'form3d', { showRotaryRig: true }));
    // simulate a fresh session: clear the live registry, then re-register from storage (reads def.sim)
    sim.setUserSimIntent('user_persist_decl', null);
    const beforeReload = sim.opSimContext('user_persist_decl').showRotaryRig;
    U.loadUserOps();
    const afterReload = sim.opSimContext('user_persist_decl').showRotaryRig;
    localStorage.removeItem('ddcs_user_ops');
    return { beforeReload, afterReload };
  });

  expect(r.beforeReload, 'cleared registry → no intent').toBe(false);
  expect(r.afterReload, 'loadUserOps re-registers the DECLARED intent from storage').toBe(true);
});

test('template sim block is canonical; legacy def.sim remains fallback', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    localStorage.removeItem('ddcs_user_ops');
    const U = await import('/blocks/userOps.js');
    const sim = await import('/viz/opSimContext.js');

    // Canonical path: stack declares a sim block (all false => explicit null intent),
    // so a conflicting legacy def.sim must be ignored.
    U.createUserOp({
      opType: 'user_stack_canon',
      label: 'Stack Canon',
      template: [
        { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
        { type: 'move', params: { mode: 'rapid', x: 1 } },
      ],
      bindings: [],
      panel: 'form3d',
      sim: { showRotaryRig: true },
    });
    const stackCanon = sim.opSimContext('user_stack_canon');

    // Compatibility fallback: no sim block in template => def.sim still applies.
    U.createUserOp(U.userOpFromStack('legacy_fallback', 'Legacy Fallback',
      [{ type: 'move', params: { mode: 'rapid', x: 2 } }], [], 'form3d', { showRotaryRig: true }));
    const legacyFallback = sim.opSimContext('user_legacy_fallback');

    U.deleteUserOp('user_stack_canon');
    U.deleteUserOp('user_legacy_fallback');
    localStorage.removeItem('ddcs_user_ops');
    return { stackCanon, legacyFallback };
  });

  expect(r.stackCanon.showRotaryRig, 'stack sim block (all false) explicitly clears intent; legacy def.sim is ignored').toBe(false);
  expect(r.legacyFallback.showRotaryRig, 'without a stack sim block, legacy def.sim still applies').toBe(true);
});
