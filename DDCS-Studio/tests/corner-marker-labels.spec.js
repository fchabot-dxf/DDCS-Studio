import { test, expect } from '@playwright/test';

/**
 * CORNER MARKER LABELS + ONE GLYPH LANGUAGE (t293). The start markers use ONE visual language across the 3D preview,
 * the 2D toolpath, and the Layout canvas: AUTO reposition (machine drives there) = a filled CYAN SQUARE; MANUAL jog /
 * the operator START (pass 0, always a jog) = a filled AMBER CIRCLE. The top panels carry glyph + colour only (no
 * numbered badge); the Layout adds the label: 'Start' for pass 0, the PASS NUMBER (1,2…) for each reposition. The
 * emit stays byte-identical (pure preview).
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
  await page.waitForSelector('#wiz_user_form [data-param="cross1_x"]', { state: 'visible' });   // the reposition form field → the handle is built

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
  await page.waitForSelector('#userVizContainer .fc-handle-sim', { timeout: 8000 });
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('#userVizContainer .fc-handle-label')].map((t) => t.textContent);
    const sim = document.querySelector('#userVizContainer .fc-handle-sim[data-hid="__simstart0"]');
    const repos = document.querySelector('#userVizContainer [data-hid="reposition_pos"]');
    const fill = (el) => el && getComputedStyle(el).fill;
    return { labels, simTag: sim && sim.tagName, simFill: fill(sim), reposTag: repos && repos.tagName, reposFill: fill(repos) };
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  expect(r.labels, "the 'Start' label rendered").toContain('Start');
  expect(r.labels, "the pass-number '1' label rendered").toContain('1');
  expect(r.labels.some((l) => l === 'pos'), 'no "pos" on corner').toBe(false);
  // the manual Start = a filled AMBER CIRCLE; the auto reposition = a filled CYAN SQUARE (default travelApproach=auto)
  expect(r.simTag, 'Start marker is a circle').toBe('circle');
  expect(r.simFill, 'Start marker is amber').toBe('rgb(255, 179, 0)');
  expect(r.reposTag, 'auto reposition marker is a square (rect)').toBe('rect');
  expect(r.reposFill, 'auto reposition marker is cyan').toBe('rgb(34, 211, 238)');
});
