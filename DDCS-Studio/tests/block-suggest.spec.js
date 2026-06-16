import { test, expect } from '@playwright/test';

// Suggestion system (A): a bigram model (curated seed + learned from the user's programs) drives a "Suggested
// next" chip strip; clicking a chip appends that block.
test.use({ viewport: { width: 1280, height: 900 } });

test('suggestion model: curated seed + learning from programs', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { suggestNext, recordProgram, _resetLearned } = await import('/blocks/suggest.js');
    _resetLearned();
    const seed = suggestNext('progstart', 5);                       // cold-start = curated
    recordProgram([{ type: 'move' }, { type: 'drill' }, { type: 'move' }, { type: 'drill' }, { type: 'move' }, { type: 'drill' }]);
    const learned = suggestNext('move', 5);                          // move→drill counted 3× → tops the list
    return { seed, learnedTop: learned[0], excludesSelf: !learned.includes('move') };
  });
  expect(r.seed, 'curated next-after-ProgramStart includes wcs').toContain('wcs');
  expect(r.learnedTop, 'learned move→drill outranks the seed').toBe('drill');
  expect(r.excludesSelf, 'never suggests the same block').toBeTruthy();
});

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
