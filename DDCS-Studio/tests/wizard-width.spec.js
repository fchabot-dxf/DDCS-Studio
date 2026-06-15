import { test, expect } from '@playwright/test';

// On mobile the body UI zoom (auto ~75%) used to shrink the wizard modal, leaving big side margins. The modal
// width is now divided by --ui-zoom so it fills the screen regardless of zoom; the page must not scroll sideways.
test.use({ viewport: { width: 394, height: 850 } });

test('wizard modal fills the screen width on mobile (zoom-compensated, no h-scroll)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.scaleManager);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('corner'));
  await page.waitForFunction(() => document.querySelector('.wiz-box'));
  await page.waitForTimeout(300);

  const r = await page.evaluate(() => {
    const w = document.querySelector('.wiz-box').getBoundingClientRect();
    return { left: Math.round(w.left), right: Math.round(w.right), vw: window.innerWidth, docScrollW: document.documentElement.scrollWidth, zoom: document.body.style.zoom };
  });
  expect(r.left, 'small left margin (modal fills the width)').toBeLessThan(20);
  expect(r.right, 'small right margin (modal fills the width)').toBeGreaterThan(r.vw - 20);
  expect(r.docScrollW, 'no horizontal page scroll').toBeLessThanOrEqual(r.vw + 1);
});
