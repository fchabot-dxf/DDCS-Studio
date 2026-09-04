import { test, expect } from '@playwright/test';

/**
 * MIDDLE ②-AIM DRAG PORT (t383, human) — the in-place Middle regains a draggable ② marker (the trans-axial diagonal/dogleg
 * TARGET) that sets diagTravel (#21) + diagPrimary (#22), lost when the built-in view was swapped for the generic userOpView.
 * Ported via a declared `diagAim` canvas gesture (viz/canvasWidgets) + an opt-in handle in layoutSpecFromOp — the SAME
 * mapping the built-in middleView.tieDiagTravel used. ASSERT-THE-VALUE: the derived diagTravel/diagPrimary vs an INDEPENDENT
 * truth (not just "moved"); the emit #21 reflects the drag; byte-identical when the ② is UNTOUCHED (default diagTravel 50).
 */
test('② diagAim gesture: drag → diagTravel = |secondary − centre|, diagPrimary = primary coord (tieDiagTravel truth); emit #21 reflects', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { CANVAS_GESTURES } = await import('/viz/canvasWidgets.js');
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    // stock 100×80, boss, primary X → secondary Y, centreSec = 80/2 = 40; the ② target rests at centre + sign·travel on Y.
    const d = { type: 'diagAim', primaryX: true, centreSec: 40, sign: 1, travel: 50, prim: 50, fieldTravel: 'diagTravel', fieldPrimary: 'diagPrimary', label: '②' };
    const place = CANVAS_GESTURES.diagAim.place(d);                     // at rest: x = prim = 50, y = centreSec + sign·travel = 90
    const drag = CANVAS_GESTURES.diagAim.drag(d, { x: 65, y: 75 });     // drag ②: sec = y = 75, prim = x = 65
    // INDEPENDENT TRUTH (middleView.tieDiagTravel): d21 = max(1, round(|75−40|)) = 35; d22 = round(65) = 65
    const truthTravel = Math.max(1, Math.round(Math.abs(75 - 40)));
    const truthPrimary = Math.round(65);
    const emit = emitMapped(middleStack({ featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg', inAxis: 'auto', transAxis: 'auto', diagTravel: String(drag.diagTravel) })).text;
    const emit21 = (emit.split('\n').find((l) => /^#21=/.test(l)) || '');
    return { place, drag, truthTravel, truthPrimary, emit21 };
  });
  expect(r.place, 'the ② handle rests at the diagonal target (primary = prim, secondary = centre + travel)').toEqual({ x: 50, y: 90, kind: 'move', label: '②' });
  expect(r.drag.diagTravel, 'diagTravel = |secondary − centreSec| — the tieDiagTravel truth').toBe(r.truthTravel);
  expect(r.drag.diagTravel, 'concretely 35 = |75 − 40|').toBe(35);
  expect(r.drag.diagPrimary, 'diagPrimary = the primary coord — the tieDiagTravel truth').toBe(r.truthPrimary);
  expect(r.drag.diagPrimary, 'concretely 65').toBe(65);
  expect(r.emit21, 'the emitted #21 reflects the dragged diagTravel (35)').toMatch(/^#21=35 \(/);
});

/**
 * REAL-SYMPTOM — open the in-place Middle (boss + probe-both + trans-axis auto): the ② handle appears in the 2D canvas; when
 * UNTOUCHED the emit is byte-identical (default diagTravel 50 → #21=50). Screenshot the ②-drag handle.
 */
test.use({ viewport: { width: 1400, height: 1000 } });
test('② diagAim: the in-place Middle shows the ② handle for boss+probe-both+trans-auto; untouched emit byte-identical', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
  await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 100, y: 80, z: 20, shape: 'boss', show: true } }); });
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/middleData.js'); try { U.registerUserOp(M.middleDataDef()); } catch (_) {} });
  await page.evaluate(() => window.openWiz('user_middle_data'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
  // configure boss (a SELECT) → wait for the re-render → then Find-Both (a bool .ddcs-switch, targeted by its label) + trans-axis
  // Auto (an enum seg-control button). Each change re-runs update()/re-renders, so re-query + wait between steps.
  await page.evaluate(() => { const s = document.querySelector('#wiz_user_form [data-param="featureType"]'); if (s) { s.value = 'boss'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    const form = document.getElementById('wiz_user_form');
    const segAuto = form.querySelector('[data-param="transAxis"] [data-value="auto"]'); if (segAuto) segAuto.click();
    const labSpan = Array.from(form.querySelectorAll('span')).find((sp) => (sp.textContent || '').trim() === 'Find Both Axes');
    const cb = labSpan && labSpan.parentElement && labSpan.parentElement.querySelector('.ddcs-switch input');
    if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForTimeout(700);

  const r = await page.evaluate(async () => {
    const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
    const { middleDataDef, MIDDLE_DATA_OPTYPE } = await import('/blocks/dataOps/middleData.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const def = middleDataDef();
    const params = { featureType: 'boss', twoAxis: true, transAxis: 'auto', travelShape: 'dogleg', axis: 'X', dir1: 'pos', diagTravel: 50, diagPrimary: '#53' };
    const spec = layoutSpecFromOp(def, params, null, null, null, {}, () => {}, null);   // the form is open → diagTravel/diagPrimary fields exist → _writable
    // byte-identical when UNTOUCHED: the twin default emit (diagTravel 50) == the built-in default (#21=50) — the handle is preview-only
    const twin = emitMapped(builderOf(MIDDLE_DATA_OPTYPE)({ featureType: 'boss', twoAxis: true, transAxis: 'auto' })).text;
    const builtin = emitMapped(middleStack({ featureType: 'boss', twoAxis: true, transAxis: 'auto' })).text;
    // the LIVE 2D canvas (from the configured form) renders the ② handle (an SVG <text> label). t2599 — middle_data
    // now migrates onto the declared uiChildren tree, whose viz container carries a `_tree`-suffixed id
    // (formWidgets.js's own `nsId(...)`), not the classic shell's fixed id this getElementById lookup assumed —
    // same general flat-vs-tree gap named at t2597/t2599 for the other migrated ops; matched by id substring here.
    const c = document.querySelector('[id*="userVizContainer"]:has(svg text)') || document.querySelector('[id*="userVizContainer"]');
    const svg = c && c.querySelector('svg');
    const liveTexts = svg ? Array.from(svg.querySelectorAll('text')).map((t) => (t.textContent || '').trim()) : [];
    return {
      hasAim: (spec.handles || []).some((h) => h.id === 'diagAim'),
      aimLabel: ((spec.handles || []).find((h) => h.id === 'diagAim') || {}).label,
      liveAim: liveTexts.includes('②'),
      untouchedByteIdentical: twin === builtin,
      untouched21: (twin.split('\n').find((l) => /^#21=/.test(l)) || ''),
    };
  });
  { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/middle_diagaim_preview.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
  expect(r.hasAim, 'the ② diagonal-aim handle appears in the 2D canvas for boss + probe-both + trans-axis auto').toBe(true);
  expect(r.aimLabel, 'the handle is labelled ②').toBe('②');
  expect(r.liveAim, 'the ② handle renders in the LIVE 2D canvas (the configured in-place Middle form)').toBe(true);
  expect(r.untouchedByteIdentical, 'UNTOUCHED: the twin emit is byte-identical to the built-in (the ② handle is preview-only until dragged)').toBe(true);
  expect(r.untouched21, 'UNTOUCHED: #21 stays the default 50').toMatch(/^#21=50 \(/);
});

/**
 * t389 (human "the forms arent used, we can use the variable") — Diag Travel (#21) + Diag Primary (#22) are DRAG-DRIVEN by
 * the ② canvas handle (the SOLE editor), so their form fields render READONLY (display the ②-derived value, not a competing
 * editable input). A programmatic write (the ② drag's _writeParam) STILL lands (readOnly blocks USER typing only). Emit unchanged.
 */
test('② drag-driven fields: Diag Travel/Primary render READONLY (the ② drag is the sole editor)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
  await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 100, y: 80, z: 20, shape: 'boss', show: true } }); });
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const M = await import('/blocks/dataOps/middleData.js'); try { U.registerUserOp(M.middleDataDef()); } catch (_) {} });
  await page.evaluate(() => window.openWiz('user_middle_data'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
  await page.evaluate(() => { const s = document.querySelector('#wiz_user_form [data-param="featureType"]'); if (s) { s.value = 'boss'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const form = document.getElementById('wiz_user_form');
    const segAuto = form.querySelector('[data-param="transAxis"] [data-value="auto"]'); if (segAuto) segAuto.click();
    const labSpan = Array.from(form.querySelectorAll('span')).find((sp) => (sp.textContent || '').trim() === 'Find Both Axes');
    const cb = labSpan && labSpan.parentElement && labSpan.parentElement.querySelector('.ddcs-switch input');
    if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const dt = document.querySelector('#wiz_user_form [data-param="diagTravel"]');
    const dp = document.querySelector('#wiz_user_form [data-param="diagPrimary"]');
    let dtAfter = null;
    if (dt) { dt.value = '42'; dt.dispatchEvent(new Event('input', { bubbles: true })); dtAfter = dt.value; }   // the ② drag writes it (programmatic)
    return { dtRendered: !!dt, dtReadonly: !!(dt && dt.readOnly), dpReadonly: !!(dp && dp.readOnly), dtAfter };
  });
  expect(r.dtRendered, 'the Diag Travel field renders (boss + probe-both)').toBe(true);
  expect(r.dtReadonly, 'Diag Travel (#21) renders READONLY — the ② drag is the sole editor').toBe(true);
  expect(r.dpReadonly, 'Diag Primary (#22) renders READONLY').toBe(true);
  expect(r.dtAfter, 'the ② drag (a programmatic write) STILL lands on the readonly field (readOnly blocks USER typing only)').toBe('42');
});
