import { test, expect } from '@playwright/test';

/**
 * t2441 — owner-ruled: the desktop find chip (`#editor-find-btn`, `.editor-find-chip`) was too easy to miss —
 * a small grey magnifier tucked in the toolbar corner, versus the same control reading as a prominent, filled
 * chip on mobile. The owner explicitly ruled OUT relocating it (asymmetric left/right toolbar grouping is
 * deliberate — search acts on the code below, aligned with where content/line-numbers begin; the right
 * cluster are actions performed ON the program) and ruled IN three treatments together, desktop only:
 * (1) the chip treatment (ESTABLISHED, not assumed: `.editor-find-chip` was already the ONLY styling this
 * button has ever had, on every viewport — there was no separate mobile-only variant to "reuse"; the base
 * rule itself is now the desktop-enhanced version), (2) a "Find" text label beside the icon, (3) a bigger
 * icon/pill (18px icon vs the original 12px, more padding) toward the neighbouring `.toolbar-btn` cluster's
 * own size, without literally matching its square shape (this stays a pill, deliberately — t2383's own
 * reasoning). `@media (max-width:600px)` — the SAME breakpoint the editor toolbar's own mobile relocation
 * already uses — reverts every one of these back to the exact pre-t2441 values, so mobile (already correct,
 * the explicit model here) is untouched.
 */

test('desktop: the find chip carries a "Find" label and a larger icon than before', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.waitForTimeout(500);

  const chip = await page.evaluate(() => {
    const btn = document.getElementById('editor-find-btn');
    const svg = btn.querySelector('svg');
    const label = btn.querySelector('.editor-find-chip-label');
    return {
      svgW: getComputedStyle(svg).width,
      labelText: label ? label.textContent : null,
      labelDisplay: label ? getComputedStyle(label).display : 'NO LABEL ELEMENT',
    };
  });
  expect(chip.labelText, 'a "Find" label exists in the DOM').toBe('Find');
  expect(chip.labelDisplay, 'the label is actually visible on desktop').not.toBe('none');
  expect(chip.svgW, 'the icon is bigger than the original 12px').toBe('18px');
});

test('desktop: clicking the enlarged/labelled chip still opens the find bar correctly', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.waitForTimeout(500);

  await page.click('#editor-find-btn');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => !document.getElementById('editor-findbar').classList.contains('hidden')), 'the find bar opened').toBe(true);
  expect(await page.evaluate(() => document.activeElement.id), 'the find input took focus').toBe('editor-find-input');
});

test('mobile (max-width:600px): the chip is byte-for-byte the pre-t2441 presentation — icon-only, original size', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.waitForTimeout(500);

  const chip = await page.evaluate(() => {
    const btn = document.getElementById('editor-find-btn');
    const svg = btn.querySelector('svg');
    const label = btn.querySelector('.editor-find-chip-label');
    const cs = getComputedStyle(btn);
    return {
      padding: cs.padding,
      svgW: getComputedStyle(svg).width,
      labelDisplay: label ? getComputedStyle(label).display : 'NO LABEL ELEMENT',
    };
  });
  expect(chip.padding, 'padding matches the original pre-t2441 value').toBe('5px 9px');
  expect(chip.svgW, 'the icon stays at its original 12px on mobile').toBe('12px');
  expect(chip.labelDisplay, 'the "Find" label stays hidden on mobile — icon-only, exactly as before').toBe('none');
});
