import { test, expect } from '@playwright/test';

// EDITOR SIM applies the declared start hints — extend the opSimStarts seam from the wizard to the editor. The macro is
// IDENTICAL; only the sim differed: the wizard's preview sims WITH the per-pass hints (the 2nd-axis begins at ②), but the
// editor sims WITHOUT them (the 2nd-axis glued to the WCS edge). FIX: the editor parses the program's @DDCS op markers →
// opSimStarts(opType, params, stock) (the SAME registry) → getStartHints → the trace/engine passStarts. So the editor and
// the wizard SHARE the registry → identical sim for the same op.
test.use({ viewport: { width: 1280, height: 900 } });

test('editor sims an inserted boss-both with the registry hints (①② match the wizard, not the WCS edge)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.setGcodeView);
  const r = await page.evaluate(async () => {
    // t1730 — MiddleWizard (the legacy screen class) was deleted alongside its view; middleStack is the surviving
    // builder — emit its block stack through the SAME mapper the app uses (emitMapped) for G-code text.
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { markerLine } = await import('/blocks/opSchema.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const params = { featureType: 'boss', twoAxis: true, findBoth: true, axis: 'X', dir1: 'pos', dir2: 'neg', dist: 100, inAxis: 'auto', transAxis: 'auto' };
    const macro = emitMapped(middleStack(params)).text;
    const editor = document.getElementById('editor');

    // 1) INSERTED OP — the program carries the @DDCS marker (op type + params)
    editor.value = markerLine('middle', params) + '\n' + macro;
    window.setGcodeView('3d');                 // open the editor 3D preview → the shared panel
    window.__gpPanel.refresh();                 // trace the program (computePassStarts reads getStartHints → opSimStarts)
    const withMarker = window.__gpPanel.getPassStarts();

    // 2) NEGATIVE control — the SAME macro WITHOUT the marker → no hints → the single-pass default (unchanged)
    editor.value = macro;
    window.__gpPanel.refresh();
    const noMarker = window.__gpPanel.getPassStarts();

    const stock = window.ddcsGetSettings().stock;
    return { withMarker, noMarker, expected: opSimStarts('middle', params, stock) };
  });

  expect(r.expected, 'registry hints = 2 (boss-both)').toHaveLength(2);
  expect(r.withMarker, 'editor passStarts = 2 when the marker is present').toHaveLength(2);
  // ① AND ② match the registry hints → the editor sims the SAME op the SAME way as the wizard
  expect(Math.round(r.withMarker[0].x)).toBe(Math.round(r.expected[0].x));
  expect(Math.round(r.withMarker[0].y)).toBe(Math.round(r.expected[0].y));
  expect(Math.round(r.withMarker[1].x), 'the 2nd-axis ② begins at the registry hint, not the WCS edge').toBe(Math.round(r.expected[1].x));
  expect(Math.round(r.withMarker[1].y)).toBe(Math.round(r.expected[1].y));
  // without the marker → the editor can't know the op → the single-pass default (no per-pass hints)
  expect(r.noMarker.length, 'no marker → no per-pass hints (single-pass default, unchanged)').toBe(1);
});
