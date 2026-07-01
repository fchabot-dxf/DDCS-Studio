import { test, expect } from '@playwright/test';

/**
 * CORNER-PORT inc B2 SIM — "Corner (data)" DECLARES its own per-pass preview START markers via CANONICAL template
 * `simstart` rows (routed simStartsFromStack → setUserSimStarts → makeProvider → opSimStarts), NOT the built-in
 * `opSimStarts.corner` (which does not exist — corner is not in BUILT_IN). 4 declared passes: Z-plunge (probeZFirst-gated) ·
 * wall-1 · reposition · wall-2. The baked no-Z default renders 3 markers (Z gated off); probeZFirst on renders 4. Every
 * coord is FINITE (no NaN) even when a reposition socket holds an EXPRESSION string — the frac rows use LITERAL fractions
 * (default geometry), never reading the #23/#24 expression sockets. SIM only (emit unchanged — simstart emits nothing).
 */
test('corner (data) declares its per-pass sim starts (canonical): finite, distinct, NaN-safe', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const U  = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');

    const stock = { x: 100, y: 80, z: 20 };
    const def = CD.cornerDataDef();
    U.registerUserOp(def);   // installs the provider via setUserSimStarts (the canonical seam — NOT opSimStarts.corner)

    // (a) CANONICAL: the starts are declared as template `simstart` blocks (not the def.sim.starts fallback).
    const tmplRows = U.simStartsFromStack(def.template);
    const hasStartBlocks = U.flattenBlocks(def.template).some((b) => b && b.type === 'simstart');

    // (b) provider output at the baked no-Z default (probeZFirst=0 → Z-plunge `when`-gated off → 3 markers).
    const def_starts = opSimStarts(CD.CORNER_DATA_OPTYPE, CD.CORNER_DEFAULTS, stock);
    // (c) probeZFirst on → the Z-plunge marker appears → 4 markers.
    const z_starts = opSimStarts(CD.CORNER_DATA_OPTYPE, { ...CD.CORNER_DEFAULTS, probeZFirst: 1 }, stock);
    // (d) NaN discipline: a reposition socket holding an EXPRESSION string must still yield finite markers.
    const expr_starts = opSimStarts(CD.CORNER_DATA_OPTYPE, { ...CD.CORNER_DEFAULTS, cross1_x: '#16', cross1_y: '[0-#15]' }, stock);

    const finite = (arr) => arr.every((s) => Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.z));
    const distinct = (arr) => new Set(arr.map((s) => s.x + ',' + s.y + ',' + s.z)).size === arr.length;
    return {
      optype: CD.CORNER_DATA_OPTYPE, hasStartBlocks, tmplLen: tmplRows.length,
      defLen: def_starts.length, defFinite: finite(def_starts), defDistinct: distinct(def_starts), sample: def_starts,
      zLen: z_starts.length, zFinite: finite(z_starts),
      exprLen: expr_starts.length, exprFinite: finite(expr_starts),
    };
  });

  expect(r.optype).toBe('user_corner_data');
  // CANONICAL declaration: 4 template simstart rows (Z-plunge + wall-1 + reposition + wall-2), NOT the def.sim.starts fallback.
  expect(r.hasStartBlocks, 'starts declared as canonical template simstart blocks').toBe(true);
  expect(r.tmplLen, '4 declared passes').toBe(4);
  // The provider is the source of truth for the per-pass marker count. Baked no-Z default → 3 (Z-plunge gated off).
  expect(r.defLen, 'no-Z default renders 3 markers (Z-plunge gated off)').toBe(3);
  expect(r.defFinite, 'every default marker coord is finite (no NaN)').toBe(true);
  expect(r.defDistinct, 'the 3 markers are distinct points').toBe(true);
  // probeZFirst on → the Z-plunge marker appears → 4.
  expect(r.zLen, 'probeZFirst on renders 4 markers (Z-plunge included)').toBe(4);
  expect(r.zFinite, 'every Z-first marker coord is finite').toBe(true);
  // NaN discipline: expression-holding reposition sockets do NOT surface NaN (frac rows use literal fractions).
  expect(r.exprLen, 'expression-socket params still render the markers').toBe(3);
  expect(r.exprFinite, 'an expression-holding reposition socket → finite markers, never NaN').toBe(true);
});

/**
 * REAL-SYMPTOM (verify-real-symptom): a PLACED "Corner (data)" op renders its per-pass markers in the editor's REAL 3D
 * preview — the wired path program-marker → opSimStarts → getStartHints → computePassStarts → passStarts (mirrors
 * editor-sim-hints.spec for the boss-both). The wizard-pane wiring (userOpView → startHints) is B3; the editor drawer is
 * already wired, so this is the real render surface for B2.
 */
test('editor preview renders the placed Corner (data) per-pass markers (no NaN)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
  const r = await page.evaluate(async () => {
    const U  = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { markerLine } = await import('/blocks/opSchema.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { cornerStack } = await import('/wizards/cornerWizard.js');

    U.registerUserOp(CD.cornerDataDef());              // ensure the provider is installed (seeded at init; re-assert)
    const params = CD.CORNER_DEFAULTS;
    const macro = emitMapped(cornerStack(params)).text;
    const editor = document.getElementById('editor');
    editor.value = markerLine(CD.CORNER_DATA_OPTYPE, params) + '\n' + macro;   // the placed op (@DDCS marker) + its G-code
    window.setGcodeView('3d');                          // open the editor 3D preview (shared panel)
    window.__gpPanel.refresh();                          // trace: computePassStarts reads getStartHints → opSimStarts
    const rendered = window.__gpPanel.getPassStarts();
    const stock = window.ddcsGetSettings().stock;
    return { rendered, expected: opSimStarts(CD.CORNER_DATA_OPTYPE, params, stock) };
  });
  expect(r.expected, 'registry declares 3 markers for the no-Z default').toHaveLength(3);
  expect(r.rendered, 'the editor preview renders one per-pass marker per declared pass').toHaveLength(3);
  for (const s of r.rendered) {
    expect(Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.z), 'no NaN in a rendered marker').toBe(true);
  }
});
