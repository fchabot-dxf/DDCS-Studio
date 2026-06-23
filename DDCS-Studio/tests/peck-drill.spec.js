import { test, expect } from '@playwright/test';

// Peck drilling must be a real G83 incremental stepdown: rapid down to just above the last peck, then FEED only
// the new increment (not feed from clearance to the full depth every peck, which re-cuts the whole hole and
// reads as "X times the same depth").
test('peck drill steps down incrementally with rapid re-entry (feeds only the new bit)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const lines = await page.evaluate(async () => {
    const { peckDrill } = await import('/wizards/ops/drill.js');
    return peckDrill({ x: 0, y: 0 }, { depth: 10, peck: 2, feed: 100, clearance: 5 });
  });

  // feed plunges deepen by the increment each peck
  const feedDepths = lines.filter((l) => /^G1 Z/.test(l)).map((l) => parseFloat(l.match(/Z(-?[\d.]+)/)[1]));
  expect(feedDepths, 'each peck feeds to a new, deeper level').toEqual([-2, -4, -6, -8, -10]);

  // before later pecks there is a rapid back to JUST ABOVE the last depth (not all the way to clearance)
  expect(lines.includes('G0 Z-1.5'), 'rapid re-entry above the 1st peck').toBeTruthy();
  expect(lines.includes('G0 Z-7.5'), 'rapid re-entry above the 4th peck').toBeTruthy();

  // sanity: full retract to clearance still happens between pecks (chip clearing)
  expect(lines.filter((l) => l === 'G0 Z5').length, 'retracts to clearance each peck').toBe(5);
});
