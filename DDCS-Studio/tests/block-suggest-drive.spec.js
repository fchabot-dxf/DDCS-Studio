import { test, expect } from '@playwright/test';

// Suggestion system (A): a bigram model (curated seed + learned from the user's programs) drives a "Suggested
// next" chip strip; clicking a chip appends that block. See the sibling tests/node/block-suggest.test.mjs for
// the two pure suggestNext()-only tests (moved to the node tier at tier-migration work package B).
//
// The test below stays here: it drives a real click on a rendered chip in the Blocks app.
test.use({ viewport: { width: 1280, height: 900 } });

test('suggestion strip: clicking a chip appends a block', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkWs && document.querySelector('#blocks-app .blk-suggest'));
  await page.waitForFunction(() => document.querySelector('#blocks-app .blk-suggest .blk-sug-chip'));

  const opCount = () => page.evaluate(() => ((window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [])
    .filter((b) => b && b.type !== 'progstart' && b.type !== 'progend').length);
  const before = await opCount();
  await page.click('#blocks-app .blk-suggest .blk-sug-chip');
  await page.waitForTimeout(250);
  expect(await opCount(), 'clicking a suggestion appended a block').toBeGreaterThan(before);
});
