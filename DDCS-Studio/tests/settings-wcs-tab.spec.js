import { test, expect } from '@playwright/test';

// The WCS table (G54–G59 work offsets) lives in its own tab under the CONTROLLER group (it's controller-derived
// — pulled from the controller, never pushed), not inside Machine.
test.use({ viewport: { width: 1280, height: 900 } });

test('WCS lives in its own tab under Controller, not inside Machine', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openSettings);
  await page.evaluate(() => window.openSettings());

  await page.click('.settings-main-tab[data-group="controller"]');
  await expect(page.locator('[data-target="set_tab_wcs"]')).toBeVisible();

  await page.click('[data-target="set_tab_wcs"]');
  await expect(page.locator('#set_tab_wcs')).toBeVisible();
  await expect(page.locator('#set_tab_wcs #set_mach_wcs_table')).toBeVisible();

  // It is no longer inside the Machine tab
  await expect(page.locator('#set_tab_machine #set_mach_wcs_table')).toHaveCount(0);
});
