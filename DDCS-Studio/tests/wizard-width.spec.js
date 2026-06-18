import { test, expect } from '@playwright/test';

// The wizard modal must fill the screen width on mobile (min(96vw, 560px)) without scrolling sideways.
test.use({ viewport: { width: 394, height: 850 } });

test('wizard modal fills the screen width on mobile (no h-scroll)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('corner'));
  await page.waitForFunction(() => document.querySelector('.wiz-box'));
  await page.waitForTimeout(300);

  const r = await page.evaluate(() => {
    const w = document.querySelector('.wiz-box').getBoundingClientRect();
    return { left: Math.round(w.left), right: Math.round(w.right), vw: window.innerWidth, docScrollW: document.documentElement.scrollWidth };
  });
  expect(r.left, 'small left margin (modal fills the width)').toBeLessThan(20);
  expect(r.right, 'small right margin (modal fills the width)').toBeGreaterThan(r.vw - 20);
  expect(r.docScrollW, 'no horizontal page scroll').toBeLessThanOrEqual(r.vw + 1);
});
