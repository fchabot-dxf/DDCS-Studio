import { test, expect } from '@playwright/test';

/**
 * t2417 (mobile wizard buttons, deferred from t2415, ruled to the touch floor 2026-08-29) — MEASURED before
 * touching CSS, per the amendment's own instruction: the real rendered `.wizard-btn` (getBoundingClientRect,
 * not CSS) was 32px tall at a 390px viewport — well under both the Apple 44pt and Google 48dp minimum tap
 * target. Owner ruling: GO TO THE FLOOR — grow to 44-48px even past the originally-asked 8-10% comfort bump,
 * since 32px was already under the floor.
 *
 * VERTICAL AXIS ONLY, holding inline padding — that axis alone feeds the header's own priority-collapse width
 * measurement (HEADER_YIELD, commandDeck.js:15; measured widths at styles.css:2059). `.wizard-btn` scope only,
 * never `.toolbar-btn` globally (which the editor-keys row and other toolbar buttons also use).
 */

async function measureWizardBtns(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.wizard-btn')).map((b) => {
    const r = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    return { width: r.width, height: r.height, paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight };
  }));
}

test('at 390px, every wizard button reaches the 44px touch floor (real rendered rect, not CSS)', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const btns = await measureWizardBtns(page);
  expect(btns.length, 'the header renders wizard group buttons').toBeGreaterThan(0);
  for (const b of btns) expect(b.height, `${JSON.stringify(b)} reaches the 44px floor`).toBeGreaterThanOrEqual(44);
});

test('desktop (>600px) is completely unaffected — the bump is mobile-only', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForTimeout(300);
  const btns = await measureWizardBtns(page);
  for (const b of btns) expect(b.height, 'desktop keeps the original (smaller) button height').toBeLessThan(40);
});

test('inline (horizontal) padding at 390px matches the PRE-EXISTING is-compact/is-mini value — this fix adds no horizontal padding of its own', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const btns = await measureWizardBtns(page);
  // Pinned to the pre-existing `.header-controls.is-mini .toolbar-btn { padding-left: 9px; padding-right: 9px }`
  // value (styles.css:2079) — confirmed live (git-stash A/B) unchanged by this turn's own `min-height` rule,
  // which declares no padding property at all. A regression here would mean a FUTURE edit accidentally added
  // horizontal padding to the mobile rule — the one axis this turn was told to leave alone.
  for (const b of btns) { expect(b.paddingLeft).toBe('9px'); expect(b.paddingRight).toBe('9px'); }
});

test('the priority-collapse ladder at narrow widths is unaffected (same header scroll behavior with or without the height bump)', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => {
    const hc = document.querySelector('.header-controls');
    return {
      scrollWidth: hc.scrollWidth, clientWidth: hc.clientWidth, classes: hc.className,
      pageHorizScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  // Known/pre-existing baseline at 320px (unrelated to this fix, confirmed unchanged with the fix reverted):
  // scrollWidth 368 vs clientWidth 320 — the header's own declared "last resort" internal scroll
  // (styles.css:2058) takes over; the PAGE itself must never scroll horizontally.
  expect(info.pageHorizScroll, 'the page itself never scrolls horizontally — only the header\'s own internal scroll, if any').toBe(false);
  expect(info.classes).toContain('is-mini');   // the collapse ladder still reaches its tightest stage as before
});
