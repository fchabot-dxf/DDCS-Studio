import { test, expect } from '@playwright/test';

/**
 * VIZ ONE-SOURCE PALETTE (t317) — viz/pathStyle.js is the single declared source of the path-visual palette (TYPE
 * color/dash/widthScale/shape × STATE alpha/width). The 2D renderer (toolpath2d.segColor), the legend
 * (createPreviewPanel LEGEND_ROWS), the 3D (gcodeViz3d line-groups, which use the int directly), and the legacy CSS
 * (via --viz-path-* vars) all READ it — so a TYPE value is IDENTICAL across consumers (the 4 copies collapse to 1).
 * t331 legend rescheme (human t330): rapid solid-yellow · jog orange-red #ff4500 · probeFast cyan #22d3ee · probeSlow white ·
 * feed/cut FLAT blue #3b82f6 (the Z-depth gradient removed — ramps absorbed into feed) · retract green. All ONE-SOURCE.
 */
test('the path palette is ONE source — 2D + legend + CSS resolve a TYPE to the same value; micro-fixes applied', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const P = await import('/viz/pathStyle.js');
    const T2 = await import('/viz/toolpath2d.js');
    const mut = (() => { const o = P.PATH_TYPES.rapid.color; P.PATH_TYPES.rapid.color = 0x123456; const s = T2.segColor({ type: 'rapid' }, 0, 1, 100); P.PATH_TYPES.rapid.color = o; return s; })();
    return {
      vals: { rapid: P.PATH_TYPES.rapid.color, retract: P.PATH_TYPES.retract.color, probeFast: P.PATH_TYPES.probeFast.color, probeSlow: P.PATH_TYPES.probeSlow.color, jog: P.PATH_TYPES.jog.color, feed: P.PATH_TYPES.feed.color },
      rapidDash: P.PATH_TYPES.rapid.dash, jogDash: P.PATH_TYPES.jog.dash, feedGone: (typeof P.FEED_LOW === 'undefined' && typeof P.feedRgb === 'undefined'),
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

  // (1) the palette values (t331 rescheme: probeFast cyan, feed flat blue; the depth gradient is GONE)
  expect(r.vals).toMatchObject({ rapid: 0xffcc00, retract: 0x33cc55, probeFast: 0x22d3ee, probeSlow: 0xffffff, feed: 0x3b82f6 });
  expect(r.rapidDash, 't331 — rapid is SOLID (dash [])').toEqual([]);
  expect(r.jogDash, 't331 — jog stays DASHED').toEqual([5, 4]);
  expect(r.feedGone, 't331 — the FEED_LOW/FEED_HIGH/feedRgb depth-gradient exports were removed').toBe(true);
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
  expect(r.seg2dProbeFast).toBe('#22d3ee');    // t331 — feed==maxPF → fast probe = CYAN

  // (3) THE t331 LEGEND RESCHEME COLOURS (jog + feed follow the ONE source through the value, legend, and CSS var)
  expect(r.vals.jog, 'jog = orange-red #ff4500 (t331 human t330 — stepped off the rapid-yellow AND the red probe-tip)').toBe(0xff4500);
  expect(r.legendJog).toBe('#ff4500');
  expect(r.cssJog).toBe('#ff4500');   // t331 — the CSS var --viz-path-jog resolves the SAME one-source orange-red
  expect(r.legendFeed, 't331 — the legend Cut chip = the flat blue #3b82f6 (the gradient was removed)').toBe('#3b82f6');

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
    let white = 0, cyan = 0;
    for (let i = 0; i < img.length; i += 4) {
      const R = img[i], G = img[i + 1], B = img[i + 2], A = img[i + 3];
      if (A < 40) continue;
      if (R > 230 && G > 230 && B > 230) white++;               // the slow probe (WHITE) on top
      else if (R < 120 && G > 170 && B > 180) cyan++;           // t331 — the fast probe (#22d3ee) CYAN (low R, high G+B)
    }
    cv.remove();
    return { white, cyan, dpr };
  });
  expect(r.white, `the WHITE slow probe rendered (${r.white} px)`).toBeGreaterThan(0);
  expect(r.white, `white (slow, on top: ${r.white}px) dominates cyan (fast, covered: ${r.cyan}px) — the slow probe drew LAST`).toBeGreaterThan(r.cyan);
});

/**
 * t1203 (b) — SAFE-HEIGHT TRAVERSE = THE RAPID HUE. A dogleg/diagonal trans-axis traverse IS a rapid, and the 3D has
 * always painted rapids yellow (PATH_TYPES.rapid) — but the 2D reclassified any horizontal rapid to a grey `lifted`,
 * so the SAME move read yellow in 3D and grey in 2D. That divergence was the defect (the user: the traverse moves must
 * render yellow, matching the 3D convention). `lifted` now shares the rapid COLOUR and keeps its DASH, so the two views
 * agree by construction while "moving over" is still visually distinct from a solid positioning rapid.
 * Non-circular: the traverse segments come from a REAL emitted middle-boss program, traced by the engine.
 */
test('a real dogleg + diagonal traverse renders the RAPID hue in 2D (matching 3D), while cuts stay blue', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const { segColor } = await import('/viz/toolpath2d.js');
    const P = await import('/viz/pathStyle.js');
    const stock = { x: 100, y: 80, z: 20 };
    const out = { rapidHex: P.hexCss(P.PATH_TYPES.rapid.color), liftedDash: P.PATH_TYPES.lifted.dash, rapidDash: P.PATH_TYPES.rapid.dash };
    for (const shape of ['dogleg', 'diagonal']) {
      const g = emitMapped(middleStack({ featureType: 'boss', twoAxis: true, inAxis: 'auto', transAxis: 'auto', axis: 'X', dir1: 'pos', dir2: 'neg', travelShape: shape })).text;
      const segs = (traceToolpath(g, { stock, g53ApproxZ: 5 }).segments) || [];
      const trav = segs.filter((s) => s.type === 'rapid' && Math.abs((s.z1 || 0) - (s.z2 || 0)) < 1e-6 && (Math.abs(s.x1 - s.x2) > 0.02 || Math.abs(s.y1 - s.y2) > 0.02));
      out[shape] = { n: trav.length, colors: [...new Set(trav.map((s) => segColor(s, -10, 20, 400)))] };
    }
    const ctl = (traceToolpath('G90\nG1 X10 Y10 F300\nG0 Z5\n', { stock, g53ApproxZ: 5 }).segments) || [];
    out.control = ctl.map((s) => ({ t: s.type, c: segColor(s, -10, 20, 400) }));
    return out;
  });
  for (const shape of ['dogleg', 'diagonal']) {
    expect(r[shape].n, `${shape}: the emitted program really contains horizontal traverse moves`).toBeGreaterThan(0);
    expect(r[shape].colors, `${shape}: EVERY traverse segment renders the rapid hue (2D == 3D)`).toEqual([r.rapidHex]);
  }
  expect(r.liftedDash.length, 'the traverse stays DASHED — "moving over" is carried by the dash, not a second colour').toBeGreaterThan(0);
  expect(r.rapidDash, 'a positioning rapid stays SOLID, so the two remain distinguishable').toEqual([]);
  const feed = r.control.find((s) => s.t === 'feed');
  expect(feed && feed.c, 'no over-reach: a CUT is still blue').toBe('#3b82f6');
});
