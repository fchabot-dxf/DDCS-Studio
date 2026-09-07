import { test, expect } from './support/harness.mjs';

// Suggestion system (A): a bigram model (curated seed + learned from the user's programs) drives a "Suggested
// next" chip strip; clicking a chip appends that block.
//
// TIER MIGRATION WORK PACKAGE B: split out of tests/block-suggest.spec.js — these two tests import
// /blocks/suggest.js directly and assert on its plain returned arrays, no DOM. The third test (clicking a
// real chip in the rendered UI) stays in tests/block-suggest-drive.spec.js.

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
