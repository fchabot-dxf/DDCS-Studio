import { test, expect } from '@playwright/test';

/**
 * Panel-types — a custom wizard declares its panel layout (def.panel): form (no preview) / form3d (3D) / form2d
 * (a 2D stock layout). The generic userOpView shows/hides the preview pane and picks 3D vs the FeatureCanvas 2D
 * accordingly. def.panel is persisted with the op.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

const mk = async (page, slug, panel, extraBinding) => page.evaluate(async ({ slug, panel, extraBinding }) => {
  const U = await import('/blocks/userOps.js');
  U.createUserOp(U.userOpFromStack(slug, slug, [{ type: 'move', params: { x: 0, y: 0, z: -5 } }],
    [{ param: 'depth', blockIndex: 0, key: 'z', type: 'number', default: -5 }, ...(extraBinding || [])], panel));
}, { slug, panel, extraBinding });

test('panel-types: form / form3d / form2d render the right preview pane', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  await mk(page, 'p_form', 'form');
  await mk(page, 'p_2d', 'form2d', [
    { param: 'px', blockIndex: 0, key: 'x', type: 'number', group: 'pos', role: 'x', widget: 'xy-pad', default: 40 },
    { param: 'py', blockIndex: 0, key: 'y', type: 'number', group: 'pos', role: 'y', default: 30 },
  ]);
  await mk(page, 'p_3d', 'form3d');

  // FORM ONLY → no preview pane, single column
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_p_form'));
  await expect(page.locator('#wiz_user')).toBeVisible();
  await expect(page.locator('#wiz_user .wiz-visual')).toBeHidden();
  expect(await page.evaluate(() => document.querySelector('.wiz-box').classList.contains('two-pane'))).toBe(false);

  // FORM + 2D → preview pane shows a FeatureCanvas layout
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_p_2d'));
  await expect(page.locator('#wiz_user .wiz-visual')).toBeVisible();
  await expect(page.locator('#userVizContainer svg')).toHaveCount(1);

  // FORM + 3D → preview pane shows the shared 3D panel
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_p_3d'));
  await expect(page.locator('#wiz_user .wiz-visual')).toBeVisible();
  await expect(page.locator('#wiz_user .wiz-viz3d')).toHaveCount(1);

  // def.panel persisted
  const panels = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const by = Object.fromEntries(U.listUserOps().map((d) => [d.opType, d.panel]));
    return by;
  });
  expect(panels.user_p_form).toBe('form');
  expect(panels.user_p_2d).toBe('form2d');
  expect(panels.user_p_3d).toBe('form3d');

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
