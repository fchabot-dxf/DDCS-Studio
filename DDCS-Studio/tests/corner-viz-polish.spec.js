import { test, expect } from '@playwright/test';

/**
 * VISUAL-LANGUAGE (t81 → t293) — ONE start-marker glyph language across the 2D toolpath, the 3D sprite, and the Layout
 * FeatureCanvas: (1) AUTO reposition (machine drives there) = a filled CYAN SQUARE ■; MANUAL jog / the operator Start =
 * a filled AMBER CIRCLE ●; (2) a MANUAL jog TRAVEL line arcs UP ('rainbow'), auto stays straight; (3) the Layout
 * FeatureCanvas renders the same square/circle + cyan/amber, and the Start is always the amber circle.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

const AUTO = '#22d3ee', MANUAL = '#ffb300';

// (1) 2D — t1688: the pass-0 Start is now a HOLLOW amber marker (it never emits — opSimStarts forces emits:false at
//     the lead pass structurally, and toolpath2d.js no longer discards that with its own `i > 0` override); a later
//     AUTO reposition (emits:true, declared) is a filled CYAN marker. The Start's colour is read off its RING (the
//     centre carries no paint once hollow); the reposition's colour is read off its filled centre, as before.
//     (Shape square/circle is asserted on the Layout in (3).)
test('(1) 2D: pass-0 Start = amber HOLLOW (never emits); a later auto reposition = cyan filled', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const px = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const canvas = document.createElement('canvas'); canvas.style.width = '240px'; canvas.style.height = '200px';
    document.body.appendChild(canvas);
    const t2 = createToolpath2d(canvas);
    t2.setStock({ x: 100, y: 80, z: 20 });
    t2.setStarts([{ x: 30, y: 40, z: 0 }, { x: 70, y: 40, z: 0 }]);   // pass 0 = the Start, pass 1 = a reposition
    t2.setStartSources(['auto', 'auto']); t2.setStartEmits([false, true]);
    t2.fit();
    const rec = canvas.__t2starts; if (!rec || rec.length < 2) return { ok: false };
    const dpr = window.devicePixelRatio || 1; const ctx = canvas.getContext('2d');
    const at = (x, y) => { const d = ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data; return { a: d[3], r: d[0], g: d[1], b: d[2] }; };
    const centre = (i) => at(rec[i].sx, rec[i].sy);
    const ring = (i) => at(rec[i].sx + 6, rec[i].sy);   // the Start's hollow ring — drawn at radius 6.5, lineWidth 2.8 (drawStartHandles) — +6px lands on the stroke
    const out = { ok: true, startCentre: centre(0), startRing: ring(0), repos: centre(1) };
    canvas.remove(); return out;
  });
  expect(px.ok, 'both markers painted').toBe(true);
  expect(px.startCentre.a, 'Start centre is HOLLOW (transparent) — it never emits').toBeLessThan(100);
  expect(px.repos.a, 'reposition centre filled (it emits)').toBeGreaterThan(150);
  // pass-0 Start = AMBER (red+green over blue), read off its ring; the auto reposition = CYAN (blue-dominant), read off its filled centre
  expect(px.startRing.a, 'sanity: the ring sample actually hit paint').toBeGreaterThan(60);
  expect(px.startRing.r > px.startRing.b && px.startRing.g > px.startRing.b, 'Start ring is amber').toBe(true);
  expect(px.repos.b, 'auto reposition is cyan (blue high)').toBeGreaterThan(150);
  expect(px.repos.b, 'cyan: blue > red').toBeGreaterThan(px.repos.r);
});

// (2) 2D — a MANUAL jog travel line arcs UPWARD; AUTO stays straight. (unchanged — the route is source-driven)
test('(2) 2D manual jog travel arcs up (rainbow); auto travel stays straight', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const topAbove = (source) => {
      const canvas = document.createElement('canvas'); canvas.style.width = '300px'; canvas.style.height = '240px';
      document.body.appendChild(canvas);
      const t2 = createToolpath2d(canvas);
      t2.setStock({ x: 100, y: 80, z: 20 });
      t2.setSegments([{ x1: 20, y1: 20, x2: 80, y2: 60, z1: 0, z2: 0, rapid: true, pass: 0, feed: 0 }]);
      t2.setStartSources([source]);
      t2.fit();
      const v = canvas.__t2view; if (!v) return -1;
      const dpr = window.devicePixelRatio || 1; const ctx = canvas.getContext('2d');
      const mx = v.ox + 50 * v.scale, my = v.oy - 40 * v.scale;
      let top = 0;
      for (let dy = 3; dy <= 70; dy++) {
        let hit = false;
        for (let dx = -18; dx <= 18; dx++) { if (ctx.getImageData(Math.round((mx + dx) * dpr), Math.round((my - dy) * dpr), 1, 1).data[3] > 60) { hit = true; break; } }
        if (hit) top = dy;
      }
      canvas.remove(); return top;
    };
    return { manual: topAbove('manual'), auto: topAbove('auto') };
  });
  expect(r.manual, `manual arc reaches ${r.manual}px above the chord vs auto ${r.auto}px`).toBeGreaterThan(r.auto + 12);
});

// (3) Layout FeatureCanvas — renders the SAME language: an AUTO reposition = a CYAN SQUARE (fc-handle-move); a MANUAL
//     reposition = an AMBER CIRCLE (fc-handle-sim); the Start (__simstart0) is always the amber circle, HOLLOW (t1688 —
//     it never emits). Colour is COMPUTED (inline style beats the .fc-handle class — the t89 specificity bar).
test('(3) Layout renders auto=cyan square / manual=amber circle; the Start is the amber HOLLOW circle', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form [data-param="cross1_x"]', { state: 'attached' });   // t1303 — ATTACHED, not visible: this field is DECLARED out of the form (its editor is the canvas handle), so its presence is what proves the handle is built

  const r = await page.evaluate(async () => {
    const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
    const { cornerDataDef, CORNER_DEFAULTS } = await import('/blocks/dataOps/cornerData.js');
    const { FeatureCanvas } = await import('/viz/featureCanvas.js');
    const def = cornerDataDef();
    const p = { ...CORNER_DEFAULTS };
    const paint = (sources) => {
      const cont = document.createElement('div'); cont.style.cssText = 'width:300px;height:240px;position:relative'; document.body.appendChild(cont);
      // t1688 — emits:false explicitly, matching what the REAL app threads (userOpView's simStart carries pos0.emits,
      // and opSimStarts' own makeProvider always computes false at the lead pass structurally). Omitting it here would
      // silently test a synthetic case the real app never produces (undefined reads as filled, hiding the real hollow).
      new FeatureCanvas().render(cont, layoutSpecFromOp(def, p, { pos: { x: 12, y: 12 }, emits: false }, sources));
      const repos = cont.querySelector('[data-hid="reposition_pos"]');
      const start = cont.querySelector('[data-hid="__simstart0"]');
      const csR = repos && getComputedStyle(repos), csS = start && getComputedStyle(start);
      const out = { reposTag: repos && repos.tagName.toLowerCase(), reposFill: csR && csR.fill, startTag: start && start.tagName.toLowerCase(), startFill: csS && csS.fill };
      cont.remove(); return out;
    };
    return { auto: paint(['auto', 'auto', 'auto']), manual: paint(['manual', 'manual', 'manual']) };
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  const MANUAL_RGB = 'rgb(255, 179, 0)', CYAN_RGB = 'rgb(34, 211, 238)';
  // AUTO reposition → cyan SQUARE
  expect(r.auto.reposTag, 'auto reposition is a square (rect)').toBe('rect');
  expect(r.auto.reposFill, 'auto reposition is cyan').toBe(CYAN_RGB);
  // MANUAL reposition → amber CIRCLE
  expect(r.manual.reposTag, 'manual reposition is a circle').toBe('circle');
  expect(r.manual.reposFill, 'manual reposition is amber').toBe(MANUAL_RGB);
  // the Start is ALWAYS the amber circle (it's always the operator jog), in both scenarios — HOLLOW (t1688: it never emits)
  expect(r.auto.startTag, 'Start is a circle').toBe('circle');
  expect(r.auto.startFill, 'Start is amber, HOLLOW (never emits)').toBe('none');
});
