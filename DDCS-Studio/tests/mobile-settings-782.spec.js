import { test, expect } from '@playwright/test';

/**
 * t782 part 2 — SETTINGS UNDER THE MOBILE BROWSER BAR. The full-screen mobile Settings modal was 100vh (the LARGE
 * viewport) and centered, so under the phone's URL bar its top tab strip clipped above the fold. Fix: 100dvh (the visible
 * height) + top-aligned + safe-area insets. Emulated here with a SHORT viewport (the URL bar's effect) — the tabs stay
 * fully visible + tappable.
 */
test.use({ viewport: { width: 390, height: 640 } });   // a short mobile viewport ≈ the URL bar eating height

test('the mobile Settings tab strip is fully visible + tappable (top-aligned, not clipped under the browser bar)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openSettings);
  await page.evaluate(() => window.openSettings());
  await page.waitForSelector('#settings-app .settings-tabs', { state: 'visible', timeout: 8000 });
  const r = await page.evaluate(() => {
    const ov = document.getElementById('settings-overlay');
    const modal = document.getElementById('settings-app');
    const tabs = document.querySelector('#settings-app .settings-tabs');
    const btn = tabs.querySelector('button, .settings-tab, [role="tab"]') || tabs.firstElementChild;
    const tb = tabs.getBoundingClientRect(), mb = modal.getBoundingClientRect(), bb = btn.getBoundingClientRect();
    return {
      align: getComputedStyle(ov).alignItems,
      modalTop: Math.round(mb.top),
      tabsVisible: tb.top >= -0.5 && tb.bottom <= window.innerHeight + 0.5 && tb.height > 0,
      firstTabTappable: bb.top >= -0.5 && bb.bottom <= window.innerHeight + 0.5 && btn.offsetParent !== null,
    };
  });
  expect(r.align, 'the mobile settings overlay top-aligns the modal (tabs at the visible top)').toBe('flex-start');
  expect(r.modalTop, 'the modal starts at the visible top (not centered/floated above the fold)').toBeLessThanOrEqual(1);
  expect(r.tabsVisible, 'the main tab strip is fully within the viewport (not clipped under the URL bar)').toBe(true);
  expect(r.firstTabTappable, 'a tab is on-screen + tappable').toBe(true);
});

test('the mobile Settings CSS uses dvh + safe-area (not the 100vh that overflowed under the browser bar)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const css = await page.evaluate(async () => { const res = await fetch('/styles.css'); return res.text(); });
  // the fix: a .settings-modal rule sized by dvh + carrying safe-area insets (the mobile block)
  const block = (css.match(/\.settings-modal\s*\{[^{}]*100dvh[^{}]*\}/) || [''])[0];
  expect(block, 'a .settings-modal rule uses 100dvh (the visible height, not the overflowing 100vh)').toBeTruthy();
  expect(/safe-area-inset/.test(block), 'that rule carries safe-area insets (tabs/footer clear of notch/home indicator)').toBe(true);
});
