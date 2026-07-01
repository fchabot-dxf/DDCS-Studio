import { test, expect } from '@playwright/test';

/**
 * CORNER-PORT inc B2/B2b SIM — "Corner (data)" DECLARES its per-PROBE-PASS preview START markers via CANONICAL template
 * `simstart` rows (routed simStartsFromStack → setUserSimStarts → makeProvider → opSimStarts), NOT the built-in
 * `opSimStarts.corner`. ONE marker per PROBE PASS (wall-1, wall-2, + Z-surface when probeZFirst) — the engine indexes markers
 * by `_pass`, which bumps at each `REPOSITION:` traverse (a DELIMITER, not a pass). The corner's single wall-1→wall-2 REPOSITION
 * → 2 engine passes → 2 markers for the baked no-Z default; the reposition itself gets NO marker (B2b fix: a waypoint marker
 * displaced wall-2 to the reposition point INSIDE the stock and orphaned the true wall-2). Every coord is FINITE (no NaN) even
 * when a reposition socket holds an EXPRESSION string. SIM only (emit unchanged — simstart emits nothing).
 */
test('corner (data) sim starts align 1:1 with probe passes (no waypoint marker; none inside the stock; NaN-safe)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);

  const r = await page.evaluate(async () => {
    const U  = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { GcodeExecutionEngine } = await import('/engine/index.js');

    const stock = { x: 100, y: 80, z: 20 };
    const def = CD.cornerDataDef();
    U.registerUserOp(def);   // installs the provider via setUserSimStarts (the canonical seam)

    const tmplRows = U.simStartsFromStack(def.template);
    const hasStartBlocks = U.flattenBlocks(def.template).some((b) => b && b.type === 'simstart');

    const def_starts  = opSimStarts(CD.CORNER_DATA_OPTYPE, CD.CORNER_DEFAULTS, stock);                                   // baked no-Z default
    const z_starts    = opSimStarts(CD.CORNER_DATA_OPTYPE, { ...CD.CORNER_DEFAULTS, probeZFirst: 1 }, stock);           // Z-surface declared too
    const expr_starts = opSimStarts(CD.CORNER_DATA_OPTYPE, { ...CD.CORNER_DEFAULTS, cross1_x: '#16', cross1_y: '[0-#15]' }, stock);  // expr socket

    // PASS-ALIGNMENT: run the no-Z corner macro through the ENGINE → its _pass count MUST equal the marker count.
    const code = emitMapped(cornerStack(CD.CORNER_DEFAULTS)).text;
    const e = new GcodeExecutionEngine({ autoAnswer: true, stock, onLineChange: () => {}, onPositionChange: () => {} });
    e.step(code); let g = 0; while (e.running && g++ < 8000) e.step();
    const enginePassCount = (e._maxPass || 0) + 1;

    const finite = (arr) => arr.every((s) => Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.z));
    const distinct = (arr) => new Set(arr.map((s) => s.x + ',' + s.y + ',' + s.z)).size === arr.length;
    // a probe START must NOT sit inside the material (inside the XY footprint AND below the top) — that was the reposition bug.
    const insideCount = def_starts.filter((s) => s.x > 0 && s.x < stock.x && s.y > 0 && s.y < stock.y && s.z < 0).length;
    return {
      optype: CD.CORNER_DATA_OPTYPE, hasStartBlocks, tmplLen: tmplRows.length,
      defLen: def_starts.length, defFinite: finite(def_starts), defDistinct: distinct(def_starts),
      insideCount, enginePassCount, zLen: z_starts.length, exprFinite: finite(expr_starts),
    };
  });

  expect(r.optype).toBe('user_corner_data');
  expect(r.hasStartBlocks, 'starts declared as canonical template simstart blocks').toBe(true);
  expect(r.tmplLen, '3 declared rows: Z-surface (gated) + wall-1 + wall-2 — NO reposition-waypoint row').toBe(3);
  // ONE marker per PROBE PASS — the reposition is a _pass delimiter, not a marker.
  expect(r.defLen, 'no-Z default → 2 markers (one per probe pass)').toBe(2);
  // PASS-ALIGNMENT (the B2b fix): the marker count MUST equal the engine's _pass count, else a probe anchors to the wrong start.
  expect(r.enginePassCount, 'the no-Z corner macro runs exactly 2 engine passes').toBe(2);
  expect(r.defLen, 'markers align 1:1 with the engine passes').toBe(r.enginePassCount);
  // No marker inside the material — the reposition-waypoint bug placed wall-2 inside the stock.
  expect(r.insideCount, 'no start marker sits inside the stock material').toBe(0);
  expect(r.defFinite && r.defDistinct, 'markers are finite + distinct').toBe(true);
  // probeZFirst declares the Z-surface marker too (its own pass-alignment is a B4 concern — Z→wall-1 is not a REPOSITION: delimiter).
  expect(r.zLen, 'probeZFirst declares the Z-surface marker (3 rows contribute)').toBe(3);
  // NaN discipline: expression-holding reposition sockets → finite (frac rows use literal fractions).
  expect(r.exprFinite, 'an expression-holding reposition socket → finite markers, never NaN').toBe(true);
});

/**
 * REAL-SYMPTOM (verify-real-symptom): a PLACED "Corner (data)" op renders one marker PER PROBE PASS in the editor's REAL 3D
 * preview — the wired path program-marker → opSimStarts → getStartHints → computePassStarts → passStarts (mirrors
 * editor-sim-hints.spec). No-Z default → 2 markers (wall-1, wall-2), aligned to the engine's 2 passes, no NaN.
 */
test('editor preview renders the placed Corner (data) markers, one per probe pass (no NaN)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
  const r = await page.evaluate(async () => {
    const U  = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { markerLine } = await import('/blocks/opSchema.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { cornerStack } = await import('/wizards/cornerWizard.js');

    U.registerUserOp(CD.cornerDataDef());
    const params = CD.CORNER_DEFAULTS;
    const macro = emitMapped(cornerStack(params)).text;
    const editor = document.getElementById('editor');
    editor.value = markerLine(CD.CORNER_DATA_OPTYPE, params) + '\n' + macro;   // the placed op (@DDCS marker) + its G-code
    window.setGcodeView('3d');
    window.__gpPanel.refresh();                          // trace: computePassStarts reads getStartHints → opSimStarts
    const rendered = window.__gpPanel.getPassStarts();
    const stock = window.ddcsGetSettings().stock;
    return { rendered, expected: opSimStarts(CD.CORNER_DATA_OPTYPE, params, stock) };
  });
  expect(r.expected, 'registry declares 2 markers for the no-Z default').toHaveLength(2);
  expect(r.rendered, 'the editor preview renders one marker per probe pass (2)').toHaveLength(2);
  for (const s of r.rendered) {
    expect(Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.z), 'no NaN in a rendered marker').toBe(true);
  }
});
