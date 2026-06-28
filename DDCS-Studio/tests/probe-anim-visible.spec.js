import { test, expect } from '@playwright/test';

/**
 * PROBE ANIMATION VISIBILITY — the verify-real-symptom guard the earlier "it fires" tests lacked. It reads the ACTUAL
 * rendered pixels (gl.readPixels) during a real probe Simulate and measures the cue's bright-pixel COVERAGE. The old
 * world-unit cue was a ~0.1%-of-canvas speck when zoomed out for a big WCS offset; the constant-screen-size + high-
 * contrast + sustained rebuild must reach a MEANINGFUL coverage. (Human eyes remain the final check; this guards the
 * regression where the cue silently shrinks to nothing again.)
 */
const BASE = process.env.STUDIO_URL || 'http://localhost:3211';
const RUN = '#viz3d-panel-host .pp-run';

test('probe cue reaches meaningful on-screen coverage during a real probe (constant-screen, even zoomed out)', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.ioPanel && typeof window.ddcsGetSettings === 'function' && typeof window.setGcodeView === 'function');
  // a LARGE WCS table offset — the exact condition that shrank the old cue to a speck (camera zooms out to frame it)
  await page.evaluate(() => {
    const m = window.ddcsGetSettings().machine;
    m.wcs = { active: 1, table: [{ x: 100, y: 200, z: 500 }] };
    m.workOrigin = { x: 0, y: 0, z: 0 };
  });
  await page.locator('#editor').fill('G54\nM3 S12000\nG31 Z-15 F3000\nG31 X-25 F3000\nG31 Y-20 F3000\nG0 Z5\nM30');
  await page.evaluate(() => { window.ddcsGetSettings().preview.autoLoop = false; });
  await page.evaluate(() => window.setGcodeView('3d'));
  await page.waitForSelector(RUN, { state: 'attached', timeout: 8000 });
  await page.waitForFunction(() => { const v = window.__gpPanel && window.__gpPanel.viz; return v && v._probeGlowPx; }, { timeout: 8000 });

  const sample = () => page.evaluate(() => {
    const v = window.__gpPanel.viz, gl = v.renderer.getContext();
    v.render();
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let bright = 0; for (let i = 0; i < px.length; i += 4) { if (px[i] + px[i + 1] + px[i + 2] > 450) bright++; }
    return { total: W * H, bright };
  });

  const before = await sample();
  await page.locator(RUN).click();
  let maxBright = 0, total = before.total;
  for (let i = 0; i < 28; i++) {                 // poll ~5.6s — catches probe contacts + the 2.5s sustained glows
    const s = await sample();
    total = s.total;
    if (s.bright > maxBright) maxBright = s.bright;
    await page.waitForTimeout(200);
  }
  const peakPct = (maxBright / total) * 100, basePct = (before.bright / total) * 100;
  console.log(`PROBE CUE COVERAGE: baseline ${basePct.toFixed(2)}% → peak ${peakPct.toFixed(2)}% of canvas`);

  // The cue must light up a MEANINGFUL fraction of the canvas at its peak — far above the old ~0.1% speck.
  expect(peakPct, 'probe cue peak coverage is a meaningful % of the canvas (not a speck)').toBeGreaterThan(1.0);
  expect(maxBright - before.bright, 'the probe event adds substantial bright pixels').toBeGreaterThan(total * 0.008);
});
