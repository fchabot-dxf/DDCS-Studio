import { test, expect } from '@playwright/test';

test('settings opens as a modal from the chevron, closes via Esc; no nav tab', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.waitForTimeout(400);

  // No Settings tab in the nav anymore.
  expect(await page.locator('.hdr-tabs .tab[data-app="settings"]').count()).toBe(0);

  // Open via the chevron quick-menu → Settings… row.
  await page.click('#hdrPostBtn');
  await page.click('#hdrPostMenu .hdr-quick-item[data-act="settings"]');
  await page.waitForTimeout(300);

  const overlayShown = await page.locator('#settings-overlay.active').count();
  expect(overlayShown, 'settings overlay active').toBe(1);
  expect(await page.locator('#settings-app .settings-body').count(), 'settings rendered').toBe(1);

  // Esc closes it.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  expect(await page.locator('#settings-overlay.active').count(), 'closed on Esc').toBe(0);
});
