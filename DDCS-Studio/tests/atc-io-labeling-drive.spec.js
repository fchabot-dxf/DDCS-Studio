import { test, expect } from '@playwright/test';

/**
 * ATC IO LABELED + LIVE in the io tab from the Settings config (P-C.2c-revised, t183) — split from
 * atc-io-labeling.spec.js at the tier migration. 2 of the file's 7 tests moved to
 * tests/node/atc-io-labeling.test.mjs (pure — a plain module lookup and a plain data-migration call, no DOM). These
 * 5 stayed: each renders a real `window.ioPanel.show()` panel and reads real DOM (`.io-output`/`.io-input` elements'
 * `.classList`/`.textContent`), or builds a real DOM tree and queries it (`document.createElement` + `querySelector`,
 * a real `<input>`'s `dispatchEvent`) — register.mjs's document is structural-only (querySelector always returns
 * null, dispatchEvent never invokes listeners), so none of this can run in the node tier.
 */
test.use({ viewport: { width: 1280, height: 900 } });

test('(1) assigned ATC pins are LABELED from the config + light LIVE on the sim semantic output (M-code join)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ioPanel && window.ddcsGetSettings && window.virtualIO);
  const r = await page.evaluate(async () => {
    const s = window.ddcsGetSettings();
    s.outputs = [
      { id: 'o1', type: 'custom', label: 'Pusher', pin: 5, onCode: 'M160', offCode: 'M161' },
      { id: 'o2', type: 'custom', label: 'Locating pin', pin: 6, onCode: 'M156', offCode: 'M157' },
      { id: 'o3', type: 'dustcover', label: 'Dust cover', pin: 7, onCode: 'M162', offCode: 'M163' },
    ];
    window.ioPanel.show();
    const lbl = (p) => { const e = document.querySelector(`.io-output[data-pin="${p}"] .io-atc-label`); return e ? e.textContent : null; };
    // run a real firmware push (trace resets the IO, then the M156-161 set the semantic outputs)
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const { atcChangeStack } = await import('/wizards/atcChangeWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const sv = '#1306=-10\n#1320=200\n#1321=150\n#1322=100\n#1323=250\n#1324=150\n#1325=300\n#1326=150\n#563=3000\n#1327=500\n';
    new GcodeExecutionEngine({ autoAnswer: true }).trace(sv + emitMapped(atcChangeStack({ method: 'firmware', callMacro: false })).text);   // INC-B: the inline O10102 dance (default is now a T# M6 call)
    window.ioPanel.refresh();
    const lit = (p) => document.querySelector(`.io-output[data-pin="${p}"]`).classList.contains('active');
    return { lblPusher: lbl(5), lblLocating: lbl(6), lblDust: lbl(7), locatingLit: lit(6), pusherLit: lit(5) };
  });
  // LABELS from the config (one-source)
  expect(r.lblPusher, 'pin 5 labeled Pusher').toBe('Pusher');
  expect(r.lblLocating, 'pin 6 labeled Locating pin').toBe('Locating pin');
  expect(r.lblDust, 'pin 7 labeled Dust cover').toBe('Dust cover');
  // LIVE via the M-code join: the firmware push ends with M156 (locating engage → OUT_LOCATING_PIN true) + M161
  // (pusher retract → OUT_PUSHER false), so the LABELED locating pin lights + the pusher does not — the sim semantic
  // output flowed to the numbered pin the config assigned.
  expect(r.locatingLit, 'the Locating-pin pin lit (OUT_LOCATING_PIN via M156, the config join)').toBe(true);
  expect(r.pusherLit, 'the Pusher pin is off after the push (M161 retract)').toBe(false);
});

test('(2) the dust pin reflects M162/M163 (OUT_DUST_COVER), NOT M305/M306 (which is the gripper)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ioPanel && window.ddcsGetSettings && window.virtualIO);
  const r = await page.evaluate(() => {
    const s = window.ddcsGetSettings();
    s.outputs = [{ id: 'o3', type: 'dustcover', label: 'Dust cover', pin: 7, onCode: 'M162', offCode: 'M163' }];
    window.ioPanel.show();
    const lit = () => document.querySelector('.io-output[data-pin="7"]').classList.contains('active');
    window.virtualIO.reset(); window.virtualIO.setOutput('OUT_DUST_COVER', true); window.ioPanel.refresh();   // as M162
    const onM162 = lit();
    window.virtualIO.reset(); window.virtualIO.setOutput('OUT_GRIPPER_OPEN', true); window.ioPanel.refresh();  // M305 (old wrong dust code → gripper)
    const onM305 = lit();
    return { onM162, onM305 };
  });
  expect(r.onM162, 'dust pin lights on OUT_DUST_COVER (M162)').toBe(true);
  expect(r.onM305, 'dust pin does NOT light on M305 (that is the gripper, not the dust cover)').toBe(false);
});

test('(3) ATC INPUT pins are LABELED from the config sensor rows + best-effort live-light (t185)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ioPanel && window.ddcsGetSettings && window.virtualIO);
  const r = await page.evaluate(() => {
    const s = window.ddcsGetSettings();
    s.inputs = [{ id: 'drawbar_released_atc', type: 'sensor', label: 'Drawbar released (M301)', pin: 3, level: 0, group: 'atc', waitCode: 'M301' }];
    window.ioPanel.show();
    const lbl = (p) => { const e = document.querySelector(`.io-input[data-pin="${p}"] .io-atc-label`); return e ? e.textContent : null; };
    const lit = (p) => document.querySelector(`.io-input[data-pin="${p}"]`).classList.contains('active');
    const before = lit(3);
    window.virtualIO.reset(); window.virtualIO.injectInput('IN_DRAWBAR_OPEN', true); window.ioPanel.refresh();   // the M301 sensor fires (a generic/disk wait)
    return { label: lbl(3), before, after: lit(3) };
  });
  expect(r.label, 'input pin 3 labeled from the config sensor row (row.label)').toBe('Drawbar released (M301)');
  expect(r.before, 'not lit before the sensor fires').toBe(false);
  expect(r.after, 'lights when IN_DRAWBAR_OPEN fires (join via the DECLARED waitCode M301)').toBe(true);
});

test('(4) the config label is EDITABLE (bound to row.label) + the io tab reflects the new label (t185)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ioPanel && window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    const { renderIoTable } = await import('/ui/ioTable.js');
    const s = window.ddcsGetSettings();
    s.outputs = [{ id: 'o1', type: 'custom', label: 'Pusher', pin: 5, onCode: 'M160', offCode: 'M161' }];
    const cont = document.createElement('div'); document.body.appendChild(cont);
    let saved = 0;
    renderIoTable(cont, 'output', s.outputs, () => { saved++; });
    const labelInput = cont.querySelector('input[type="text"]');   // the editable label field (first text input in the row)
    const before = labelInput.value;
    labelInput.value = 'Big Pusher';
    labelInput.dispatchEvent(new Event('change', { bubbles: true }));
    const rowLabel = s.outputs[0].label;
    window.ioPanel.show();   // re-derives labels from the (now edited) config
    const ioLabel = (document.querySelector('.io-output[data-pin="5"] .io-atc-label') || {}).textContent;
    cont.remove();
    return { before, rowLabel, saved, ioLabel };
  });
  expect(r.before, 'the label field defaults to the config label').toBe('Pusher');
  expect(r.rowLabel, 'editing the field writes row.label (ONE SOURCE)').toBe('Big Pusher');
  expect(r.saved, 'onChange persisted the edit').toBeGreaterThan(0);
  expect(r.ioLabel, 'the io tab reflects the NEW label').toBe('Big Pusher');
});

test('(5) RENAME-PROOF (t189 declare-fix): the input live-light joins on the DECLARED waitCode, NOT the label text', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ioPanel && window.ddcsGetSettings && window.virtualIO);
  const r = await page.evaluate(() => {
    const s = window.ddcsGetSettings();
    // a RENAMED sensor: the label has NO M-code (the old label-parse would find nothing), but waitCode is declared
    s.inputs = [{ id: 'drawbar_released_atc', type: 'sensor', label: 'My spindle drawbar', pin: 3, level: 0, group: 'atc', waitCode: 'M301' }];
    window.ioPanel.show();
    const lbl = (document.querySelector('.io-input[data-pin="3"] .io-atc-label') || {}).textContent;
    const lit = () => document.querySelector('.io-input[data-pin="3"]').classList.contains('active');
    window.virtualIO.reset(); window.virtualIO.injectInput('IN_DRAWBAR_OPEN', true); window.ioPanel.refresh();
    return { lbl, lit: lit() };
  });
  expect(r.lbl, 'the RENAMED label shows (no M-code in it)').toBe('My spindle drawbar');
  expect(r.lit, 'the sensor STILL lights the renamed pin — driven by the declared waitCode, not the label').toBe(true);
});
