import { test, expect } from '@playwright/test';

// Inline suggestion float (B): a floating box of the likely next blocks on the canvas (block-silhouette options,
// same panel look as the Studio editor autocomplete). Click an option to insert; Tab takes the first. The
// Settings → Editor (compose.ghost) toggle hides it.
test.use({ viewport: { width: 1280, height: 900 } });

test('suggestion float shows multiple block options and Tab takes the first', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsGetSettings);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkWs);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.compose.ghost = true; window.dispatchEvent(new Event('ddcs:settings-changed')); });
  await page.waitForSelector('#blocks-app .blk-sug-float:not([hidden])');

  // more than one option, and the first carries the Tab hint
  const opts = page.locator('#blocks-app .blk-sug-float .blk-sug-opt');
  expect(await opts.count(), 'float offers several options').toBeGreaterThan(1);
  expect(await opts.first().locator('kbd').count(), 'first option shows the Tab hint').toBe(1);

  const opCount = () => page.evaluate(() => ((window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [])
    .filter((b) => b && b.type !== 'progstart' && b.type !== 'progend').length);
  const before = await opCount();
  await page.evaluate(() => {        // Tab over the canvas (not in a field) → take the first option
    const host = document.querySelector('#blocks-app .blk-bk-host');
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  });
  await page.waitForTimeout(250);
  expect(await opCount(), 'Tab inserted the first suggested block').toBeGreaterThan(before);
});

test('clicking a float option inserts that specific block', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsGetSettings);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkWs);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.compose.ghost = true; window.dispatchEvent(new Event('ddcs:settings-changed')); });
  await page.waitForSelector('#blocks-app .blk-sug-float .blk-sug-opt');

  const opCount = () => page.evaluate(() => ((window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [])
    .filter((b) => b && b.type !== 'progstart' && b.type !== 'progend').length);
  const before = await opCount();
  await page.locator('#blocks-app .blk-sug-float .blk-sug-opt').nth(1).click();   // pick the 2nd option
  await page.waitForTimeout(250);
  expect(await opCount(), 'clicking an option appended a block').toBeGreaterThan(before);
});

test('compose.ghost toggle hides the suggestion float', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsGetSettings);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkWs);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.compose.ghost = true; window.dispatchEvent(new Event('ddcs:settings-changed')); });
  await page.waitForSelector('#blocks-app .blk-sug-float:not([hidden])');

  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.compose.ghost = false; window.dispatchEvent(new Event('ddcs:settings-changed')); });
  await page.waitForSelector('#blocks-app .blk-sug-float', { state: 'hidden' });
  expect(await page.locator('#blocks-app .blk-sug-float').isHidden()).toBeTruthy();
});
