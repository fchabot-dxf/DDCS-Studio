import { test, expect } from '@playwright/test';

// LAST middle refinement: each start marker is coloured by its reposition SOURCE — an AUTO-traverse start = CYAN
// (kept), a MANUAL-jog start = AMBER. The trace tags each pass from its REPOSITION message ('auto-traverse…'→auto /
// 'jog clear…'→manual); the 2D + 3D start markers colour per-pass. (Perceptibility = human eyes.)
test.use({ viewport: { width: 1280, height: 900 } });

test('trace tags each pass source from its REPOSITION (auto-traverse vs operator jog)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const w = new MiddleWizard();
    const base = { featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg', stockX: 100, stockY: 80, stockZ: 20 };
    const st = { stock: { x: 100, y: 80, z: 20, shape: 'boss' } };
    return {
      auto: traceToolpath(w.generate({ ...base, inAxis: 'auto', transAxis: 'auto' }), st).stats.passSources,
      manual: traceToolpath(w.generate({ ...base, inAxis: 'manual', transAxis: 'manual' }), st).stats.passSources,
      mixed: traceToolpath(w.generate({ ...base, inAxis: 'auto', transAxis: 'manual' }), st).stats.passSources,
    };
  });
  expect(r.auto, 'auto-both: pass0 + the auto trans-traverse').toEqual(['auto', 'auto']);
  expect(r.manual, 'manual-both: pass0 + 3 operator jogs').toEqual(['auto', 'manual', 'manual', 'manual']);
  expect(r.mixed, 'in-axis auto + trans manual: pass0 + the manual trans').toEqual(['auto', 'manual']);
});

test('3D start markers colour by source (auto=cyan 0x22d3ee, manual=amber 0xffb300)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz._passCount = 2; viz._ensureMarkers(); viz._highlightSelectedStart();
    viz.setStartSources(['auto', 'manual']);
    return { c0: viz.spindleMarkers[0].children[0].material.color.getHex(), c1: viz.spindleMarkers[1].children[0].material.color.getHex() };
  });
  expect(r.c0, 'pass 0 (auto) = cyan').toBe(0x22d3ee);
  expect(r.c1, 'pass 1 (manual) = amber').toBe(0xffb300);
});

test('2D start markers carry the per-pass source (auto / manual)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:400px;z-index:99999';
    document.body.appendChild(cv);
    const t2 = createToolpath2d(cv, {});
    t2.setMachine(null); t2.setAnchor(true);
    t2.setStarts([{ x: -30, y: 0, z: 0 }, { x: 30, y: 0, z: 0 }]);
    t2.setStartSources(['auto', 'manual']);
    t2.setSegments([]); t2.fit();
    const m = (cv.__t2starts || []).map((s) => s.source);
    cv.remove();
    return m;
  });
  expect(r, '2D markers carry their source → drawStartHandles colours cyan/amber').toEqual(['auto', 'manual']);
});
