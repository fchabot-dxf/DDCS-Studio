import { test, expect } from '@playwright/test';

test('UI basics: header, generators, chips and import control are present', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Header/title should be present
  await expect(page.locator('.hdr-text')).toHaveCount(1);
  await expect(page.locator('.hdr-text')).toContainText(/DDCS STUDIO/i);

  // Generator wizard sections exist in the DOM
  await expect(page.locator('#wiz_corner')).toHaveCount(1);
  await expect(page.locator('#wiz_middle')).toHaveCount(1);
  await expect(page.locator('#wiz_edge')).toHaveCount(1);

  // Variable chips should render into #varList (wait for DB load)
  await page.waitForSelector('#varList .variable-chip', { timeout: 5000 });
  const chipCount = await page.locator('#varList .variable-chip').count();
  expect(chipCount).toBeGreaterThan(0);

  // CSV import control exists
  await expect(page.locator('#csvInput')).toHaveCount(1);
});
