import { test, expect } from '@playwright/test';

// Palette search: a filter input above the toolbox; typing shows the matching blocks (across all categories) in
// the flyout; clearing restores the categories.
test.use({ viewport: { width: 1280, height: 900 } });

test('palette search filters blocks into the flyout', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkWs && document.querySelector('#blocks-app .blk-search'));

  const flyoutCount = () => page.evaluate(() => {
    try { return window.__blkWs.getToolbox().getFlyout().getWorkspace().getTopBlocks(false).length; } catch (_) { return -1; }
  });

  // a specific term → just that block (search matches label + type + category, so use a term that's unique to one
  // block and not a substring of any category name — e.g. 'spindle' now also matches the "Spindle & Feed" category)
  await page.fill('#blocks-app .blk-search', 'coolant');
  await page.waitForTimeout(200);
  expect(await flyoutCount(), 'coolant → 1 match').toBe(1);

  // a broader term → several
  await page.fill('#blocks-app .blk-search', 'probe');
  await page.waitForTimeout(200);
  expect(await flyoutCount(), 'probe → several matches').toBeGreaterThan(1);

  // gibberish → no block matches
  await page.fill('#blocks-app .blk-search', 'zzzqqq');
  await page.waitForTimeout(200);
  expect(await flyoutCount(), 'no matches → 0 blocks').toBe(0);
});
