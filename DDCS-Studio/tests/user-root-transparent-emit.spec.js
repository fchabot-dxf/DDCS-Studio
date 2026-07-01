import { test, expect } from '@playwright/test';

/**
 * Regression lock for custom-op root wrappers: `user_root` / `param_group` are STRUCTURAL containers
 * and must not perturb execution emission. If this fails, wrapped custom-op templates can silently
 * drift from their execution-child baseline.
 */
test('user_root wrapper is transparent at emit time', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { atcWarmupStack } = await import('/wizards/atcWarmupWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');

    const params = { rpm1: 7000, time1: 20, rpm2: 15000, time2: 12 };
    const exec = atcWarmupStack(params);
    const wrapped = [{
      type: 'user_root',
      params: {},
      uiChildren: [{ type: 'param_group', params: { group: 'Spindle Warmup' }, children: [] }],
      children: exec,
    }];

    const plain = emitMapped(exec).text;
    const rootWrapped = emitMapped(wrapped).text;
    return { pass: plain === rootWrapped, plain, rootWrapped };
  });

  if (!r.pass) console.log('PLAIN:\n' + r.plain + '\n\nWRAPPED:\n' + r.rootWrapped);
  expect(r.pass, 'wrapping execution blocks in user_root/param_group does not change emitted G-code').toBe(true);
});
