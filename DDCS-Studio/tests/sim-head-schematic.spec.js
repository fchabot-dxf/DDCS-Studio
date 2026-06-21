import { test, expect } from '@playwright/test';

// Settings → Preview shows a live schematic of the spindle/collet/tool that redraws as the dimension fields change.
test.use({ viewport: { width: 1280, height: 900 } });

test('Preview head schematic renders and updates live with the fields', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openSettings && window.ddcsGetSettings);
  await page.evaluate(() => window.openSettings());
  await page.click('[data-target="set_tab_preview"]');

  await expect(page.locator('#set_pv_head_svg svg')).toHaveCount(1);
  await expect(page.locator('#set_pv_head_svg')).toContainText('Spindle');

  await page.fill('#set_pv_spindle_dia', '120');   // fill fires 'input' → live redraw
  await expect(page.locator('#set_pv_head_svg')).toContainText('Ø120');
});
