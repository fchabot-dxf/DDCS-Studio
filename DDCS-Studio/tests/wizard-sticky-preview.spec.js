import { test, expect } from '@playwright/test';

// Single-column (mobile) wizard: the preview is locked at the top so it stays visible while the form scrolls
// under it.
test.use({ viewport: { width: 394, height: 760 } });

test('single-column wizard: preview stays pinned at top while the form scrolls', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('corner'));
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
