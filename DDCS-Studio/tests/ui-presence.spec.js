import { test, expect } from '@playwright/test';

test('UI basics: header, generators, chips and import control are present', async ({ page }) => {
  await page.goto('http://localhost:3211');

  // Header (v10.6+ rebuild): app-switcher tabs + logo + version badge
  await expect(page.locator('.hdr-tabs .tab[data-app="studio"]')).toHaveCount(1);
  await expect(page.locator('.hdr-tabs .tab[data-app="gateway"]')).toHaveCount(1);
  await expect(page.locator('header .ver')).toContainText(/V\d+/);

  // Generator wizard sections exist in the DOM
  await expect(page.locator('#wiz_corner')).toHaveCount(1);
  await expect(page.locator('#wiz_middle')).toHaveCount(1);
  await expect(page.locator('#wiz_edge')).toHaveCount(1);

  // Variable chips render in the command deck's VARIABLES tab (replaced #varList)
  await page.waitForFunction(() => window.ddcsStudio);   // dock listeners attach on app init
  await page.click('#controller-dock .header-handle');
  await page.waitForSelector('#controller-dock.is-expanded');
  await page.click('[data-deck-tab="variables"]');
  await page.waitForSelector('.deck-var-chip', { timeout: 5000 });
  const chipCount = await page.locator('.deck-var-chip').count();
  expect(chipCount).toBeGreaterThan(0);

  // CSV import control lives in Settings now
  await page.evaluate(() => window.openSettings());
  await expect(page.locator('#set_csv_input')).toHaveCount(1);
});
