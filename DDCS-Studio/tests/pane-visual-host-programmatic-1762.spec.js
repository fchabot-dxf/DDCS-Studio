import { test, expect } from '@playwright/test';

// t1762 — t1760's own pane-visual-host-1760.spec.js proved the visual host via a SYNTHETIC
// ddcsLoadBlockStack([{type:'op',opType,params:{}}]) call, not the shape a real gesture actually produces.
// This act closed THAT gap: `insertWiz()` (bar -> Insert -> Blocks) does NOT place a plain {type:'op'}
// block — `commitActiveOp()` EXPANDS it into a full "Define Custom Wizard" block tree (a round-trip toast
// confirms it: "This op is now an editable block stack"), which makes `deriveLiveWizard()` take the
// AUTHORED-HERE branch (a `user_root` at the top of the stack), not the placedOpFallback/registry-overlay
// branch t1760's test exercised. Both branches converge on the same hasTree rendering code; these two tests
// prove that convergence by driving the SAME PROGRAM SHAPE each route actually produces.
//
// ⚠ RENAMED at t1776 (was pane-visual-host-real-gesture-1762.spec.js) — despite the old name, this file
// calls window.openWiz/insertWiz/showApp/ddcsEditWizardDef DIRECTLY (page.evaluate), never a real click or
// fill. That is a legitimate, narrower check (the render pipeline given the correct program SHAPE) but it
// is NOT a real-gesture test — the advisor cited it to the user as covering the primary click-through route
// and it does not; see tests/primary-route-real-gesture-1776.spec.js for the one that actually drives the
// bar entry, the form fill, the INSERT button, and the Blocks tab via real Playwright clicks.

test('placed-op route (openWiz -> insertWiz -> showApp) draws the real 3D scene + 2D path at 393px', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 800 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.showApp && window.openWiz && window.insertWiz);
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.insertWiz());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => !!window.__blkws);
  await page.waitForTimeout(600);
  const handle = page.locator('#blkDrawerHandle');
  if (await handle.count()) { await handle.click(); await page.waitForTimeout(500); }

  const info = await page.evaluate(() => {
    const fields = document.querySelectorAll('#blk_wiz_user_form [data-param]').length;
    const v = document.querySelector('#blk_wiz_user .wiz-visual');
    const r = v ? v.getBoundingClientRect() : null;
    const c = document.getElementById('blk_userViz3dContainer');
    const host = c && c.parentElement && c.parentElement.querySelector('.wiz-viz3d');
    const rects = host ? Array.from(host.querySelectorAll('canvas')).map((cv) => cv.getBoundingClientRect()) : [];
    const best3d = rects.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a), { width: 0, height: 0 });
    const cv2d = document.querySelector('#blk_userVizContainer canvas, #blk_userVizContainer svg');
    return { fields, visExists: !!v, w: r ? r.width : 0, h: r ? r.height : 0, w3d: best3d.width, h3d: best3d.height, has2d: !!cv2d };
  });
  expect(info.fields).toBeGreaterThan(0);
  expect(info.visExists).toBe(true);
  expect(info.w).toBeGreaterThan(200);
  expect(info.h).toBeGreaterThan(200);
  expect(info.w3d).toBeGreaterThan(50);
  expect(info.h3d).toBeGreaterThan(50);
  expect(info.has2d).toBe(true);
});

test('authoring/Customize route (ddcsEditWizardDef -> showApp) draws the real 3D scene + 2D path at 393px', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 800 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.showApp && window.ddcsEditWizardDef);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => !!window.__blkws);
  await page.evaluate(async () => { await window.ddcsEditWizardDef('user_corner_data'); });
  await page.waitForTimeout(800);
  const handle = page.locator('#blkDrawerHandle');
  if (await handle.count()) { await handle.click(); await page.waitForTimeout(500); }

  const info = await page.evaluate(() => {
    const fields = document.querySelectorAll('#blk_wiz_user_form [data-param]').length;
    const v = document.querySelector('#blk_wiz_user .wiz-visual');
    const r = v ? v.getBoundingClientRect() : null;
    const c = document.getElementById('blk_userViz3dContainer');
    const host = c && c.parentElement && c.parentElement.querySelector('.wiz-viz3d');
    const rects = host ? Array.from(host.querySelectorAll('canvas')).map((cv) => cv.getBoundingClientRect()) : [];
    const best3d = rects.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a), { width: 0, height: 0 });
    const cv2d = document.querySelector('#blk_userVizContainer canvas, #blk_userVizContainer svg');
    return { fields, visExists: !!v, w: r ? r.width : 0, h: r ? r.height : 0, w3d: best3d.width, h3d: best3d.height, has2d: !!cv2d };
  });
  expect(info.fields).toBeGreaterThan(0);
  expect(info.visExists).toBe(true);
  expect(info.w).toBeGreaterThan(200);
  expect(info.h).toBeGreaterThan(200);
  expect(info.w3d).toBeGreaterThan(50);
  expect(info.h3d).toBeGreaterThan(50);
  expect(info.has2d).toBe(true);
});
