import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 } });
test('settings stacks on phone, content full-width', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  // Settings is no longer a header tab — it opens as a modal overlay from the header quick-menu / wizard gear.
  await page.evaluate(() => window.openSettings());
  await page.waitForSelector('#settings-overlay.active #settings-app .settings-sidebar', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const body = document.querySelector('#settings-app .settings-body');
    const side = document.querySelector('#settings-app .settings-sidebar');
    const content = document.querySelector('#settings-app .settings-content');
    return {
      dir: getComputedStyle(body).flexDirection,
      sideW: Math.round(side.getBoundingClientRect().width),
      contentW: Math.round(content.getBoundingClientRect().width),
      docOver: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  console.log('SETTINGS', JSON.stringify(r), 'errs', JSON.stringify(errs));
  expect(r.dir).toBe('column');
  expect(r.contentW).toBeGreaterThan(330);
  expect(r.docOver).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'tests/_settings-390.png', fullPage: true });
});
