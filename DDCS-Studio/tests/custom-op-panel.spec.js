import { test, expect } from '@playwright/test';

/**
 * P3 core — custom ops REUSE the built-in wizard panel. A user op opens in the shared #wiz_user two-pane panel:
 * its form is built from the bindings (real widgets), the code/preview generate from its builder, the shared Insert
 * commits it, and the Studio hover-edit path (canEdit → openForEdit) re-opens it SEEDED from the op's params.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('custom op opens + edits in the wizard panel (reuses #wiz_user)', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager && window.ddcsGetBlockProgram && window.ddcsCanEditOp);

  await page.evaluate(async () => {
    localStorage.removeItem('ddcs_user_ops');
    const U = await import('/blocks/userOps.js');
    U.createUserOp(U.userOpFromStack('panel_test', 'Panel Test',
      [{ type: 'move', params: { x: 0, y: 0, z: -5 } }],
      [{ param: 'depth', blockIndex: 0, key: 'z', type: 'number', widget: 'slider', widgetConfig: { min: -20, max: 0, step: 1 }, default: -5 }]));
  });

  // open it as a wizard → the SHARED custom panel, not a modal
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_panel_test'));
  await expect(page.locator('#wiz_user')).toBeVisible();
  await expect(page.locator('#wiz_user_form input[type="range"]')).toHaveCount(1);   // the slider widget rendered in the panel
  await expect(page.locator('#wiz_user_code')).not.toBeEmpty();                       // code generated from the builder

  // hover-edit gating: every custom op is editable
  expect(await page.evaluate(() => window.ddcsCanEditOp('user_panel_test'))).toBe(true);

  // change the slider live → the code preview re-generates
  const codeBefore = await page.locator('#wiz_user_code').textContent();
  await page.evaluate(() => { const r = document.querySelector('#wiz_user_form input[type="range"]'); r.value = '-12'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#wiz_user_code')).not.toHaveText(codeBefore);

  // Insert via the manager's shared commit (the wiz Insert button calls this) → the op lands in the program
  await page.evaluate(async () => { await window.ddcsStudio.wizardManager.insert(); });
  const op = await page.evaluate(() => (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op' && b.opType === 'user_panel_test'));
  expect(op, 'custom op committed into the program').toBeTruthy();
  expect(op.params.depth).toBe(-12);

  // Studio hover chip → ddcsEditOp(id) → openForEdit re-opens the SAME panel, SEEDED from the op's params
  await page.evaluate((id) => window.ddcsStudio.wizardManager.openForEdit(id), op.id);
  await expect(page.locator('#wiz_user')).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('#wiz_user_form input[type="range"]').value)).toBe('-12');   // seeded from params

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
