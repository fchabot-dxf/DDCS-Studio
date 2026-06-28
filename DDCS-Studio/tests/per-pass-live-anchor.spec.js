import { test, expect } from '@playwright/test';

// INC4: the LIVE tool (the moving dot) anchors to the start of its CURRENT REPOSITION pass — not always pass-0/①. The
// engine reports `pass` with onPositionChange; the 3D setToolPosition + the 2D head ride starts[pass]. So a boss-both
// 2nd-axis probe (pass 1) sits at ② (not back at ① ≈ Y-centre, which looked like a pocket). Single-pass / no pass → ①.
test.use({ viewport: { width: 1280, height: 900 } });

test('2D head anchors to its pass start (pass 0 → ①, pass 1 → ②)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:400px;z-index:99999';
    document.body.appendChild(cv);
    const t2 = createToolpath2d(cv, {});
    t2.setMachine(null); t2.setAnchor(true);
    t2.setStarts([{ x: -12, y: 40, z: 0 }, { x: 50, y: 92, z: 0 }]);   // ① and ②
    t2.setSegments([{ x1: 0, y1: 0, x2: 5, y2: 0, z1: 0, z2: 0, type: 'probe', pass: 1 }]);
    t2.seek(1);   // playing → setToolPosition paints
    t2.setToolPosition({ x: 0, y: 0, pass: 0 }); const h0 = cv.__t2head;
    t2.setToolPosition({ x: 0, y: 0, pass: 1 }); const h1 = cv.__t2head;
    const v = cv.__t2view;
    cv.remove();
    return { h0, h1, at1: { sx: v.ox + (-12) * v.scale, sy: v.oy - 40 * v.scale }, at2: { sx: v.ox + 50 * v.scale, sy: v.oy - 92 * v.scale } };
  });
  // local (0,0) + the pass start → pass 0 lands on ①, pass 1 lands on ②
  expect(Math.abs(r.h0.sx - r.at1.sx), 'pass-0 head at ①').toBeLessThan(1);
  expect(Math.abs(r.h1.sx - r.at2.sx), 'pass-1 head at ②').toBeLessThan(1);
  expect(Math.abs(r.h1.sy - r.at2.sy), 'pass-1 head Y at ②').toBeLessThan(1);
  expect(Math.abs(r.h1.sx - r.h0.sx), 'pass 1 ≠ pass 0 (it moved to ②)').toBeGreaterThan(5);
});

test('3D tool anchors to its pass start (single-pass/no-pass unchanged → ①)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz._anchorToStart = true;
    viz.starts = [{ x: -12, y: 40, z: 0 }, { x: 50, y: 92, z: 0 }];
    viz.setToolPosition({ x: 0, y: 0, z: 0, pass: 0 }); const p0 = { x: viz._animTool.position.x, y: viz._animTool.position.y };
    viz.setToolPosition({ x: 0, y: 0, z: 0, pass: 1 }); const p1 = { x: viz._animTool.position.x, y: viz._animTool.position.y };
    viz.setToolPosition({ x: 0, y: 0, z: 0 }); const pNone = { x: viz._animTool.position.x, y: viz._animTool.position.y };   // no pass → ①
    return { p0, p1, pNone };
  });
  expect(r.p0).toMatchObject({ x: -12, y: 40 });       // pass 0 → ①
  expect(r.p1).toMatchObject({ x: 50, y: 92 });        // pass 1 → ②
  expect(r.pNone).toMatchObject({ x: -12, y: 40 });    // no pass → ① (single-pass unchanged)
});
