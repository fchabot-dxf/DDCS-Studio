import { test, expect } from '@playwright/test';

/**
 * CORNER MARKER LABELS + ONE GLYPH LANGUAGE (t293, t1688). The start markers use ONE visual language across the 3D
 * preview, the 2D toolpath, and the Layout canvas: SHAPE+COLOUR follow AUTO/MANUAL (machine-driven reposition = a
 * CYAN SQUARE; operator jog = an AMBER CIRCLE — the Start, pass 0, is always a jog); FILL is the ORTHOGONAL `emits`
 * axis (t1688 — solid = a drag writes a value the emitted program reads, hollow = sim-only, e.g. the Start itself,
 * which never emits). The top panels carry glyph + colour only (no numbered badge); the Layout adds the label:
 * 'Start' for pass 0, the PASS NUMBER (1,2…) for each reposition. The emit stays byte-identical (pure preview).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('the Layout handles carry the right labels (Start + pass number); no "pos"; emit unaffected', async ({ page }) => {
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
    const CD = await import('/blocks/dataOps/cornerData.js');
    const def = CD.cornerDataDef();
    const sim = { pos: { x: 10, y: 10 }, onDrag: () => {} };
    const hs = layoutSpecFromOp(def, { ...CD.CORNER_DEFAULTS }, sim).handles || [];
    const lab = (id) => { const h = hs.find((x) => x.id === id); return h ? h.label : null; };
    return { repos: lab('reposition_pos'), sim: lab('__simstart0'), anyPos: hs.some((h) => h.label === 'pos') };
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  // the labels live ONLY on the viz handle spec (panelTypes), never in the op builder → the emit is untouched (the suite's
  // byte-parity specs, e.g. corner-source-chips, cover that). Here we assert the labels themselves.
  expect(r.sim, 'sim-only pass-0 marker → Start').toBe('Start');
  expect(r.repos, 'the reposition → its pass NUMBER (1)').toBe('1');
  expect(r.anyPos, 'no generic "pos" label on corner').toBe(false);
});

test('the Layout renders the labels + the auto-square / manual-circle glyphs (real symptom)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#userVizContainer_tree .fc-handle-sim', { timeout: 8000 });
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('#userVizContainer_tree .fc-handle-label')].map((t) => t.textContent);
    const sim = document.querySelector('#userVizContainer_tree .fc-handle-sim[data-hid="__simstart0"]');
    const repos = document.querySelector('#userVizContainer_tree [data-hid="reposition_pos"]');
    const fill = (el) => el && getComputedStyle(el).fill;
    return { labels, simTag: sim && sim.tagName, simFill: fill(sim), reposTag: repos && repos.tagName, reposFill: fill(repos) };
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  expect(r.labels, "the 'Start' label rendered").toContain('Start');
  expect(r.labels, "the pass-number '1' label rendered").toContain('1');
  expect(r.labels.some((l) => l === 'pos'), 'no "pos" on corner').toBe(false);
  // t1688 — the manual Start (pass 0, always sim-only) = a HOLLOW amber CIRCLE (it never emits — opSimStarts forces
  // emits:false at the lead pass structurally); the auto reposition = a FILLED CYAN SQUARE (default
  // travelApproach=auto, genuinely writes #23/#24). Shape+colour (t293) are unchanged; fill is the orthogonal axis.
  expect(r.simTag, 'Start marker is a circle').toBe('circle');
  expect(r.simFill, 'Start marker is amber, HOLLOW (never emits)').toBe('none');
  expect(r.reposTag, 'auto reposition marker is a square (rect)').toBe('rect');
  expect(r.reposFill, 'auto reposition marker is cyan, FILLED (it emits #23/#24)').toBe('rgb(34, 211, 238)');
});
