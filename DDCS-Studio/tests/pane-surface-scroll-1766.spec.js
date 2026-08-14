import { test, expect } from '@playwright/test';
import { stopLiveSim, dismissToasts } from './support/simControls.js';

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
//
// t1784 ADDITION 5 — REPOINTED onto the real bar->entry->INSERT->Blocks-tab chain (tests/primary-route-real-
// gesture-1776.spec.js's own pattern), replacing window.openWiz/insertWiz/showApp. Addition 2 (t1778) proved
// the openWiz/insertWiz shortcut produces the SAME PROGRAM STATE as a real click, ids stripped — it did NOT
// prove the same RENDERING/STYLING (a painted background + scroll-container behaviour), which is what this
// file asserts. So this repoint checks a layer Addition 2's equivalence result never covered; don't fold it
// back into "the shortcut is proven equivalent, use it here too" without re-checking that claim specifically.

const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];

for (const theme of THEMES) {
  test(`theme ${theme}: a field scrolled past the old 640px cap is still painted, not raw black`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate((t) => document.body.setAttribute('data-theme', t), theme);
    await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Mill' }).click();
    await page.locator('.dock-header .toolbar-dropdown-content button[data-optype="contour"]').click();
    await page.locator('.wiz-foot button.primary', { hasText: 'INSERT' }).waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.wiz-foot button.primary', { hasText: 'INSERT' }).click();
    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => !!window.__blkws);
    await page.waitForTimeout(500);
    // t1818 — the pane's 3D preview autoplays a LOOPING sim on activation (createPreviewPanel.js's own
    // autoStartOnOpen, `pv.autoLoop !== false` by default) the moment this render pass calls panel.setActive(true)
    // — every sibling real-gesture spec that reads pane DOM state after opening Blocks (canvas-handle-writable-
    // 1804, layout-singleton-reparent-1814, layout-ontransform-per-container-1816, ...) stops it first via this
    // same helper; this file never did. A running loop is not merely a visual distraction — the load run that
    // reproduced this file's chronic flake showed `scrollIntoViewIfNeeded` timing out on "waiting for element to
    // be stable" (up to the full 5s default action timeout, not merely running out of overall test budget),
    // i.e. `#blk_wiz_user_form`'s own layout was genuinely still shifting under load, not just slow to reach.
    // Stopping the sim is a real settle condition (an explicit action with a determinate end state), not a
    // longer guess at how long an indeterminate, load-speed-dependent animation might still be running.
    await stopLiveSim(page, '#blk_userViz3dBox');
    await dismissToasts(page);

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
