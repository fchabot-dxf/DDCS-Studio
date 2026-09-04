import { test, expect } from '@playwright/test';
import { registerClassicFixture } from './support/classicFixture.js';

// Single-column (mobile) wizard: the preview is locked at the top so it stays visible while the form scrolls
// under it.
test.use({ viewport: { width: 394, height: 760 } });

// t2629 — DECOUPLED from `corner` (which resolves to `user_corner_data`'s twin view): this checks the
// WHOLE-FORM `.wiz-2pane`/`.wiz-visual` sticky-preview mechanism, classic-render-only (tree mode's
// split_horizontal never builds `.wiz-2pane`/`.wiz-visual` at all) — needed "some classic op", not corner's
// own content. `registerClassicFixture` (tests/support/classicFixture.js), the same fix `passes-field-1613.
// spec.js` (t2625) proved for a different mechanism.
test('single-column wizard: preview stays pinned at top while the form scrolls', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const opType = await registerClassicFixture(page);
  await page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), opType);
  await page.waitForFunction(() => document.querySelector('.wiz-2pane > .wiz-visual'));
  await page.waitForTimeout(400);
  const read = () => page.evaluate(() => {
    const v = document.querySelector('.wiz-2pane > .wiz-visual');
    return { top: Math.round(v.getBoundingClientRect().top), pos: getComputedStyle(v).position };
  });
  const before = await read();
  expect(before.pos, 'preview is sticky').toBe('sticky');
  await page.evaluate(() => { const b = document.querySelector('.two-pane .wiz-body') || document.querySelector('.wiz-body'); b.scrollTop = 300; });
  await page.waitForTimeout(200);
  const after = await read();
  expect(Math.abs(after.top - before.top), 'preview stays pinned (top unchanged after scrolling the form 300px)').toBeLessThan(4);
});
