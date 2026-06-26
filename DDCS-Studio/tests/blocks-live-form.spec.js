import { test, expect } from '@playwright/test';

/**
 * Live block→form (custom-op round-trip, step 1). Editing a custom wizard in the Blocks tab renders its FORM as a
 * pure VIEW of the blocks — derived live (deriveAuthoredDef), no save needed. Editing a block's value re-derives the
 * form, so you "see the form change." (Built-ins are unaffected — they generate, not view.) Writeback is step 2.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('editing a custom op shows its form derived from the blocks; editing a block updates the form', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDef && window.ddcsRefreshWizardBar);

  // a custom op with one exposed number knob "depth" = -5
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    const template = [{ type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', value: -5 } } } }];
    const bindings = U.extractParamBlocks(template);
    U.createUserOp(U.userOpFromStack('liveform', 'Live Form', template, bindings));
    window.ddcsRefreshWizardBar();
  });

  // re-author it → Blocks tab; the live form pane appears with a control for the knob (no save)
  await page.evaluate(() => window.ddcsEditWizardDef('user_liveform'));
  await page.waitForSelector('#blk-formpane:not([hidden]) #blk-form [data-param="depth"]', { timeout: 8000 });

  const before = await page.evaluate(() => {
    const f = document.querySelector('#blk-form [data-param="depth"]');
    return { val: f && Number(f.value), hasLabel: /depth/i.test(document.getElementById('blk-form').textContent) };
  });
  expect(before.hasLabel, 'the form shows the exposed knob label').toBe(true);
  expect(before.val, 'the form reflects the block value, derived without saving').toBe(-5);

  // EDIT the block value -5 → -8 → reproject → the form re-derives and reflects it ("see the form change")
  await page.evaluate(async () => {
    const ws = window.__blkws;
    const { FN } = await import('/blocks/blockly/bridge.js');
    const pb = ws.getAllBlocks().find((b) => b.type === 'param');
    const tgt = pb.getInput(FN('value')).connection.targetBlock();
    tgt.setFieldValue('-8', 'NUM');
  });
  await expect.poll(async () => page.evaluate(() => {
    const f = document.querySelector('#blk-form [data-param="depth"]');
    return f ? Number(f.value) : null;
  })).toBe(-8);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test('the live form pane is hidden when NOT editing a custom op (normal Blocks use)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws);
  await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'move', params: { x: 0, y: 0, z: -5, mode: 'feed' } }]));
  await page.waitForTimeout(500);
  const hidden = await page.evaluate(() => document.getElementById('blk-formpane').hidden);
  expect(hidden, 'no form pane when just building a program (not editing a wizard)').toBe(true);
});
