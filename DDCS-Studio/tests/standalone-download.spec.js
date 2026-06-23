import { test, expect } from '@playwright/test';

// The quick-menu "Download standalone" opens the desktop EXE release — the SAME link the Gateway page uses
// (gatewayStatus.EXE_DOWNLOAD_URL → the latest GitHub release). The "standalone" is the exe (it bundles the
// gateway and runs offline), NOT an HTML file.

test('quick-menu "Download standalone" opens the latest-release EXE link', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.waitForTimeout(300);

  // Capture window.open instead of actually navigating away.
  await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });

  await page.click('#hdrPostBtn');
  expect(await page.locator('#hdrPostMenu').isHidden()).toBe(false);
  const item = page.locator('#hdrPostMenu .hdr-quick-item[data-act="standalone"]');
  await expect(item).toBeVisible();
  await expect(item).toContainText('Download standalone');
  await item.click();

  const opened = await page.evaluate(() => window.__opened);
  expect(opened.length).toBe(1);
  expect(opened[0]).toMatch(/^https:\/\/github\.com\/fchabot-dxf\/DDCS-Studio\/releases\/latest$/);
});
