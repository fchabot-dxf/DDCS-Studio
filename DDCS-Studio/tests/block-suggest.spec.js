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

test('curated seed matches the DDCS macro idioms (probe / tool-change / open)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { suggestNext, _resetLearned } = await import('/blocks/suggest.js');
    _resetLearned();   // seed-only (no learned counts)
    return {
      open: suggestNext('progstart', 4),       // safe-Z/WCS → tool → spindle → rapid in
      distmode: suggestNext('distmode', 3),    // G91 → G31
      probe: suggestNext('probe', 3),          // G31 → IF check → read trigger
      tool: suggestNext('tool', 3),            // change ends with an auto tool-set probe
      probecheck: suggestNext('probecheck', 3),
    };
  });
  expect(r.open[0], 'a job opens by setting the work coordinate system').toBe('wcs');
  expect(r.open.indexOf('tool'), 'tool loads before spindle spins').toBeLessThan(r.open.indexOf('spindle'));
  expect(r.distmode[0], 'incremental mode precedes a probe move (G91 G31)').toBe('probe');
  expect(r.probe[0], 'a probe is followed by its contact check').toBe('probecheck');
  expect(r.probe, 'then the trigger position is read').toContain('proberead');
  expect(r.tool, 'a tool change ends with an auto tool-set probe').toContain('probe');
  expect(r.probecheck, 'after the check, read the trigger').toContain('proberead');
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
