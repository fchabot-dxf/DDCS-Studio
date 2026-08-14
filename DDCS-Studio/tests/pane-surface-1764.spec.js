import { test, expect } from '@playwright/test';

// t1764 — the Blocks tab's Wizard View pane (#blk_wiz_user) renders the SAME userOpView form the "Open as
// modal" overlay does, but painted no surface of its own: every theme's .wiz-box (the modal's outer wrapper)
// supplies background/border/border-radius/box-shadow, and #blk_wiz_user has no .wiz-box ancestor — it IS the
// .wiz-body, embedded directly in the pane's own chrome. .wiz-body itself is layout-only (padding/gap/flex),
// so the page's raw black showed through and every theme's dark-on-light label/header colours (tuned for the
// PANEL background, not the page background) landed on black — illegible. Fixed by keying every themed
// .wiz-box surface rule on BOTH `.wiz-box` and `#blk_wiz_user` (styles.css) rather than duplicating the rules
// into a second block. Pins: the pane's own background-image/background-color is non-default across all 5
// themes, not the raw page black / transparent it was before.
//
// t1784 ADDITION 5 — REPOINTED onto the real bar->entry->INSERT->Blocks-tab chain (tests/primary-route-real-
// gesture-1776.spec.js's own pattern), replacing window.openWiz/insertWiz/showApp. Addition 2 (t1778) proved
// the openWiz/insertWiz shortcut produces the SAME PROGRAM STATE as a real click, ids stripped — it did NOT
// prove the same RENDERING/STYLING, which is exactly what this file asserts (a painted background is a CSS/DOM
// fact, invisible to a program-state deep-equal). So this repoint is not redundant with Addition 2's result —
// it is checking a different layer that equivalence result never covered. Do not "simplify" this back to the
// shortcut citing Addition 2 without re-establishing that the two routes paint identically too.

const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];

for (const theme of THEMES) {
  test(`theme ${theme}: the Wizard View pane paints its own surface, not the raw page background`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate((t) => document.body.setAttribute('data-theme', t), theme);
    await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Probe' }).click();
    await page.locator('.dock-header .toolbar-dropdown-content button[data-optype="corner"]').click();
    await page.locator('.wiz-foot button.primary', { hasText: 'INSERT' }).waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.wiz-foot button.primary', { hasText: 'INSERT' }).click();
    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => !!window.__blkws);
    await page.waitForTimeout(500);

    const info = await page.evaluate(() => {
      const el = document.getElementById('blk_wiz_user');
      const cs = getComputedStyle(el);
      return { bgImage: cs.backgroundImage, bgColor: cs.backgroundColor };
    });
    // Painted = either a real background-image (gradient themes) or a real, non-transparent, non-black
    // background-color (flat-colour themes) — the pre-fix state was bgImage:'none' + bgColor:'rgba(0,0,0,0)'
    // (fully transparent) on every theme.
    const painted = info.bgImage !== 'none' || (info.bgColor !== 'rgba(0, 0, 0, 0)' && info.bgColor !== 'rgb(0, 0, 0)');
    expect(painted).toBe(true);
  });
}
