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

// The form field is GREYED (disabled + Pr tooltip) when the field is 'ctrl'-sourced (post-field-gating — the value comes from
// the controller, not the literal). Studio/default → the field is a normal editable input.
test('source-chips: the probe-config form field is GREYED (disabled + Pr tooltip) when ctrl-sourced', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsSetProbeSrc && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js');
    const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
    localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef());
    setActiveProfile('ddcs-expert-m350'); window.ddcsSetProbeSrc('port', 'studio');
  });
  // studio (default): the port field is a normal editable input
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form [data-param="port"]', { state: 'visible' });
  const studio = await page.evaluate(() => { const i = document.querySelector('#wiz_user_form [data-param="port"]'); return { disabled: !!(i && i.disabled) }; });

  // flip port → ctrl, re-open → the field is greyed (disabled) + tooltipped with its Pr
  await page.evaluate(() => { window.ddcsSetProbeSrc('port', 'ctrl'); window.openWiz('user_corner_data'); });
  await page.waitForSelector('#wiz_user_form [data-param="port"]', { state: 'visible' });
  const ctrl = await page.evaluate(() => { const i = document.querySelector('#wiz_user_form [data-param="port"]'); return { disabled: !!(i && i.disabled), title: (i && i.title) || '' }; });
  await page.evaluate(() => window.ddcsSetProbeSrc('port', 'studio'));

  expect(studio.disabled, 'studio: the port field is editable (not greyed)').toBe(false);
  expect(ctrl.disabled, 'ctrl: the port field is greyed (disabled — the controller provides it)').toBe(true);
  expect(ctrl.title, 'the tooltip names the controller Pr').toContain('Pr578');
});
