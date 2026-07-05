import { test, expect } from '@playwright/test';

/**
 * VIZ ONE-SOURCE PALETTE (t317) — viz/pathStyle.js is the single declared source of the path-visual palette (TYPE
 * color/dash/widthScale/shape × STATE alpha/width). The 2D renderer (toolpath2d.segColor), the legend
 * (createPreviewPanel LEGEND_ROWS), the 3D (gcodeViz3d line-groups, which use the int directly), and the legacy CSS
 * (via --viz-path-* vars) all READ it — so a TYPE value is IDENTICAL across consumers (the 4 copies collapse to 1).
 * Byte-neutral at the current values + the 2 agreed micro-fixes: jog = one amber #ff9a0d; the Cut chip = #35ffd0.
 */
test('the path palette is ONE source — 2D + legend + CSS resolve a TYPE to the same value; micro-fixes applied', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const P = await import('/viz/pathStyle.js');
    const T2 = await import('/viz/toolpath2d.js');
    const mut = (() => { const o = P.PATH_TYPES.rapid.color; P.PATH_TYPES.rapid.color = 0x123456; const s = T2.segColor({ type: 'rapid' }, 0, 1, 100); P.PATH_TYPES.rapid.color = o; return s; })();
    return {
      vals: { rapid: P.PATH_TYPES.rapid.color, retract: P.PATH_TYPES.retract.color, probeFast: P.PATH_TYPES.probeFast.color, probeSlow: P.PATH_TYPES.probeSlow.color, jog: P.PATH_TYPES.jog.color, feed: P.PATH_TYPES.feed.color, feedLow: P.FEED_LOW, feedHigh: P.FEED_HIGH },
      state: { futureAlpha: P.PATH_STATE.future.alpha, traveledWidth: P.PATH_STATE.traveled.width, staticWidth: P.PATH_STATE.static.width },
      hexRapid: P.hexCss(P.PATH_TYPES.rapid.color),
      seg2dRapid: T2.segColor({ type: 'rapid' }, 0, 1, 100),
      seg2dRetract: T2.segColor({ type: 'retract' }, 0, 1, 100),
      seg2dProbeSlow: T2.segColor({ type: 'probe', feed: 10 }, 0, 1, 100),
      seg2dProbeFast: T2.segColor({ type: 'probe', feed: 100 }, 0, 1, 100),
      legendRapid: P.LEGEND_ROWS.find((x) => x.key === 'rapid').color,
      legendFeed: P.LEGEND_ROWS.find((x) => x.key === 'feed').color,
      legendJog: P.LEGEND_ROWS.find((x) => x.key === 'jog').color,
      cssRapid: getComputedStyle(document.documentElement).getPropertyValue('--viz-path-rapid').trim(),
      cssJog: getComputedStyle(document.documentElement).getPropertyValue('--viz-path-jog').trim(),
      mut,
    };
  });

  // (1) the palette values (probeSlow is WHITE as of t319 INC-5; the rest byte-neutral)
  expect(r.vals).toMatchObject({ rapid: 0xffcc00, retract: 0x33cc55, probeFast: 0x3b82f6, probeSlow: 0xffffff, feed: 0x35ffd0, feedLow: 0x0a4fd0, feedHigh: 0x35ffd0 });
  expect(r.state.futureAlpha).toBe(0.8);
  expect(r.state.traveledWidth).toBeCloseTo(3.12);
  expect(r.state.staticWidth).toBe(2);

  // (2) ONE SOURCE — the 2D renderer, the legend, and the 3D int all resolve a TYPE to the SAME value
  expect(r.hexRapid).toBe('#ffcc00');
  expect(r.seg2dRapid, '2D segColor(rapid) == the module').toBe(r.hexRapid);
  expect(r.legendRapid, 'legend rapid == the module').toBe(r.hexRapid);
  expect(r.cssRapid, 'the CSS var reads the module (applyPathVars on load)').toBe(r.hexRapid);
  expect(r.seg2dRetract).toBe('#33cc55');
  expect(r.seg2dProbeSlow).toBe('#ffffff');    // feed<maxPF → slow = WHITE (t319)
  expect(r.seg2dProbeFast).toBe('#3b82f6');    // feed==maxPF → fast stays blue

  // (3) THE 2 AGREED MICRO-FIXES
  expect(r.vals.jog, 'jog = the ONE amber #ff9a0d (was the 2D #ffb300 start-marker amber)').toBe(0xff9a0d);
  expect(r.legendJog).toBe('#ff9a0d');
  expect(r.cssJog).toBe('#ff9a0d');
  expect(r.legendFeed, 'the legend Cut chip = the real gradient-high #35ffd0 (was the transposed #35d0ff)').toBe('#35ffd0');

  // (4) LIVE one-source — the 2D segColor reflects a runtime edit to the module (a value mod lands once, hits the renderer)
  expect(r.mut, 'mutating PATH_TYPES.rapid.color changes the 2D segColor → it reads the LIVE module, not a copy').toBe('#123456');
});

test('INC-5 draw-order: the WHITE slow probe renders ON TOP of the fast blue at a collinear overlap (2D + 3D)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const cv = document.createElement('canvas');
    cv.style.cssText = 'width:240px;height:240px;position:absolute;left:0;top:0'; document.body.appendChild(cv);
    const tp = createToolpath2d(cv, {});
    // a FAST probe and a SLOW probe on the SAME horizontal line → collinear overlap; maxProbeFeed = 500 (the fast)
    tp.setSegments([
      { x1: 10, y1: 20, x2: 90, y2: 20, z1: 0, z2: 0, type: 'probe', probe: true, feed: 500 },   // fast (feed == maxPF) → blue
      { x1: 10, y1: 20, x2: 90, y2: 20, z1: 0, z2: 0, type: 'probe', probe: true, feed: 50 },     // slow (feed < maxPF) → WHITE, drawn LAST
    ]);
    tp.redraw();
    await new Promise((res) => requestAnimationFrame(res));
    const dpr = window.devicePixelRatio || 1;
    const ctx = cv.getContext('2d');
    const img = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let white = 0, blue = 0;
    for (let i = 0; i < img.length; i += 4) {
      const R = img[i], G = img[i + 1], B = img[i + 2], A = img[i + 3];
      if (A < 40) continue;
      if (R > 230 && G > 230 && B > 230) white++;               // the slow probe (WHITE) on top
      else if (B > 170 && R < 120 && G > 90 && G < 175) blue++;  // the fast probe (#3b82f6) blue
    }
    cv.remove();
    return { white, blue, dpr };
  });
  expect(r.white, `the WHITE slow probe rendered (${r.white} px)`).toBeGreaterThan(0);
  expect(r.white, `white (slow, on top: ${r.white}px) dominates blue (fast, covered: ${r.blue}px) — the slow probe drew LAST`).toBeGreaterThan(r.blue);
});
