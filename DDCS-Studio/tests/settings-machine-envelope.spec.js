import { test, expect } from '@playwright/test';

// The Machine tab edits travel on an isometric envelope. Travel is SIGNED (the sign is the home direction), so the
// home origin (⬤) sits at the corner the signs dictate — flipping a sign moves the origin to the opposite corner.
test.use({ viewport: { width: 1280, height: 900 } });

test('machine envelope GUI: signed travels move the home origin + persist', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openSettings && window.ddcsGetSettings);
  await page.evaluate(() => window.openSettings());
  await page.click('.settings-main-tab[data-group="hardware"]');
  await page.click('[data-target="set_tab_machine"]');

  await expect(page.locator('#set_mach_env_gui svg')).toHaveCount(1);
  await expect(page.locator('#set_mach_env_gui input.dim-edit')).toHaveCount(3);

  await page.fill('#set_mach_x', '300');
  await page.dispatchEvent('#set_mach_x', 'input');
  const cxPos = Number(await page.locator('#set_mach_env_gui circle').getAttribute('cx'));

  await page.fill('#set_mach_x', '-300');           // flip the home direction
  await page.dispatchEvent('#set_mach_x', 'input');
  const cxNeg = Number(await page.locator('#set_mach_env_gui circle').getAttribute('cx'));

  expect(Math.abs(cxNeg - cxPos), 'origin moved to the other corner').toBeGreaterThan(20);

  await page.dispatchEvent('#set_mach_x', 'change'); // commit
  const mx = await page.evaluate(() => window.ddcsGetSettings().machine.x);
  expect(mx, 'signed travel persisted').toBe(-300);
});
