import { test, expect } from '@playwright/test';

/**
 * DECLARE-NOT-INFER the per-pass reposition SOURCE (t83) — the auto/manual signal that drives the marker COLOUR (cyan/amber)
 * + the arc-vs-straight travel line comes from the LIVE param travelApproach (via cornerSimStartsProvider), NOT the engine's
 * G-code-TEXT inference (parsed.stats.passSources — which read 'manual' even at corner's auto default + was STATIC on toggle).
 * Both panels (top + Layout) read the SAME declared truth. ASSERT-THE-VALUE: toggling travelApproach ACTUALLY changes
 * getPassSources() (not static/stale), and the Layout colour follows. Byte-parity untouched (declared source is preview-only).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('per-pass source is DECLARED from travelApproach — toggling auto↔manual changes getPassSources live (both panels)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form input[type="number"]', { state: 'visible' });

  const read = () => page.evaluate(() => {
    const box = document.getElementById('userViz3dContainer');
    const host = box && box.parentElement && box.parentElement.querySelector('.wiz-viz3d');
    const panel = host && host.__panel;
    // the travelApproach SEGMENTED control (t323): the selected value = the highlighted (.seg-on) segment
    const on = document.querySelector('#wiz_user_form .seg-control[data-param="travelApproach"] .seg-btn.seg-on');
    return { src: (panel && panel.getPassSources()) || null, ta: on && on.dataset.value };
  });
  const before = await read();

  // toggle travelApproach → 'manual' via the REAL segmented control (clicking a segment dispatches the change the form listens for)
  await page.evaluate(() => {
    const btn = document.querySelector('#wiz_user_form .seg-control[data-param="travelApproach"] .seg-btn[data-value="manual"]');
    btn.click();
  });
  // the panel recomputes on the form change; poll getPassSources until it reflects the toggle
  await expect.poll(async () => { const s = (await read()).src; return Array.isArray(s) ? s.join(',') : ''; }, { timeout: 5000 }).toContain('manual');
  const after = await read();

  // the Layout handle colour must follow the SAME declared source (cyan under auto, amber under manual)
  const colors = await page.evaluate(async (srcs) => {
    const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
    const { cornerDataDef, CORNER_DEFAULTS } = await import('/blocks/dataOps/cornerData.js');
    const def = cornerDataDef();
    const rep = (sources, ta) => (layoutSpecFromOp(def, { ...CORNER_DEFAULTS, travelApproach: ta }, null, sources).handles || []).find((h) => h.id === 'reposition_pos');
    const b = rep(srcs.before, 'auto'), a = rep(srcs.after, 'manual');
    return { before: b && b.color, after: a && a.color };
  }, { before: before.src, after: after.src });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  // the DOM toggle genuinely changed
  expect(before.ta, 'default travelApproach is auto').toBe('auto');
  expect(after.ta, 'toggled to manual').toBe('manual');
  // THE ASSERT-THE-VALUE BAR: the DECLARED source tracks the toggle (it was STATIC under the engine's text-inference).
  expect(before.src.every((s) => s === 'auto'), `default (auto travel) → every pass reads auto, got [${before.src}]`).toBe(true);
  expect(after.src.some((s) => s === 'manual'), `after → a reposition pass reads manual, got [${after.src}]`).toBe(true);
  expect(after.src, 'getPassSources ACTUALLY CHANGED with the toggle (not static)').not.toEqual(before.src);
  expect(after.src[0], 'pass 0 (the operator jog lead) stays auto in both states').toBe('auto');
  // the colour follows the SAME declared source (both panels in lockstep).
  expect(colors.before, 'auto → the Layout reposition handle is CYAN').toBe('#22d3ee');
  expect(colors.after, 'manual → the Layout reposition handle is AMBER').toBe('#ffb300');
});
