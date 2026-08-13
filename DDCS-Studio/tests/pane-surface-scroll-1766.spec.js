import { test, expect } from '@playwright/test';

// t1766 — t1764 painted #blk_wiz_user's own background, but `.wiz-body`'s base rule (styles.css) ALSO sets
// `max-height: calc(95vh - 120px)` + `overflow-y: auto` on any `.wiz-body` — meant for the modal, where
// `.wiz-box` is a fixed-height floating dialog. #blk_wiz_user inherited that unconditionally too, capping its
// own painted box to ~640px while its real content (visualization + a long form, stacked) can run past 1400px.
// A background paints across the padding box: past that cap, the box is smaller than the scrollable content,
// so a field scrolled beyond ~640px sat on the raw page black regardless of how correct the paint declaration
// was — t1764's own test only asserted #blk_wiz_user's TOP-of-form background, which was already true before
// this fix and never caught the gap. #blk-formpane (the pane's outer sidebar column) already has its own
// `overflow:auto` — the fix removes #blk_wiz_user's redundant inner cap so IT becomes the sole scroll container
// and the background covers everything that scrolls, by construction (no new selector, a removed conflicting
// cap). Pins: a field FAR down a long form (contour's "Attach to Stock", well past the old 640px cap) is
// painted, not raw black, across all 5 themes; and #blk_wiz_user no longer internally scrolls at all
// (scrollHeight === clientHeight) — the outer pane owns scrolling instead.

const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];

for (const theme of THEMES) {
  test(`theme ${theme}: a field scrolled past the old 640px cap is still painted, not raw black`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.showApp && window.openWiz && window.insertWiz);
    await page.evaluate((t) => document.body.setAttribute('data-theme', t), theme);
    await page.evaluate(() => window.openWiz('user_contour_data'));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.insertWiz());
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws);
    await page.waitForTimeout(500);

    const target = page.locator('#blk_wiz_user_form span', { hasText: 'Attach to Stock' }).first();
    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    const info = await page.evaluate(() => {
      const el = document.getElementById('blk_wiz_user');
      const cs = getComputedStyle(el);
      return {
        bgImage: cs.backgroundImage,
        bgColor: cs.backgroundColor,
        internallyScrolls: el.scrollHeight > el.clientHeight + 2,
      };
    });
    expect(info.internallyScrolls).toBe(false);
    const painted = info.bgImage !== 'none' || (info.bgColor !== 'rgba(0, 0, 0, 0)' && info.bgColor !== 'rgb(0, 0, 0)');
    expect(painted).toBe(true);
  });
}
