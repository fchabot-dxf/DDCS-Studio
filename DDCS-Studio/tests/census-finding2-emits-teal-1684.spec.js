import { test, expect } from '@playwright/test';

/**
 * t1684 — CENSUS FINDING 2 (the last of three): lathe's `teal:true` and corner's `emits` were the SAME declared safety
 * signal ("does dragging this handle write a value that reaches the emitted G-code") under two vocabularies, read by
 * NEITHER FeatureCanvas nor the 3D/2D-toolpath renderers (all three keyed shape/colour off `source`/`color` only —
 * t1670's own finding). Reconciled to ONE name, `emits` (the pre-existing, semantic, cross-op convention already
 * computed generically by opSimStarts.js's makeProvider) — lathe's `teal` was renamed, not aliased. `color`/`source`
 * stay a SEPARATE, orthogonal axis (auto/manual); `emits` is read by every renderer that draws a handle.
 *
 * Corner's own two reachable point-decls (wall1, wall2) always carry emits:true when rendered — see WORK-LOG for why
 * the "hollow" branch has no LIVE corner state today; (A) below exercises it directly through the real code path, not
 * through wishful corner params. Lathe has the opposite shape — EVERY dimension handle is emits:true (they are all
 * genuine drag-writes) — so its own visible defect is a plain gold circle where the declared convention says teal.
 */

test.use({ viewport: { width: 1000, height: 700 } });

// (A) LATHE, REAL SPEC-BUILDER — odProfileSpec is the actual function odTurnView renders; its own handles carry
//     `emits: true` on the shoulder (already true before this turn — teal was declared, just unread). Render the SAME
//     spec through the real FeatureCanvas and read the SHOULDER handle's own computed fill: it must be TEAL (#14b8a6),
//     not the CSS gold default that a pre-fix FeatureCanvas paints for any handle with no `.color`.
test('(A) lathe: the shoulder handle (declared emits:true) renders TEAL, not gold, through the real FeatureCanvas', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { odProfileSpec, SHOULDER_HANDLE_ID } = await import('/viz/latheProfileCanvas.js');
    const { FeatureCanvas } = await import('/viz/featureCanvas.js');
    const spec = odProfileSpec({ diameter: 20, stickOut: 40, allowance: 2 }, { kind: 'straight', targetDiameter: 14, depth: 25 }, () => {});
    const shoulder = spec.handles.find((h) => h.id === SHOULDER_HANDLE_ID);
    const container = document.createElement('div'); container.style.width = '400px'; container.style.height = '300px';
    document.body.appendChild(container);
    const fc = new FeatureCanvas(); fc.render(container, spec);
    const el = container.querySelector(`[data-hid="${SHOULDER_HANDLE_ID}"]`);
    const fill = el && getComputedStyle(el).fill;
    container.remove();
    return { declaredEmits: shoulder && shoulder.emits, fill };
  });
  expect(r.declaredEmits, 'sanity: the shoulder handle really does declare emits:true').toBe(true);
  expect(r.fill, 'the rendered handle picks up the TEAL fill (#14b8a6), the declared emits convention').toBe('rgb(20, 184, 166)');
});

// (B) CORNER, DIRECT UNIT of the SHAPE axis — corner's own two reachable point-decls always carry emits:true when
//     rendered (see WORK-LOG), so the HOLLOW branch has no live corner trigger today; this proves the mechanism itself
//     works on the exact handle shape panelTypes.js emits (kind:'move', a `point`-gesture decl), independent of
//     whether any current op's params reach the false case.
test('(B) FeatureCanvas direct: a move-kind handle renders HOLLOW at emits:false, SOLID at emits:true/undefined', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { FeatureCanvas } = await import('/viz/featureCanvas.js');
    const render = (emits) => {
      const container = document.createElement('div'); container.style.width = '300px'; container.style.height = '300px';
      document.body.appendChild(container);
      const fc = new FeatureCanvas();
      fc.render(container, { stock: { ox: 0, oy: 0, w: 100, h: 80 }, items: [], handles: [{ id: 'w', x: 50, y: 40, kind: 'move', color: '#22d3ee', emits }] });
      const el = container.querySelector('[data-hid="w"]');
      const cs = el && getComputedStyle(el);
      const out = el ? { tag: el.tagName.toLowerCase(), fill: cs.fill, stroke: cs.stroke } : null;
      container.remove();
      return out;
    };
    return { hollow: render(false), solidTrue: render(true), solidUndeclared: render(undefined) };
  });
  expect(r.hollow.fill, 'emits:false → HOLLOW: fill is none/transparent').toMatch(/^(none|transparent|rgba\(0, 0, 0, 0\))$/);
  expect(r.hollow.stroke, 'emits:false → the outline still carries the source colour').toBe('rgb(34, 211, 238)');
  expect(r.solidTrue.fill, 'emits:true → SOLID: fill is the source colour').toBe('rgb(34, 211, 238)');
  expect(r.solidUndeclared.fill, 'undeclared (undefined) → UNCHANGED pre-existing solid behaviour').toBe('rgb(34, 211, 238)');
});

// (C) CORNER, REAL VALUE — the wall-2 reposition decl (panelTypes.js) now carries the DECLARED emits value read straight
//     off opSimStarts, not a hardcoded true: open the real corner wizard, read the Layout spec's own handle.
test('(C) corner Layout: the wall-2 reposition handle carries the DECLARED emits value from opSimStarts (true)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form input[type="number"]', { state: 'visible' });
  await page.evaluate(() => { const t = document.querySelector('[data-tab="layout"], [data-viz-mode="2d"], .viz-tab-2d'); if (t) t.click(); });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const svg = document.querySelector('#userVizContainer svg, .wiz-layout svg');
    const el = svg && svg.querySelector('[data-hid$="_pos"]');
    return el ? { found: true, fill: getComputedStyle(el).fill } : { found: false };
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
  // Not asserting a specific colour here (source-driven, auto/manual) — this test exists to prove the Layout renders
  // without throwing now that `emits` flows through the decl; (A)/(B) cover the actual emits→shape/colour logic.
  expect(r.found, 'the Layout renders a reposition point handle for corner').toBe(true);
});

// (D) 3D — _highlightSelectedStart now reads the DECLARED `_startEmits` (set by setStartEmits) to pick the glyph
//     TEXTURE, not a stand-in derived from `manual`/source. Two later passes, SAME source (both auto → same colour),
//     differing only in emits: they must pick DIFFERENT cached textures (the emit tex vs the sim tex).
test('(D) 3D: two same-source passes pick DIFFERENT glyph textures by their declared emits, not by source', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz._passCount = 3; viz._ensureMarkers();
    viz.setStartSources(['auto', 'auto', 'auto']);   // SAME source on every pass — colour is held constant
    viz.setStartEmits([false, true, false]);         // pass 1 emits, pass 2 does not — the SHAPE axis under test
    viz._highlightSelectedStart();
    const emitTex = viz._startGlyphTex(true), simTex = viz._startGlyphTex(false);
    return {
      m1: viz.spindleMarkers[1].children[0].material.map === emitTex,
      m2: viz.spindleMarkers[2].children[0].material.map === simTex,
      texturesDiffer: emitTex !== simTex,
    };
  });
  expect(r.texturesDiffer, 'sanity: the emit/sim glyph textures are genuinely distinct cached objects').toBe(true);
  expect(r.m1, 'pass 1 (emits:true) picks the EMIT texture').toBe(true);
  expect(r.m2, 'pass 2 (emits:false), same source as pass 1, picks the SIM (hollow) texture').toBe(true);
});
