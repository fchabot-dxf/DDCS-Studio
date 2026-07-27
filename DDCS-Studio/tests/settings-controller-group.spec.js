import { test, expect } from '@playwright/test';

// Settings' L1 groups: Look and feel · Your stuff · Controller · Hardware · Help. Controller holds
// Profile/Variables/Program/Gateway. The grouping is data-driven, so switching groups filters the sidebar correctly.
// t1245 — the old catch-all "General" split into the three tabs named above (contents moved intact); this spec's
// job is unchanged, so it just asks the question against the tab that now holds Appearance.
test.use({ viewport: { width: 1280, height: 900 } });

test('Controller group holds Profile/Variables/Program/Gateway; Look and feel no longer does', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openSettings);
  await page.evaluate(() => window.openSettings());

  // Controller L1 tab exists and reveals its four subtabs
  await page.click('.settings-main-tab[data-group="controller"]');
  for (const t of ['set_tab_profile', 'set_tab_variables', 'set_tab_program', 'set_tab_gateway']) {
    await expect(page.locator(`[data-target="${t}"]`)).toBeVisible();
  }
  // Opening Profile from here still renders its content
  await page.click('[data-target="set_tab_profile"]');
  await expect(page.locator('#set_tab_profile')).toBeVisible();

  // Back on Look and feel: Profile is hidden (it moved), Appearance is the visible first tab
  await page.click('.settings-main-tab[data-group="lookfeel"]');
  await expect(page.locator('[data-target="set_tab_profile"]')).toBeHidden();
  await expect(page.locator('[data-target="set_tab_appearance"]')).toBeVisible();
});
