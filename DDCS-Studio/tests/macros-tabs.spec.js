import { test, expect } from '@playwright/test';

// Macros tab: a SYSDISK file-tree in a left SIDEBAR (slib-m.nc → Custom M-codes, key-N.nc → K-buttons,
// CAM/macro_camN.nc → CAM Pack Builder, plus the system hooks). Each tree item selects its panel in the content
// pane; the panels keep their original element IDs so the existing builder wiring stays live. (This replaced the
// old flat top-bar tabs — the test now asserts the sidebar-tree layout the app actually renders.)
test.use({ viewport: { width: 1280, height: 900 } });

test('Macros tab is a sidebar file-tree whose items select their panels', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => typeof window.showApp === 'function');
  await page.evaluate(() => window.showApp('macros'));
  await page.waitForFunction(() => document.querySelector('#macros-app .settings-sidebar .settings-tab'));

  const shape = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const tabs = [...document.querySelectorAll('#macros-app .settings-sidebar .settings-tab')];
    const vis = (id) => { const el = q('#' + id); return el && getComputedStyle(el).display !== 'none'; };
    const active = tabs.find((b) => b.classList.contains('active'));
    return {
      hasSidebar: !!q('#macros-app .settings-sidebar'),
      noFlatTabs: !q('#macros-app .settings-main-tab'),
      targets: tabs.map((b) => b.dataset.target),
      activeTarget: active && active.dataset.target,
      mcodeVis: vis('macros_panel_mcode'), kbtnVis: vis('macros_panel_kbtn'), camVis: vis('macros_panel_cam'),
      hasMcodesList: !!q('#mcodes_list'), hasKbtns: !!q('#kbuttons_list'), hasCamSlots: !!q('#cam_slots'),
    };
  });
  // the layout is a left sidebar tree, not the old flat top-bar tabs
  expect(shape.hasSidebar, 'the macros tab uses a left sidebar (file tree)').toBeTruthy();
  expect(shape.noFlatTabs, 'the old flat top-bar tabs are gone').toBeTruthy();
  // the tree exposes the core builder panels (slib-m.nc → M-codes, key-N.nc → K-buttons, CAM/ → pack builder)
  expect(shape.targets).toEqual(expect.arrayContaining(['macros_panel_mcode', 'macros_panel_kbtn', 'macros_panel_cam']));
  // slib-m.nc (M-codes) is the default selection; the other panels are hidden until their tree item is picked
  expect(shape.activeTarget, 'slib-m.nc selected by default').toBe('macros_panel_mcode');
  expect(shape.mcodeVis, 'M-codes panel shown by default').toBeTruthy();
  expect(shape.kbtnVis, 'K-buttons panel hidden initially').toBeFalsy();
  expect(shape.camVis, 'CAM panel hidden initially').toBeFalsy();
  expect(shape.hasMcodesList && shape.hasKbtns && shape.hasCamSlots, 'legacy panel IDs preserved').toBeTruthy();

  // click the K-buttons (key-N.nc) tree item → its panel shows
  await page.evaluate(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_kbtn"]').click());
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('macros_panel_kbtn')).display !== 'none')).toBeTruthy();

  // click the CAM (macro_camN.nc) tree item → its panel shows
  await page.evaluate(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]').click());
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('macros_panel_cam')).display !== 'none')).toBeTruthy();
});
