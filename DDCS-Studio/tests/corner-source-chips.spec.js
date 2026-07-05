import { test, expect } from '@playwright/test';

/**
 * SOURCE-CHIPS (t87) — the "Corner (data)" twin sources its probe-config fields from the CONTROLLER when the user opts a field
 * to 'ctrl' (on a profile with a native register), EXACT parity with the built-in's srcVal/srcNote. Corner sources port(#5)/
 * fastFeed(#3)/retract(#2); `level` stays baked. Expert-only + opt-in → STUDIO (the default) / non-Expert → byte-identical.
 * (Applied post-emit because the M2 template is fixed at def-creation; reuses the SAME srcVal/srcNote as the built-in.)
 */
test('source-chips: Expert+ctrl emits the controller register (#5=#1078 + Pr note); studio default emits the literal (byte-identical)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsResolveProbeSources && window.ddcsSetProbeSrc);
  const r = await page.evaluate(async () => {
    const { cornerDataDef, CORNER_DEFAULTS, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
    registerUserOp(cornerDataDef());
    const build = builderOf(CORNER_DATA_OPTYPE);
    const emit = () => emitMapped(build({ ...CORNER_DEFAULTS })).text;

    setActiveProfile('ddcs-expert-m350');                       // the Expert profile (native probe registers)
    ['port', 'fastFeed', 'retract'].forEach((f) => window.ddcsSetProbeSrc(f, 'studio'));
    const studioEmit = emit();                                  // DEFAULT (studio) → literals
    window.ddcsSetProbeSrc('port', 'ctrl');
    const portCtrlEmit = emit();                                // Expert + port 'ctrl' → #5 = the controller register
    ['port', 'fastFeed', 'retract'].forEach((f) => window.ddcsSetProbeSrc(f, 'ctrl'));
    const allCtrlEmit = emit();                                 // all 3 sourced
    ['port', 'fastFeed', 'retract'].forEach((f) => window.ddcsSetProbeSrc(f, 'studio'));  // reset
    const studioEmit2 = emit();

    // non-Expert profile → sources unavailable → literals even with 'ctrl' set
    setActiveProfile('generic');
    ['port', 'fastFeed', 'retract'].forEach((f) => window.ddcsSetProbeSrc(f, 'ctrl'));
    const genericEmit = emit();
    setActiveProfile('ddcs-expert-m350'); ['port', 'fastFeed', 'retract'].forEach((f) => window.ddcsSetProbeSrc(f, 'studio'));

    const line = (t, v) => (t.split('\n').find((l) => new RegExp('#' + v + '\\s*=').test(l)) || '').trim();
    return {
      studioP5: line(studioEmit, 5), ctrlP5: line(portCtrlEmit, 5),
      allP5: line(allCtrlEmit, 5), allP3: line(allCtrlEmit, 3), allP2: line(allCtrlEmit, 2),
      studioIdempotent: studioEmit === studioEmit2,             // studio → byte-identical, twice
      genericP5: line(genericEmit, 5),                          // non-Expert → literal even with ctrl set
    };
  });

  // DEFAULT (studio): #5 = the literal port (CORNER_DEFAULTS.port = 3), NOT a controller var.
  expect(r.studioP5, `studio: #5 = the literal port, got "${r.studioP5}"`).toMatch(/#5\s*=\s*3\b/);
  expect(r.studioP5).not.toContain('#1078');
  // Expert + port 'ctrl': #5 = the controller register #1078 + the Pr578 note (parity with the built-in's srcVal/srcNote).
  expect(r.ctrlP5, `port ctrl: #5 = #1078, got "${r.ctrlP5}"`).toMatch(/#5\s*=\s*#1078/);
  expect(r.ctrlP5, 'the controller Pr578 note is emitted').toContain('Pr578');
  // all 3 sourced: #5=#1078 (port), #3=#632 (fastFeed), #2=#640 (retract).
  expect(r.allP5).toMatch(/#5\s*=\s*#1078/);
  expect(r.allP3, `fastFeed ctrl: #3 = #632, got "${r.allP3}"`).toMatch(/#3\s*=\s*#632/);
  expect(r.allP2, `retract ctrl: #2 = #640, got "${r.allP2}"`).toMatch(/#2\s*=\s*#640/);
  // studio is byte-identical across builds; non-Expert profile → literal even when 'ctrl' is set (no native register).
  expect(r.studioIdempotent, 'studio emit is stable/byte-identical').toBe(true);
  expect(r.genericP5, 'Generic profile has no native probe var → literal even with ctrl set').toMatch(/#5\s*=\s*3\b/);
});

// t289 — the data-op form gets the SAME inline source DOT the built-in forms use: it's present on the sourced fields,
// click toggles studio↔controller, ctrl-mode LOCKS via readOnly + data-op-gated (NOT disabled — postGating re-enables
// disabled), the glyph carries the Pr, and the EMIT follows the toggle.
test('source-chips: the data-op form shows the inline source dot; click flips ctrl↔studio (readOnly + data-op-gated) and the EMIT follows', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsSetProbeSrc && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js');
    const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
    localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef());
    setActiveProfile('ddcs-expert-m350'); ['port', 'fastFeed', 'retract'].forEach((f) => window.ddcsSetProbeSrc(f, 'studio'));
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form [data-param="port"]', { state: 'visible' });

  const glyphSel = (p) => `#wiz_user_form [data-param="${p}"]`;
  // (a) the dot is present on the 3 sourced fields (port/f_fast/retract), ABSENT on a non-sourced field (f_slow)
  const dots = await page.evaluate(() => {
    const has = (p) => { const i = document.querySelector(`#wiz_user_form [data-param="${p}"]`); const w = i && i.closest('.psrc-wrap'); return !!(w && w.querySelector('.psrc-glyph')); };
    return { port: has('port'), f_fast: has('f_fast'), retract: has('retract'), f_slow: has('f_slow') };
  });
  expect(dots.port, 'port has the source dot').toBe(true);
  expect(dots.f_fast, 'fast-feed has the source dot').toBe(true);
  expect(dots.retract, 'retract has the source dot').toBe(true);
  expect(dots.f_slow, 'a non-sourced field (slow feed) has NO dot').toBe(false);

  // studio (default): editable, not gated, dot unlit
  const studio = await page.evaluate((sel) => { const i = document.querySelector(sel); const btn = i.closest('.psrc-wrap').querySelector('.psrc-glyph'); return { readOnly: i.readOnly, gated: i.hasAttribute('data-op-gated'), lit: btn.classList.contains('psrc-lit') }; }, glyphSel('port'));
  expect(studio.readOnly, 'studio: editable (not readOnly)').toBe(false);
  expect(studio.gated, 'studio: not gated').toBe(false);
  expect(studio.lit, 'studio: dot unlit').toBe(false);

  // CLICK the port dot → flips to ctrl: locked (readOnly + data-op-gated + value=#1078, NOT disabled), dot lit, glyph names Pr578
  await page.evaluate((sel) => document.querySelector(sel).closest('.psrc-wrap').querySelector('.psrc-glyph').click(), glyphSel('port'));
  await page.waitForTimeout(250);   // setProbeSrc → ddcs:settings-changed → wizardManager.update() re-renders
  const ctrl = await page.evaluate((sel) => { const i = document.querySelector(sel); const btn = i.closest('.psrc-wrap').querySelector('.psrc-glyph'); return { readOnly: i.readOnly, disabled: i.disabled, gated: i.hasAttribute('data-op-gated'), value: i.value, lit: btn.classList.contains('psrc-lit'), title: btn.title }; }, glyphSel('port'));
  expect(ctrl.readOnly, 'ctrl: locked via readOnly').toBe(true);
  expect(ctrl.disabled, 'ctrl: NOT disabled (postGating re-enables disabled)').toBe(false);
  expect(ctrl.gated, 'ctrl: data-op-gated declared (survives postGating)').toBe(true);
  expect(ctrl.value, 'ctrl: the field shows the controller register').toBe('#1078');
  expect(ctrl.lit, 'ctrl: the dot is lit').toBe(true);
  expect(ctrl.title, 'the glyph names the controller Pr578').toContain('Pr578');

  // the EMIT follows the toggle: rebuild → #5 = #1078 (the register), not the literal
  const emitLine = await page.evaluate(async () => {
    const { CORNER_DEFAULTS, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const t = emitMapped(builderOf(CORNER_DATA_OPTYPE)({ ...CORNER_DEFAULTS })).text;
    return (t.split('\n').find((l) => /#5\s*=/.test(l)) || '').trim();
  });
  expect(emitLine, 'the emit follows the toggle → #5 = #1078').toMatch(/#5\s*=\s*#1078/);

  await page.evaluate(() => { window.ddcsSetProbeSrc('port', 'studio'); localStorage.removeItem('ddcs_user_ops'); });
});

// A profile without the register (V4.1 / Generic) → NO dot at all (the UI is the documentation of what's controller-resident).
test('source-chips: a profile with no native register shows NO dot (graceful)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsSetProbeSrc);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js');
    const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
    localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef());
    setActiveProfile('generic');
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form [data-param="port"]', { state: 'visible' });
  const hasDot = await page.evaluate(() => { const i = document.querySelector('#wiz_user_form [data-param="port"]'); const w = i && i.closest('.psrc-wrap'); return !!(w && w.querySelector('.psrc-glyph')); });
  await page.evaluate(async () => { const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js'); setActiveProfile('ddcs-expert-m350'); localStorage.removeItem('ddcs_user_ops'); });
  expect(hasDot, 'Generic profile has no native probe var → no source dot').toBe(false);
});
