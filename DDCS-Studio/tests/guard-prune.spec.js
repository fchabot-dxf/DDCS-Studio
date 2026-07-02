import { test, expect } from '@playwright/test';

/**
 * ② B4 M2 step 2 — the generic STRUCTURAL-TOGGLE capability (built ONCE, corner-agnostic): the shared `whenOk` evaluator,
 * `pruneGuards` (collapse a guarded superset template to one param state), and `instantiate` re-deriving bindings BY
 * IDENTITY over the PRUNED stack (so a guard that shifts flat indices doesn't desync the binding). This is the core
 * `instantiate` change used by EVERY user op, so it's isolated + proven here; the drill/slot/corner emit specs + the full
 * suite are the "existing ops UNCHANGED" regression (a non-guarded def has no guards → prune is a no-op → identical).
 */
test('guard/prune capability: shared whenOk + pruneGuards (drop/unwrap/nested) + instantiate re-derive-by-identity', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { whenOk, pruneGuards } = await import('/blocks/whenGuard.js');
    const { newBlock, emitMapped } = await import('/blocks/blockEmitter.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const G = (when, kids) => ({ type: 'guard', params: { when }, children: kids });
    const A = (v, val) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: '' }; return b; };
    const varsOf = (t) => t.filter((b) => b.type === 'assign').map((b) => b.params.var);

    // (1) whenOk — the ONE evaluator (bool coerces; enum strict ===).
    const whenOkCases = {
      noGuard: whenOk(null, {}),
      boolOn: whenOk({ param: 'z', is: true }, { z: 1 }),
      boolOff: whenOk({ param: 'z', is: true }, { z: 0 }),
      enumMatch: whenOk({ param: 'w', is: 'active' }, { w: 'active' }),
      enumMiss: whenOk({ param: 'w', is: 'active' }, { w: 'G54' }),
    };

    // (2) pruneGuards — drop / unwrap / nested.
    const dropTree = [A('#1', 1), G({ param: 'z', is: true }, [A('#Z', 9)]), A('#2', 2)];
    pruneGuards(dropTree, { z: 0 });
    const unwrapTree = [A('#1', 1), G({ param: 'z', is: true }, [A('#Z', 9)]), A('#2', 2)];
    pruneGuards(unwrapTree, { z: 1 });
    const nestedTree = [G({ param: 'a', is: true }, [A('#A', 1), G({ param: 'b', is: true }, [A('#B', 2)])])];
    pruneGuards(nestedTree, { a: 1, b: 0 });
    const noGuardsLeft = (t) => !t.some((b) => b.type === 'guard');

    // (3) instantiate re-derive-by-identity: a synthetic guarded def whose guard inserts #Z1/#Z2 BEFORE #TARGET when zOn,
    //     shifting #TARGET's flat index +2. bindingSpecs match #TARGET by IDENTITY → the binding must hit it in BOTH states.
    const template = [{
      type: 'user_root', params: {}, uiChildren: [],
      children: [A('#CFG', 0), G({ param: 'zOn', is: true }, [A('#Z1', 0), A('#Z2', 0)]), A('#TARGET', 111)],
    }];
    const def = {
      opType: 'user_guardtest', label: 'GuardTest', template, panel: 'form', bindings: [],
      bindingSpecs: [{ param: 'val', type: 'number', match: { type: 'assign', var: '#TARGET' }, key: 'value' }],
    };
    registerUserOp(def);
    const build = builderOf('user_guardtest');
    const emitOff = emitMapped(build({ val: 42, zOn: 0 })).text;
    const emitOn = emitMapped(build({ val: 42, zOn: 1 })).text;

    return {
      whenOkCases,
      dropVars: varsOf(dropTree), dropClean: noGuardsLeft(dropTree),
      unwrapVars: varsOf(unwrapTree), unwrapClean: noGuardsLeft(unwrapTree),
      nestedVars: varsOf(nestedTree), nestedClean: noGuardsLeft(nestedTree),
      emitOffHasZ: /#Z1=/.test(emitOff), emitOnHasZ: /#Z1=/.test(emitOn),
      emitOffTarget: /#TARGET=42/.test(emitOff), emitOnTarget: /#TARGET=42/.test(emitOn),
      emitOffNoGuard: !/unknown block guard|\bguard\b/i.test(emitOff), emitOnNoGuard: !/unknown block guard/i.test(emitOn),
    };
  });

  // (1) the shared evaluator
  expect(r.whenOkCases).toEqual({ noGuard: true, boolOn: true, boolOff: false, enumMatch: true, enumMiss: false });
  // (2) prune drops/unwraps + leaves NO guard blocks
  expect(r.dropVars, 'guard DROPPED when when=false').toEqual(['#1', '#2']);
  expect(r.unwrapVars, 'guard UNWRAPPED (children spliced in place) when when=true').toEqual(['#1', '#Z', '#2']);
  expect(r.nestedVars, 'nested: outer unwrapped + inner dropped').toEqual(['#A']);
  expect(r.dropClean && r.unwrapClean && r.nestedClean, 'no guard blocks remain after prune').toBe(true);
  // (3) re-derive-by-identity: the binding hits #TARGET=42 in BOTH states despite the +2 index shift when zOn
  expect(r.emitOffHasZ, 'zOn=0 → guarded #Z blocks absent').toBe(false);
  expect(r.emitOnHasZ, 'zOn=1 → guarded #Z blocks present (index shift)').toBe(true);
  expect(r.emitOffTarget, 'binding writes #TARGET=42 (zOn=0)').toBe(true);
  expect(r.emitOnTarget, 'binding writes #TARGET=42 (zOn=1) — re-derived by identity past the +2 shift').toBe(true);
  expect(r.emitOnNoGuard, 'no ( unknown block guard ) leaks into emit (prune removed all guards)').toBe(true);
});
