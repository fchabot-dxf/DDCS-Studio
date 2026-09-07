import { test, expect } from '@playwright/test';

/**
 * sim-marker-distinguish (t69) — see tests/node/corner-data-sim-marker-emits.test.mjs for the pure (A)/(D)/(E)
 * siblings and this file's own header there. The tests below all render into a real DOM/canvas or drive the real
 * wizard, so they stay in the browser tier.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

// (B) END-TO-END — the flag threads opSimStarts → computePassStarts → the shared passStarts that BOTH the 2D and 3D
//     renderers read, in the REAL wizard preview. First pass always sim-only; the last (wall-2) always emits; the 3D viz
//     receives the same shape array. (State-agnostic invariants so this holds whatever the default probeZFirst is.)
test('(B) end-to-end: the emits flag reaches the shared passStarts + the 3D renderer in the live wizard preview', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form [data-param]', { state: 'visible' });

  const r = await page.evaluate(() => {
    const c = document.getElementById('userViz3dContainer_tree');
    const host = c && c.parentElement && c.parentElement.querySelector('.wiz-viz3d');
    const panel = host && host.__panel;
    if (!panel || typeof panel.getPassStarts !== 'function') return { wired: false };
    const passEmits = (panel.getPassStarts() || []).map((s) => !!s.emits);
    const vizEmits = panel.viz && Array.isArray(panel.viz._startEmits) ? panel.viz._startEmits.slice() : null;
    return { wired: true, passEmits, vizEmits };
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  expect(r.wired, 'the wizard preview exposes getPassStarts + viz').toBe(true);
  expect(r.passEmits.length, 'sanity: the multi-pass corner has ≥2 start markers').toBeGreaterThanOrEqual(2);
  expect(r.passEmits[0], 'the FIRST pass-start is the operator jog — always sim-only').toBe(false);
  expect(r.passEmits[r.passEmits.length - 1], 'the LAST pass-start (wall-2 reposition #23/#24) always emits').toBe(true);
  expect(r.vizEmits, 'the 3D renderer received the SAME per-pass shape array (setStartEmits wired)').toEqual(r.passEmits);
});

// (C) THE REAL 2D VISUAL SYMPTOM — an EMITTING marker paints a FILLED centre; a SIM-ONLY marker's centre is HOLLOW. Same
//     colour (cyan, auto) both — the SHAPE is the new axis. Rendered on a real (sized) canvas; sampled at the marker's own
//     drawn coords (__t2starts), so it's view-agnostic and deterministic (static paint, no animation).
test('(C) 2D visual: the marker COLOUR follows the SOURCE (decoupled from emits) — a later pass flips cyan↔amber by travel', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const px = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    // render pass-1 (a reposition) with emits held TRUE; vary only the SOURCE → the colour must follow the source.
    const render = (src1) => {
      const canvas = document.createElement('canvas'); canvas.style.width = '240px'; canvas.style.height = '200px';
      document.body.appendChild(canvas);
      const t2 = createToolpath2d(canvas);
      t2.setStock({ x: 100, y: 80, z: 20 });
      t2.setStarts([{ x: 30, y: 40, z: 0 }, { x: 70, y: 40, z: 0 }]);
      t2.setStartSources(['auto', src1]); t2.setStartEmits([false, true]);   // emits HELD true on pass 1; only the source varies
      t2.fit();
      const rec = canvas.__t2starts; if (!rec || rec.length < 2) return { ok: false };
      const dpr = window.devicePixelRatio || 1; const ctx = canvas.getContext('2d');
      const d = ctx.getImageData(Math.round(rec[1].sx * dpr), Math.round(rec[1].sy * dpr), 1, 1).data;
      canvas.remove(); return { ok: true, r: d[0], g: d[1], b: d[2] };
    };
    return { auto: render('auto'), manual: render('manual') };
  });
  expect(px.auto.ok && px.manual.ok, 'both painted').toBe(true);
  // emits was TRUE in both renders → the colour is driven by SOURCE, not emits: auto = cyan (blue), manual = amber (red+green)
  expect(px.auto.b, 'auto source → cyan (blue high)').toBeGreaterThan(150);
  expect(px.auto.b, 'cyan: blue > red').toBeGreaterThan(px.auto.r);
  expect(px.manual.r > px.manual.b && px.manual.g > px.manual.b, 'manual source → amber (despite emits=true)').toBe(true);
});

// (C2) t1684 (census finding 2) — the docstring above this file has promised "FILLED vs HOLLOW" since t69, but until now
//     nothing ever sampled the CENTRE ALPHA to prove it: drawStartHandles never read startEmits at all (a second instance
//     of the SAME declared-but-unread defect the census exists to end, this time in a TEST's own unchecked claim). Same
//     colour (auto/cyan) both passes — only emits varies: pass-1 centre alpha must actually differ hollow vs filled.
test('(C2) 2D visual: a LATER pass emits:false paints a HOLLOW centre; emits:true paints FILLED — same colour, shape is the axis', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const px = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const render = (emits1) => {
      const canvas = document.createElement('canvas'); canvas.style.width = '240px'; canvas.style.height = '200px';
      document.body.appendChild(canvas);
      const t2 = createToolpath2d(canvas);
      t2.setStock({ x: 100, y: 80, z: 20 });
      t2.setStarts([{ x: 30, y: 40, z: 0 }, { x: 70, y: 40, z: 0 }]);
      t2.setStartSources(['auto', 'auto']); t2.setStartEmits([false, emits1]);   // colour held constant (both auto/cyan); only pass-1's emits varies
      t2.fit();
      const rec = canvas.__t2starts; if (!rec || rec.length < 2) return { ok: false };
      const dpr = window.devicePixelRatio || 1; const ctx = canvas.getContext('2d');
      const d = ctx.getImageData(Math.round(rec[1].sx * dpr), Math.round(rec[1].sy * dpr), 1, 1).data;
      canvas.remove(); return { ok: true, a: d[3] };
    };
    return { filled: render(true), hollow: render(false) };
  });
  expect(px.filled.ok && px.hollow.ok, 'both painted').toBe(true);
  expect(px.filled.a, 'emits:true pass-1 centre is FILLED (opaque)').toBeGreaterThan(150);
  expect(px.hollow.a, 'emits:false pass-1 centre is HOLLOW (the stroke-only ring leaves the centre transparent)').toBeLessThan(150);
});

// (F) t1688 THE GLYPH RESOLVER — CROSS-PANE AGREEMENT: the lead pass (pass 0 — always sim-only, opSimStarts' own
//     makeProvider forces `emits:false` there structurally) must render HOLLOW in the LAYOUT pane too, matching the
//     3D pane (test B above already proves vizEmits[0] === false). Before t1688 this was the reported symptom: the
//     Layout pane's synthetic Start handle never received `emits` at all (panelTypes.js:574 → userOpView.js's
//     `simStart`), so it always rendered FILLED regardless of the true value, disagreeing with the 3D pane.
test('(F) cross-pane agreement: the lead pass renders HOLLOW in the Layout pane, matching the 3D (no live-emits disagreement)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form [data-param]', { state: 'visible' });
  await page.evaluate(() => { const t = document.querySelector('[data-tab="layout"], [data-viz-mode="2d"], .viz-tab-2d'); if (t) t.click(); });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const svg = document.querySelector('#userVizContainer_tree svg, .wiz-layout svg');
    const el = svg && svg.querySelector('[data-hid="__simstart0"]');
    return el ? { found: true, fill: getComputedStyle(el).fill, tag: el.tagName.toLowerCase() } : { found: false };
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
  expect(r.found, 'the Layout renders the lead-pass Start handle (__simstart0)').toBe(true);
  expect(r.tag, 'the lead pass is always the operator jog → a circle').toBe('circle');
  expect(r.fill, 'the lead pass never emits (opSimStarts forces emits:false at pass 0) → HOLLOW: fill is none/transparent').toMatch(/^(none|transparent|rgba\(0, 0, 0, 0\))$/);
});
