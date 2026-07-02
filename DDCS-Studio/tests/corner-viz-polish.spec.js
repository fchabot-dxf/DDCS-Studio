import { test, expect } from '@playwright/test';

/**
 * VISUAL-LANGUAGE POLISH (t81) — additive clarity on the already-correct drag-handle model (pure rendering; byte-parity
 * untouched): (1) the SIM-ONLY / manual-jog marker is a hollow CIRCLE ○ (was a diamond) in the 2D panel, the 3D sprite, AND
 * the Layout FeatureCanvas; (2) a MANUAL jog TRAVEL line arcs UP ('rainbow'), auto stays straight; (3) the Layout FeatureCanvas
 * handles adopt the top panel's CYAN=auto / AMBER=manual colour code.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

const AUTO = '#22d3ee', MANUAL = '#ffb300';

// (1) 2D — the SIM-ONLY marker is a hollow CIRCLE (a point at 45° on the r≈6.5 ring is painted; a DIAMOND leaves that point
//     empty, since its 45° edge is at r≈4.6). EMITTING stays a FILLED diamond (its centre is painted). Center of the hollow
//     circle is empty. Sampled at the marker's own drawn coords (__t2starts) → view-agnostic.
test('(1) 2D sim-only marker is a hollow CIRCLE; emitting stays a filled diamond', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const px = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const render = (emits) => {
      const canvas = document.createElement('canvas'); canvas.style.width = '240px'; canvas.style.height = '200px';
      document.body.appendChild(canvas);
      const t2 = createToolpath2d(canvas);
      t2.setStock({ x: 100, y: 80, z: 20 }); t2.setStarts([{ x: 50, y: 40, z: 0 }]); t2.setStartSources(['auto']); t2.setStartEmits([emits]);
      t2.fit();
      const rec = canvas.__t2starts && canvas.__t2starts[0]; if (!rec) return { ok: false };
      const dpr = window.devicePixelRatio || 1; const ctx = canvas.getContext('2d');
      const at = (dx, dy) => ctx.getImageData(Math.round((rec.sx + dx) * dpr), Math.round((rec.sy + dy) * dpr), 1, 1).data[3];
      // Sample a full RING at r=6.5: a CIRCLE paints ~all 16 points; a DIAMOND paints only its ~4 vertices (axis points);
      // a shrunk/absent circle paints ~0. So "most of the ring painted" ⇒ a circle.
      let ring = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * 2 * Math.PI; if (at(6.5 * Math.cos(a), -6.5 * Math.sin(a)) > 100) ring++; }
      const out = { ok: true, center: at(0, 0), ring };
      canvas.remove(); return out;
    };
    return { hollow: render(false), filled: render(true) };
  });
  expect(px.hollow.ok && px.filled.ok, 'both painted').toBe(true);
  // SIM-ONLY hollow circle: MOST of the r=6.5 ring is painted (a full circle), and the centre is HOLLOW (not filled).
  expect(px.hollow.ring, `most of the r=6.5 ring is painted → a full CIRCLE (a diamond would paint ~4 vertices); got ${px.hollow.ring}/16`).toBeGreaterThanOrEqual(13);
  expect(px.hollow.center, 'hollow circle centre is not filled').toBeLessThan(100);
  // EMITTING filled diamond: centre painted, clearly above the hollow centre.
  expect(px.filled.center, 'emitting marker centre is FILLED').toBeGreaterThan(px.hollow.center + 80);
});

// (2) 2D — a MANUAL jog travel line arcs UPWARD; AUTO stays straight. Count painted pixels in a BAND ABOVE the chord midpoint:
//     the manual arc passes through it, the straight auto line does not.
test('(2) 2D manual jog travel arcs up (rainbow); auto travel stays straight', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    // How far ABOVE the chord midpoint the topmost painted pixel reaches (scan a band around x=mx, dash-robust: any x hits).
    const topAbove = (source) => {
      const canvas = document.createElement('canvas'); canvas.style.width = '300px'; canvas.style.height = '240px';
      document.body.appendChild(canvas);
      const t2 = createToolpath2d(canvas);
      t2.setStock({ x: 100, y: 80, z: 20 });
      t2.setSegments([{ x1: 20, y1: 20, x2: 80, y2: 60, z1: 0, z2: 0, rapid: true, pass: 0, feed: 0 }]);   // a diagonal trans-axis RAPID
      t2.setStartSources([source]);   // pass-0 source: 'manual' → arc, 'auto' → straight
      t2.fit();
      const v = canvas.__t2view; if (!v) return -1;
      const dpr = window.devicePixelRatio || 1; const ctx = canvas.getContext('2d');
      const mx = v.ox + 50 * v.scale, my = v.oy - 40 * v.scale;   // chord midpoint world (50,40) → screen
      let top = 0;
      for (let dy = 3; dy <= 70; dy++) {
        let hit = false;
        for (let dx = -18; dx <= 18; dx++) { if (ctx.getImageData(Math.round((mx + dx) * dpr), Math.round((my - dy) * dpr), 1, 1).data[3] > 60) { hit = true; break; } }
        if (hit) top = dy;   // keep the topmost (largest dy above the chord) with any painted pixel
      }
      canvas.remove(); return top;
    };
    return { manual: topAbove('manual'), auto: topAbove('auto') };
  });
  // the manual arc bows well UP above the chord; the straight auto line barely rises above it.
  expect(r.manual, `manual arc reaches ${r.manual}px above the chord vs auto ${r.auto}px`).toBeGreaterThan(r.auto + 12);
});

// (3) Layout FeatureCanvas — handles adopt CYAN=auto / AMBER=manual (matching the top panel). Drive layoutSpecFromOp with an
//     explicit per-pass sources array; assert the reposition handle + the sim-only ◇ get the right colour; then confirm the
//     FeatureCanvas RENDERS that colour (the emitting square's fill + the ◇'s stroke).
test('(3) Layout handles adopt the top panel cyan=auto / amber=manual colour code', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form [data-param="cross1_x"]', { state: 'visible' });

  const r = await page.evaluate(async () => {
    const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
    const { cornerDataDef, CORNER_DEFAULTS } = await import('/blocks/dataOps/cornerData.js');
    const { FeatureCanvas } = await import('/viz/featureCanvas.js');
    const def = cornerDataDef();
    const p = { ...CORNER_DEFAULTS };
    // all-manual vs all-auto per-pass sources (index 0..2)
    const repos = (sources) => (layoutSpecFromOp(def, p, null, sources).handles || []).find((h) => h.id === 'reposition_pos');
    const simH = (sources) => (layoutSpecFromOp(def, p, { pos: { x: 10, y: 10 } }, sources).handles || []).find((h) => h.simOnly);
    const manualRepos = repos(['manual', 'manual', 'manual']), autoRepos = repos(['auto', 'auto', 'auto']);
    const manualSim = simH(['manual', 'manual', 'manual']), autoSim = simH(['auto', 'auto', 'auto']);
    // RENDER check: the FeatureCanvas paints the emitting square with the source fill.
    const cont = document.createElement('div'); cont.style.cssText = 'width:300px;height:240px;position:relative'; document.body.appendChild(cont);
    const fc = new FeatureCanvas();
    fc.render(cont, layoutSpecFromOp(def, p, { pos: { x: 12, y: 12 } }, ['manual', 'manual', 'manual']));
    const sq = cont.querySelector('.fc-handle-move'), sim = cont.querySelector('.fc-handle-sim');
    const out = { manualRepos: manualRepos && manualRepos.color, autoRepos: autoRepos && autoRepos.color,
      manualSim: manualSim && manualSim.color, autoSim: autoSim && autoSim.color,
      renderedSquareFill: sq && sq.getAttribute('fill'), renderedSimStroke: sim && sim.getAttribute('stroke') };
    cont.remove(); return out;
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  expect(r.manualRepos, 'a manual reposition handle is AMBER').toBe(MANUAL);
  expect(r.autoRepos, 'an auto reposition handle is CYAN').toBe(AUTO);
  expect(r.manualSim, 'the sim-only ◇ is AMBER when its pass is manual').toBe(MANUAL);
  expect(r.autoSim, 'the sim-only ◇ is CYAN when its pass is auto').toBe(AUTO);
  // the FeatureCanvas actually paints the colour (not the CSS gold default).
  expect(r.renderedSquareFill, 'the emitting square is painted AMBER (manual), not the CSS gold').toBe(MANUAL);
  expect(r.renderedSimStroke, 'the sim ◇ stroke is AMBER (manual)').toBe(MANUAL);
});
