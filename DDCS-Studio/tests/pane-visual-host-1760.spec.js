import { test, expect } from '@playwright/test';
import { registerClassicFixture } from './support/classicFixture.js';

// t1760 — the Blocks tab's "Wizard View" pane (createUserOpView('blk', ...), distinct from the "Open as
// modal" overlay) rendered the FORM but never the 3D/2D VISUALIZATION: onShow/refresh only build the form
// (userOpView.js's render()), the picture comes from a separate view.update(mgr) call the pane never made,
// mgr itself was an inert `{ update(){} }` stub with no preview3D/previewVarSeed, and even once both of
// those were fixed the pane's own CSS (sized for the wide modal) and missing makePanesCollapsible() call
// (which writes --viz-stack-h) left the visual host at ~0 width / ~122px height. This pins all four fixed:
// non-zero, correctly-proportioned canvases in the pane itself, not the modal.

// t2629 — DECOUPLED from `user_corner_data`: this needed "some classic-rendered (form3d+2d) op placed on the
// canvas" as a subject, not corner's own content specifically — but corner is the last classic op left, one
// migration away from a third swap with nowhere left to go. `registerClassicFixture` (tests/support/
// classicFixture.js), the same fix `passes-field-1613.spec.js` (t2625) proved for a different mechanism.
async function setupFixtureInPane(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => !!window.__blkws);
  const opType = await registerClassicFixture(page);
  await page.evaluate(async (opType) => {
    const U = await import('/blocks/userOps.js');
    const def = U.getUserDef(opType);
    window.ddcsLoadBlockStack([{ id: 'x1', type: 'op', opType, label: def.label, params: {}, children: [] }]);
  }, opType);
  let last = -1;
  for (let i = 0; i < 120; i++) {
    const n = await page.evaluate(() => window.__blkws.getAllBlocks().length);
    if (n === last) break;
    last = n;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(600);
}

test('mobile 393px drawer: the pane draws a real 3D scene AND a real 2D host, not empty canvases', async ({ page }) => {
  await setupFixtureInPane(page, { width: 393, height: 800 });
  const handle = page.locator('#blkDrawerHandle');
  if (await handle.count()) { await handle.click(); await page.waitForTimeout(500); }

  const rect = await page.evaluate(() => {
    const v = document.querySelector('#blk_wiz_user .wiz-visual');
    const r = v ? v.getBoundingClientRect() : null;
    return r ? { w: r.width, h: r.height } : null;
  });
  expect(rect).not.toBeNull();
  expect(rect.w).toBeGreaterThan(200);
  expect(rect.h).toBeGreaterThan(200);

  const canvases = await page.evaluate(() => {
    // t1760 — the 3D host holds MULTIPLE canvases (a 0x0 label/minimap layer plus the real render
    // canvas); pick whichever one actually has a non-zero rect rather than assuming the first is it.
    const c = document.getElementById('blk_userViz3dContainer');
    const host = c && c.parentElement && c.parentElement.querySelector('.wiz-viz3d');
    const cv3dRects = host ? Array.from(host.querySelectorAll('canvas')).map(cv => cv.getBoundingClientRect()) : [];
    const best3d = cv3dRects.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a), { width: 0, height: 0 });
    const cv2d = document.querySelector('#blk_userVizContainer canvas, #blk_userVizContainer svg');
    return {
      has3d: cv3dRects.length > 0, w3d: best3d.width, h3d: best3d.height,
      has2d: !!cv2d,
    };
  });
  expect(canvases.has3d).toBe(true);
  expect(canvases.w3d).toBeGreaterThan(50);
  expect(canvases.h3d).toBeGreaterThan(50);
  expect(canvases.has2d).toBe(true);
});

test('desktop width: the pane visual column is not squeezed to zero width', async ({ page }) => {
  await setupFixtureInPane(page, { width: 1400, height: 1000 });

  const rect = await page.evaluate(() => {
    const v = document.querySelector('#blk_wiz_user .wiz-visual');
    const r = v ? v.getBoundingClientRect() : null;
    return r ? { w: r.width, h: r.height } : null;
  });
  expect(rect).not.toBeNull();
  expect(rect.w).toBeGreaterThan(200);

  const w3d = await page.evaluate(() => {
    const c = document.getElementById('blk_userViz3dContainer');
    const host = c && c.parentElement && c.parentElement.querySelector('.wiz-viz3d');
    const rects = host ? Array.from(host.querySelectorAll('canvas')).map(cv => cv.getBoundingClientRect()) : [];
    return rects.reduce((a, b) => Math.max(a, b.width * b.height), 0);
  });
  expect(w3d).toBeGreaterThan(0);
});
