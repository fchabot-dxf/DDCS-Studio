import { test, expect } from '@playwright/test';

test('settings opens as a modal from the chevron, closes via Esc; no nav tab', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });   // t1307 — the DECLARED boot signal (t1279): `window.ddcsStudio` exists long before the deferred wiring puts handlers on the header/menu controls this spec clicks

  // No Settings tab in the nav anymore.
  expect(await page.locator('.hdr-tabs .tab[data-app="settings"]').count()).toBe(0);

  // Open via the file menu (the filename chip) → Workspace section → Settings… row. t2149 (BACKLOG #9) moved
  // Settings from the file menu to the app menu; t2184 (amendment 2) moved it BACK — it's saved into the
  // .ddcs (backup.js's own save registry), so it's workspace content, not product chrome.
  await page.click('#hdrPostBtn');
  // t2184 (amendment 16) — settings is a `.hq-ws-btn` grid tile now, not a standalone `.hdr-quick-item`.
  await page.click('#hdrPostMenu [data-act="settings"]');
  await page.waitForTimeout(300);

  const overlayShown = await page.locator('#settings-overlay.active').count();
  expect(overlayShown, 'settings overlay active').toBe(1);
  expect(await page.locator('#settings-app .settings-body').count(), 'settings rendered').toBe(1);

  // Esc closes it.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  expect(await page.locator('#settings-overlay.active').count(), 'closed on Esc').toBe(0);
});
