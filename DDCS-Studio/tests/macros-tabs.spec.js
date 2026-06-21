import { test, expect } from '@playwright/test';

// Macros tab adopts the Settings-style two-level navigation: L1 main tabs (Controller macros | CAM packs)
// filter an L2 sidebar (M-codes / K-buttons under Controller, CAM Pack Builder under CAM). Each sidebar item
// swaps the visible panel; the panels keep their original element IDs so the existing wiring stays live.
test.use({ viewport: { width: 1280, height: 900 } });

test('Macros tab has two-level General/Hardware-style sub-tabs', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => typeof window.showApp === 'function');
  await page.evaluate(() => window.showApp('macros'));
  await page.waitForFunction(() => document.querySelector('#macros-app .settings-main-tab'));

  const shape = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const mainTabs = [...document.querySelectorAll('#macros-app .settings-main-tab')].map((b) => b.textContent.trim());
    const sideTabs = [...document.querySelectorAll('#macros-app .settings-sidebar .settings-tab')].map((b) => b.textContent.trim());
    const vis = (id) => { const el = q('#' + id); return el && getComputedStyle(el).display !== 'none'; };
    return {
      mainTabs, sideTabs,
      // default group = Controller macros → M-codes panel visible, others hidden
      mcodeVis: vis('macros_panel_mcode'), kbtnVis: vis('macros_panel_kbtn'), camVis: vis('macros_panel_cam'),
      // the legacy element IDs the wiring depends on still exist
      hasMcodesList: !!q('#mcodes_list'), hasKbtns: !!q('#kbuttons_list'), hasCamSlots: !!q('#cam_slots'),
    };
  });
  expect(shape.mainTabs).toEqual(['Controller macros', 'CAM packs']);
  expect(shape.sideTabs).toEqual(['M-codes', 'K-buttons', 'CAM Pack Builder']);
  expect(shape.mcodeVis, 'M-codes panel shown by default').toBeTruthy();
  expect(shape.kbtnVis, 'K-buttons panel hidden initially').toBeFalsy();
  expect(shape.camVis, 'CAM panel hidden initially').toBeFalsy();
  expect(shape.hasMcodesList && shape.hasKbtns && shape.hasCamSlots, 'legacy IDs preserved').toBeTruthy();

  // Click K-buttons in the sidebar → K-buttons panel shows
  await page.evaluate(() => [...document.querySelectorAll('#macros-app .settings-sidebar .settings-tab')]
    .find((b) => b.textContent.trim() === 'K-buttons').click());
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('macros_panel_kbtn')).display !== 'none')).toBeTruthy();

  // Switch to the CAM packs main tab → its sidebar item appears and selects the CAM panel
  await page.evaluate(() => [...document.querySelectorAll('#macros-app .settings-main-tab')]
    .find((b) => b.textContent.trim() === 'CAM packs').click());
  const camState = await page.evaluate(() => {
    const side = [...document.querySelectorAll('#macros-app .settings-sidebar .settings-tab')];
    const camItem = side.find((b) => b.textContent.trim() === 'CAM Pack Builder');
    const mcodeItem = side.find((b) => b.textContent.trim() === 'M-codes');
    return {
      camItemShown: camItem && getComputedStyle(camItem).display !== 'none',
      mcodeItemHidden: mcodeItem && getComputedStyle(mcodeItem).display === 'none',
      camPanelVis: getComputedStyle(document.getElementById('macros_panel_cam')).display !== 'none',
    };
  });
  expect(camState.camItemShown, 'CAM sidebar item visible under CAM packs group').toBeTruthy();
  expect(camState.mcodeItemHidden, 'controller-group sidebar items hidden under CAM packs').toBeTruthy();
  expect(camState.camPanelVis, 'CAM panel shown').toBeTruthy();
});
