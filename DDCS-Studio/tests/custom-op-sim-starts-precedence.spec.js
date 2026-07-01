import { test, expect } from '@playwright/test';

/**
 * Custom-op sim-start precedence: template `simstart` blocks are canonical.
 * Compatibility fallback remains: if a template has NO simstart blocks, use `def.sim.starts`.
 */
test('template simstart blocks are canonical; def.sim.starts is fallback only', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    localStorage.removeItem('ddcs_user_ops');
    const U = await import('/blocks/userOps.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const stock = { x: 100, y: 80, z: 20 };

    // Canonical path: stack has simstart(centre), so conflicting legacy def.sim.starts must be ignored.
    U.createUserOp({
      opType: 'user_starts_stack_canon',
      label: 'Starts Stack Canon',
      template: [
        { type: 'simstart', params: { anchor: 'centre', zplane: 'probe' } },
        { type: 'move', params: { mode: 'rapid', x: 1 } },
      ],
      bindings: [],
      panel: 'form3d',
      sim: { starts: [{ anchor: 'edge', axis: 'X', side: 'min', out: 12, plane: 'probe' }] },
    });
    const canon = opSimStarts('user_starts_stack_canon', {}, stock);

    // Fallback path: no simstart blocks in template, so def.sim.starts should drive starts.
    U.createUserOp(U.userOpFromStack('starts_legacy_fallback', 'Starts Legacy Fallback',
      [{ type: 'move', params: { mode: 'rapid', x: 2 } }], [], 'form3d',
      { starts: [{ anchor: 'edge', axis: 'X', side: 'min', out: 12, plane: 'probe' }] }));
    const fallback = opSimStarts('user_starts_legacy_fallback', {}, stock);

    U.deleteUserOp('user_starts_stack_canon');
    U.deleteUserOp('user_starts_legacy_fallback');
    localStorage.removeItem('ddcs_user_ops');
    return { canon, fallback };
  });

  expect(Math.round(r.canon[0].x), 'stack simstart centre wins over legacy edge row').toBe(50);
  expect(Math.round(r.canon[0].y)).toBe(40);
  expect(Math.round(r.canon[0].z)).toBe(-5);

  expect(Math.round(r.fallback[0].x), 'without simstart blocks, legacy def.sim.starts remains active').toBe(-12);
  expect(Math.round(r.fallback[0].y)).toBe(40);
  expect(Math.round(r.fallback[0].z)).toBe(-5);
});
