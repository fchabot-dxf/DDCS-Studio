import { test, expect } from '@playwright/test';

/**
 * The wizard-maker FOUNDATION (stage 1): a USER-defined op, registered at runtime from a block-stack template +
 * numeric param bindings, is a first-class COMPLIANT op. This locks the "valid by construction" property — the
 * template IS BUILDERS(defaults) — so the op builds, marker round-trips, validates, reconstructs from a marker, and
 * its glow baseline equals the template (no false glow). Pure foundation: no UI.
 */
test('userOps: a runtime user op is fully compliant (build / round-trip / validate / no false-glow)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const { BUILDERS, _builderAtoms } = await import('/blocks/opBuilders.js');
    const { SCHEMA, paramFields, markerLine, parseMarker, validate } = await import('/blocks/opSchema.js');
    const { opFromMarker } = await import('/blocks/programModel.js');

    // Fork a 2-atom stack, expose two numeric values as params (the dev-panel output).
    const stack = [
      { type: 'spindle', params: { rpm: 12000, dir: 'cw' } },
      { type: 'move', params: { x: 0, y: 0, z: -5, mode: 'feed' } },
    ];
    const bindings = [
      { param: 'rpm', blockIndex: 0, key: 'rpm', type: 'number', default: 12000, min: 0, max: 24000, units: 'rpm', label: 'Spindle RPM' },
      { param: 'depth', blockIndex: 1, key: 'z', type: 'number', default: -5, min: -50, max: 0, units: 'mm', label: 'Depth' },
    ];
    const def = U.userOpFromStack('my_probe', 'My Probe', stack, bindings);
    U.registerUserOp(def);
    const t = def.opType;
    const defaults = U.defaultParams(def);
    const custom = { rpm: 8000, depth: -3 };

    return {
      opType: t,
      registered: typeof BUILDERS[t] === 'function',
      template: def.template,
      builtDefaults: BUILDERS[t](defaults),                  // == template (params-completeness)
      builtCustom: BUILDERS[t](custom),                      // substitutes the bound values
      glowBaseline: _builderAtoms(t, defaults),              // the glow's clean rebuild == template (no false glow)
      schemaKeys: Object.keys(SCHEMA[t] || {}),
      fields: paramFields(t),
      validateClean: validate(t, custom),
      roundTrip: parseMarker(markerLine(t, custom)),
      fromMarker: opFromMarker(t, defaults),                 // codec reconstructs the op
    };
  });

  const j = (x) => JSON.stringify(x);
  expect(r.registered, 'BUILDERS got the user op').toBe(true);
  // Valid by construction: BUILDERS(defaults) and the glow baseline both reproduce the template exactly.
  expect(j(r.builtDefaults), 'BUILDERS(defaults) == template').toBe(j(r.template));
  expect(j(r.glowBaseline), 'glow baseline == template (no false glow)').toBe(j(r.template));
  // Custom params substitute at the bound paths, nothing else moves.
  expect(r.builtCustom[0].params.rpm, 'rpm param substituted').toBe(8000);
  expect(r.builtCustom[1].params.z, 'depth param substituted at move.z').toBe(-3);
  expect(r.builtCustom[1].params.x, 'unbound value stays baked').toBe(0);
  // SCHEMA + form binding present (so it's editable + seeds from the dict).
  expect(r.schemaKeys.sort(), 'schema declares the params').toEqual(['depth', 'rpm']);
  expect(r.fields.depth, 'depth has a form-field binding').toBe('uop_user_my_probe_depth');
  // Marker round-trip is bijective; validator is clean.
  expect(r.roundTrip.opType, 'marker carries the opType').toBe('user_my_probe');
  expect(r.roundTrip.params, 'marker params round-trip').toEqual({ rpm: 8000, depth: -3 });
  expect(r.validateClean, 'validator clean').toEqual([]);
  // The codec reconstructs the op (right type, friendly label, children == template).
  expect(r.fromMarker.opType).toBe('user_my_probe');
  expect(r.fromMarker.label, 'friendly label via registerOpLabel').toBe('My Probe');
  expect(j(r.fromMarker.children), 'reconstructed children == template').toBe(j(r.template));
});

test('userOps: create / list / load (re-register) / delete persistence round-trip', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const { BUILDERS } = await import('/blocks/opBuilders.js');
    localStorage.removeItem('ddcs_user_ops');                 // clean slate

    const def = U.userOpFromStack('persist_test', 'Persist Test',
      [{ type: 'move', params: { x: 0, y: 0, z: -2, mode: 'feed' } }],
      [{ param: 'depth', blockIndex: 0, key: 'z', type: 'number', default: -2 }]);

    U.createUserOp(def);
    const afterCreate = { count: U.listUserOps().length, registered: typeof BUILDERS[def.opType] === 'function' };

    // Simulate an app reload: drop the live builder, then loadUserOps() must re-register it from localStorage.
    delete BUILDERS[def.opType];
    const reloaded = U.loadUserOps();
    const afterLoad = { reRegistered: typeof BUILDERS[def.opType] === 'function', count: reloaded };

    let dupThrew = false;
    try { U.createUserOp(def); } catch (_) { dupThrew = true; }   // duplicate opType rejected

    U.deleteUserOp(def.opType);
    const afterDelete = { count: U.listUserOps().length, registered: typeof BUILDERS[def.opType] === 'function' };

    localStorage.removeItem('ddcs_user_ops');                 // don't leak
    return { afterCreate, afterLoad, dupThrew, afterDelete };
  });

  expect(r.afterCreate).toEqual({ count: 1, registered: true });
  expect(r.afterLoad).toEqual({ reRegistered: true, count: 1 });
  expect(r.dupThrew, 'duplicate opType rejected').toBe(true);
  expect(r.afterDelete).toEqual({ count: 0, registered: false });
});

test('userOps: the generic param form inserts a user op into the program (depth substituted)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsInsertUserOp && window.ddcsLoadBlockStack);

  // Create a 1-param user op + clear the program, then open its insert form.
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(U.userOpFromStack('form_test', 'Form Test',
      [{ type: 'move', params: { x: 0, y: 0, z: -5, mode: 'feed' } }],
      [{ param: 'depth', blockIndex: 0, key: 'z', type: 'number', default: -5, units: 'mm', label: 'Depth' }]));
    window.ddcsLoadBlockStack([]);
    window.ddcsInsertUserOp('user_form_test');
  });

  // The data-driven form shows only the declared param; set it and insert.
  await page.waitForSelector('#uop_field_depth', { state: 'visible' });
  await page.fill('#uop_field_depth', '-8');
  await page.click('.uop-insert');
  await page.waitForSelector('.uop-form-overlay', { state: 'detached' });

  const r = await page.evaluate(() => {
    const stack = window.ddcsGetBlockProgram() || [];
    const op = stack.find((b) => b && b.type === 'op' && b.opType === 'user_form_test');
    const move = op && (op.children || []).find((c) => c && c.type === 'move');
    localStorage.removeItem('ddcs_user_ops');
    return { hasOp: !!op, label: op && op.label, z: move && move.params && move.params.z };
  });
  expect(r.hasOp, 'user op inserted into the program').toBe(true);
  expect(r.label, 'friendly label on the op container').toBe('Form Test');
  expect(r.z, 'depth param substituted at insert time').toBe(-8);
});
