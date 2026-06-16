import { test, expect } from '@playwright/test';

// Ghost next-block (B): a faint, block-shaped preview of the most-likely next block, anchored under the last
// block. Tab (or click) accepts it; the Settings → Editor (compose.ghost) toggle hides it.
test.use({ viewport: { width: 1280, height: 900 } });

test('ghost shows the likely next block and Tab accepts it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsGetSettings);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkWs);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.compose.ghost = true; s.compose.suggestions = true; window.dispatchEvent(new Event('ddcs:settings-changed')); });
  await page.waitForSelector('#blocks-app .blk-ghost:not([hidden])');

  expect((await page.locator('#blocks-app .blk-ghost').textContent())?.trim().length, 'ghost names a block').toBeGreaterThan(0);

  const opCount = () => page.evaluate(() => ((window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [])
    .filter((b) => b && b.type !== 'progstart' && b.type !== 'progend').length);
  const before = await opCount();
  await page.evaluate(() => {        // simulate Tab over the canvas (not in a field) → accept
    const host = document.querySelector('#blocks-app .blk-bk-host');
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  });
  await page.waitForTimeout(250);
  expect(await opCount(), 'Tab accepted the ghost → a block was inserted').toBeGreaterThan(before);
});

test('compose.ghost toggle hides the ghost', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsGetSettings);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkWs);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.compose.ghost = true; s.compose.suggestions = true; window.dispatchEvent(new Event('ddcs:settings-changed')); });
  await page.waitForSelector('#blocks-app .blk-ghost:not([hidden])');

  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.compose.ghost = false; window.dispatchEvent(new Event('ddcs:settings-changed')); });
  await page.waitForSelector('#blocks-app .blk-ghost', { state: 'hidden' });
  expect(await page.locator('#blocks-app .blk-ghost').isHidden()).toBeTruthy();
});
