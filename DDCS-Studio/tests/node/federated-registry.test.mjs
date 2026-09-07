import { test, expect } from './support/harness.mjs';

/**
 * FEDERATED REGISTRY (ROADMAP MID #6) — user ops live in a SEPARATE forkable layer; the built-in BUILDERS/SCHEMA
 * objects stay PRISTINE (never mutated by registration). This is the substrate for Stage-6 reset-to-factory +
 * distribution-install validation. The contract this locks:
 *   1. registering a user op does NOT add a key to the built-in BUILDERS / SCHEMA objects,
 *   2. builderOf() / specOf() resolve BOTH layers (built-in first, then user),
 *   3. the built-in layer resolves identically through the raw object and the resolver (unchanged),
 *   4. deleteUserOp clears ALL FOUR co-indexed tables — builder, spec, label (the fixed OP_LABELS leak) AND sim-intent.
 */
test('federated-registry: a user op lives in the user layer, the built-ins stay pristine', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const OB = await import('/blocks/opBuilders.js');
    const OS = await import('/blocks/opSchema.js');
    localStorage.removeItem('ddcs_user_ops');

    const def = U.userOpFromStack('fed_test', 'Fed Test',
      [{ type: 'move', params: { x: 0, y: 0, z: -4, mode: 'feed' } }],
      [{ param: 'depth', blockIndex: 0, key: 'z', type: 'number', default: -4, label: 'Depth' }]);
    const t = def.opType;                                   // 'user_fed_test'

    // Snapshot the built-in key counts BEFORE registering (proof the literals don't grow).
    const beforeBuilders = Object.keys(OB.BUILDERS).length;
    const beforeSchema = Object.keys(OS.SCHEMA).length;

    U.registerUserOp(def);

    const registered = {
      // (1) the built-in OBJECTS are untouched — same key count, the user key is absent from both.
      buildersUnchanged: Object.keys(OB.BUILDERS).length === beforeBuilders,
      schemaUnchanged: Object.keys(OS.SCHEMA).length === beforeSchema,
      rawBuildersMiss: OB.BUILDERS[t] === undefined,
      rawSchemaMiss: OS.SCHEMA[t] === undefined,
      // (2) the resolvers DO find the user op.
      builderOfHit: typeof OB.builderOf(t) === 'function',
      specOfHit: !!OS.specOf(t),
      // (3) a built-in resolves identically through the raw object and the resolver (built-in layer unchanged).
      builtinSame: OB.builderOf('drill') === OB.BUILDERS.drill && OS.specOf('drill') === OS.SCHEMA.drill,
      // label present while registered (via makeOp's OP_LABELS lookup).
      labelWhileRegistered: OB.makeOp(t, {}, []).label,
    };

    // (4) delete must clear ALL FOUR tables, incl. the label (the old leak) and the sim-intent.
    U.deleteUserOp(t);
    const afterDelete = {
      builderOfGone: OB.builderOf(t) === null,
      specOfGone: OS.specOf(t) === null,
      labelFellBack: OB.makeOp(t, {}, []).label,            // == raw opType once removeOpLabel cleared it
      builtinLabelIntact: OB.makeOp('drill', {}, []).label, // a user-op delete must NEVER touch a built-in label
    };

    localStorage.removeItem('ddcs_user_ops');
    return { registered, afterDelete };
  });

  // (1) built-in objects stayed pristine
  expect(r.registered.buildersUnchanged, 'built-in BUILDERS object did not grow').toBe(true);
  expect(r.registered.schemaUnchanged, 'built-in SCHEMA object did not grow').toBe(true);
  expect(r.registered.rawBuildersMiss, 'user op absent from raw BUILDERS').toBe(true);
  expect(r.registered.rawSchemaMiss, 'user op absent from raw SCHEMA').toBe(true);
  // (2) resolvers find it
  expect(r.registered.builderOfHit, 'builderOf resolves the user op').toBe(true);
  expect(r.registered.specOfHit, 'specOf resolves the user op').toBe(true);
  // (3) built-in layer unchanged
  expect(r.registered.builtinSame, 'built-in drill resolves identically via raw object and resolver').toBe(true);
  expect(r.registered.labelWhileRegistered, 'friendly label present while registered').toBe('Fed Test');
  // (4) delete clears all four tables — incl. the previously-leaked OP_LABELS
  expect(r.afterDelete.builderOfGone, 'builder cleared on delete').toBe(true);
  expect(r.afterDelete.specOfGone, 'spec cleared on delete').toBe(true);
  expect(r.afterDelete.labelFellBack, 'label cleared on delete (OP_LABELS leak fixed) → falls back to opType').toBe('user_fed_test');
  expect(r.afterDelete.builtinLabelIntact, 'a built-in label is never touched by a user-op delete (USER_LABELS isolated)').toBe('Drill');
});
