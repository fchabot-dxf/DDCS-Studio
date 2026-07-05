import { test, expect } from '@playwright/test';

/**
 * PROBE-CUE VISIBILITY — the verify-real-symptom guard the earlier "it fires" tests lacked. It reads the ACTUAL rendered
 * pixels (gl.readPixels) during a real probe Simulate and measures the cue's CUE-COLOURED coverage (cyan discs/line +
 * gold datum). The old world-unit cue was a ~0.1%-of-canvas speck when zoomed out for a big WCS offset; the
 * constant-screen cue must reach a MEANINGFUL coverage EVEN at the user's low disc opacity. (Human eyes are the final
 * check; this guards the regression where the cue silently shrinks to nothing again.)
 */
const BASE = process.env.STUDIO_URL || 'http://localhost:3211';
const RUN = '#viz3d-panel-host .pp-run';

test('probe cue reaches meaningful cue-coloured coverage during a real probe (constant-screen, even zoomed out)', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.ioPanel && typeof window.ddcsGetSettings === 'function' && typeof window.setGcodeView === 'function');
  // a LARGE WCS table offset — the exact condition that shrank the old cue to a speck (camera zooms out to frame it)
  await page.evaluate(() => {
    const m = window.ddcsGetSettings().machine;
    m.wcs = { active: 1, table: [{ x: 100, y: 200, z: 500 }] };
    m.workOrigin = { x: 0, y: 0, z: 0 };
  });
  // F600 (mid feed): discs are a usable size + each probe move is ~1.5 s, so all three land inside the poll window
  await page.locator('#editor').fill('G54\nM3 S12000\nG31 Z-15 F600\nG31 X-25 F600\nG31 Y-20 F600\nG0 Z5\nM30');
  await page.evaluate(() => { window.ddcsGetSettings().preview.autoLoop = false; });
  await page.evaluate(() => window.setGcodeView('3d'));
  await page.waitForSelector(RUN, { state: 'attached', timeout: 8000 });
  await page.waitForFunction(() => { const v = window.__gpPanel && window.__gpPanel.viz; return v && v._probeBurstRefFeed; }, { timeout: 8000 });   // t331 — the rogue _probeBurstBasePx was removed; the disc size now reads TOUCH_PULSE.px3D. _probeBurstRefFeed is the equivalent readiness sentinel.

  const sample = () => page.evaluate(() => {
    const v = window.__gpPanel.viz, gl = v.renderer.getContext();
    v.render();
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let cue = 0;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const cyan = g > 55 && b > 70 && b >= r + 15;     // the cyan discs / axis line (above the dark background)
      const gold = r > 140 && g > 110 && b < g - 30;    // the gold datum
      if (cyan || gold) cue++;
    }
    return { total: W * H, cue };
  });

  const before = await sample();
  await page.locator(RUN).click();
  let maxCue = before.cue, total = before.total;
  for (let i = 0; i < 32; i++) {                 // poll ~6.4 s — the feed-timed probes + the lingering discs
    const s = await sample();
    total = s.total;
    if (s.cue > maxCue) maxCue = s.cue;
    await page.waitForTimeout(200);
  }
  const peakPct = (maxCue / total) * 100, basePct = (before.cue / total) * 100, addPct = peakPct - basePct;
  console.log(`PROBE CUE COVERAGE (cue-coloured): baseline ${basePct.toFixed(2)}% → peak ${peakPct.toFixed(2)}% (cue adds ${addPct.toFixed(2)}%)`);

  // The cue must add a MEANINGFUL coloured region at its peak — far above the old ~0.1% speck — even at low disc opacity.
  expect(addPct, 'the probe cue adds a meaningful coloured area (not a speck)').toBeGreaterThan(0.5);
});
