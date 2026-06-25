import { test, expect } from '@playwright/test';

/**
 * GUI blocks (B) — round-trip. The `param` pills stay IN the saved wizard's template (so re-opening shows the
 * param blocks), while BUILDERS/instantiate still resolve them to plain numbers at the bound value — so the
 * committed op + valid-by-construction are untouched (pills never reach a committed op). The wizard validates.
 */
test('gui blocks (B): param pills persist in the saved template; instantiate resolves to the bound number', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');

    const template = [{ type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', widget: 'slider', value: -5 } } } }];
    const bindings = U.extractParamBlocks(template);          // keep-mode (B): pill stays, binding derived
    U.createUserOp(U.userOpFromStack('rt_test', 'RT Test', template, bindings));

    const def = U.listUserOps().find((d) => d.opType === 'user_rt_test');   // re-read the persisted def
    const { BUILDERS } = await import('/blocks/opBuilders.js');
    const built = BUILDERS['user_rt_test']({ depth: -12 });   // instantiate at a non-default value

    const out = {
      tmplZ: def.template[0].params.z,                        // should still be the pill
      builtZ: built[0].params.z,                              // should be the resolved number
      binding: def.bindings[0],
      errs: U.validateUserOp(def),
    };
    localStorage.removeItem('ddcs_user_ops');
    return out;
  });

  expect(r.tmplZ, 'param pill persisted in the saved template → round-trips').toMatchObject({ type: 'param', params: { name: 'depth' } });
  expect(r.builtZ, 'instantiate resolved the pill to the bound number (committed op is clean)').toBe(-12);
  expect(r.binding).toMatchObject({ param: 'depth', widget: 'slider', blockIndex: 0, key: 'z' });
  expect(r.errs, 'the pill-template wizard validates').toEqual([]);
});
