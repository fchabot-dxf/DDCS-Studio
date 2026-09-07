import { test, expect } from '@playwright/test';

/**
 * GUI param block — TYPED widgets, the real-DOM half. The pure parseParamOptions/extractParamBlocks logic split
 * out to tests/node/gui-param-typed-widgets.test.mjs (tier migration); this file keeps the two tests that need a
 * real page: the form actually rendering + committing through user interaction, and the Class-B render guard
 * (a real Blockly workspace).
 */

test('typed param: dropdown presets + toggle render in the form and commit numbers', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsInsertUserOp && window.ddcsGetBlockProgram);

  await page.evaluate(async () => {
    localStorage.removeItem('ddcs_user_ops');
    const U = await import('/blocks/userOps.js');
    const template = [{ type: 'move', params: {
      x: 0, y: 0,
      feed: { type: 'param', params: { name: 'feed', widget: 'dropdown', value: 500, options: 'Rough=500, Finish=1500' } },
      z:    { type: 'param', params: { name: 'coolant', widget: 'toggle', value: 0 } },
    } }];
    const bindings = U.extractParamBlocks(template);   // the real save path derives bindings from the pills
    U.createUserOp(U.userOpFromStack('typed_test', 'Typed Test', template, bindings));
    window.ddcsInsertUserOp('user_typed_test');
  });

  const form = page.locator('.uop-form');
  await expect(form).toBeVisible();
  await expect(form.locator('select')).toHaveCount(1);                                 // feed → dropdown
  await expect(form.locator('.ddcs-switch input[type="checkbox"]')).toHaveCount(1);    // coolant → toggle

  // pick the Finish preset (1500) and turn the toggle on
  await form.locator('select').selectOption('1500');
  await form.locator('.ddcs-switch .ddcs-slider').click();

  await form.locator('.uop-insert').click();
  await expect(form).toHaveCount(0);

  const op = await page.evaluate(() => (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op' && b.opType === 'user_typed_test'));
  expect(op).toBeTruthy();
  expect(op.params.feed).toBe(1500);     // dropdown preset committed as a NUMBER, not "1500"
  expect(op.params.coolant).toBe(1);     // toggle committed as 1, not true

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test.describe('Class-B render guard', () => {
  test.use({ viewport: { width: 1400, height: 1000 } });

  test('typed param: a dropdown pill actually draws in a socket (with its options field)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.showApp);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);

    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'move', params: {
      x: 0, y: 0, z: { type: 'param', params: { name: 'feed', widget: 'dropdown', value: 500, options: 'Rough=500, Finish=1500' } },
    } }]));
    await page.waitForTimeout(300);

    const render = await page.evaluate(() => {
      const p = window.__blkws.getAllBlocks().find((b) => b.type === 'param');
      const wf = p && p.getField('WIDGET');
      return {
        found: !!p,
        h: p ? p.getHeightWidth().height : 0,
        hasOptions: !!(p && p.getField('OPTIONS')),
        widget: p ? p.getFieldValue('WIDGET') : null,
        widgetChoices: wf && wf.getOptions ? wf.getOptions().map((o) => o[1]) : [],
      };
    });
    expect(render.found, 'param pill present in the socket').toBe(true);
    expect(render.h, 'param pill actually rendered (height > 0)').toBeGreaterThan(0);
    expect(render.hasOptions, 'the OPTIONS field is on the block').toBe(true);
    expect(render.widget, 'the dropdown widget value is accepted by the field').toBe('dropdown');
    expect(render.widgetChoices, 'all four numeric-socket widgets are offered').toEqual(
      expect.arrayContaining(['number', 'slider', 'dropdown', 'toggle']));
  });
});
