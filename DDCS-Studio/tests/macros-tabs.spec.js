import { test, expect } from '@playwright/test';

// Macros tab: flat top-bar tabs (M-codes | K-buttons | CAM Pack Builder) — each shows its panel directly,
// no L2 sidebar. The panels keep their original element IDs so the existing wiring stays live.
test.use({ viewport: { width: 1280, height: 900 } });

test('Macros tab has 3 flat top-bar tabs (no sidebar)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => typeof window.showApp === 'function');
  await page.evaluate(() => window.showApp('macros'));
  await page.waitForFunction(() => document.querySelector('#macros-app .settings-main-tab'));

  const shape = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const mainTabs = [...document.querySelectorAll('#macros-app .settings-main-tab')].map((b) => b.textContent.trim());
    const vis = (id) => { const el = q('#' + id); return el && getComputedStyle(el).display !== 'none'; };
    return {
      mainTabs,
      hasSidebar: !!q('#macros-app .settings-sidebar'),
      mcodeVis: vis('macros_panel_mcode'), kbtnVis: vis('macros_panel_kbtn'), camVis: vis('macros_panel_cam'),
      hasMcodesList: !!q('#mcodes_list'), hasKbtns: !!q('#kbuttons_list'), hasCamSlots: !!q('#cam_slots'),
    };
  });
  expect(shape.mainTabs).toEqual(['M-codes', 'K-buttons', 'CAM Pack Builder']);
  expect(shape.hasSidebar, 'no L2 sidebar — the three tabs are first-level (top bar)').toBeFalsy();
  expect(shape.mcodeVis, 'M-codes panel shown by default').toBeTruthy();
  expect(shape.kbtnVis, 'K-buttons panel hidden initially').toBeFalsy();
  expect(shape.camVis, 'CAM panel hidden initially').toBeFalsy();
  expect(shape.hasMcodesList && shape.hasKbtns && shape.hasCamSlots, 'legacy panel IDs preserved').toBeTruthy();

  // Click K-buttons (top bar) → its panel shows
  await page.evaluate(() => [...document.querySelectorAll('#macros-app .settings-main-tab')]
    .find((b) => b.textContent.trim() === 'K-buttons').click());
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('macros_panel_kbtn')).display !== 'none')).toBeTruthy();

  // Click CAM Pack Builder (top bar) → its panel shows
  await page.evaluate(() => [...document.querySelectorAll('#macros-app .settings-main-tab')]
    .find((b) => b.textContent.trim() === 'CAM Pack Builder').click());
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('macros_panel_cam')).display !== 'none')).toBeTruthy();
});
