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

const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];

for (const theme of THEMES) {
  test(`theme ${theme}: the Wizard View pane paints its own surface, not the raw page background`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.showApp && window.openWiz && window.insertWiz);
    await page.evaluate((t) => document.body.setAttribute('data-theme', t), theme);
    await page.evaluate(() => window.openWiz('user_corner_data'));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.insertWiz());
    await page.evaluate(() => window.showApp('blocks'));
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
