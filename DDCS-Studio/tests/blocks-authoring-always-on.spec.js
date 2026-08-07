import { test, expect } from '@playwright/test';

/**
 * ONE Blocks mode — authoring is ALWAYS ON (the normal/dev toggle + the two-state split are dissolved): the
 * Save-wizard button is unconditionally present, no toggle to flip. (Operators stay in the wizards; the Blocks tab
 * is the author/learner surface.)
 *
 * t1610 — this spec used to ALSO cover the per-atom inline "expose as knob" checkbox (an EXPOSE_/XMARK_ marker
 * lighting up on tick, no toggle needed to reach it). That checkbox was removed by explicit user instruction —
 * `formfield` is the replacement authoring path, covered end-to-end by formfield-authoring.spec.js. Restated here
 * to keep the still-live claim (no toggle, save always present) rather than deleting it along with the removed half.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('Blocks authoring is always on: no toggle, save always present', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsLoadBlockStack);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);

  // seed a simple program (no toggle, no dev-mode dance)
  await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'move', params: { x: 0, y: 0, z: -5, mode: 'feed' } }]));
  await page.waitForTimeout(400);

  // the normal/dev toggle is GONE; the Save-wizard button is always present
  expect(await page.locator('.blk-dev-toggle').count(), 'the normal/dev toggle is dissolved').toBe(0);
  await expect(page.locator('.blk-dev-savebtn')).toBeVisible();

  await page.evaluate(() => window.ddcsLoadBlockStack && window.ddcsLoadBlockStack([]));
});
