import { test, expect } from '@playwright/test';

/**
 * ATC IO LABELED + LIVE in the io tab from the Settings config (P-C.2c-revised, t183). The io tab READS the config
 * output rows and LABELS each assigned ATC pin with its function; it TIES the sim's semantic outputs to the numbered
 * pins via the M-CODE (config.onCode → engine ATC_DIALECT → the OUT_ pin), so a firmware push lights the labeled pins
 * live in the existing numbered tab (watch the handshake in order — no new panel). Also fixes the stale dust-cover
 * M-code (M305/306 → M162/163). SIM/UI only → emit byte-identical. Asserts the VALUE.
 */
test.use({ viewport: { width: 1280, height: 900 } });

test('(0) the dust-cover output TYPE uses M162/M163 (not the stale M305/M306)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const t = await page.evaluate(async () => {
    const { OUTPUT_TYPES } = await import('/ui/ioTable.js');
    return OUTPUT_TYPES.find((x) => x.type === 'dustcover');
  });
  expect(t.onCode, 'dust cover ON = M162').toBe('M162');
  expect(t.offCode, 'dust cover OFF = M163').toBe('M163');
});

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
    new GcodeExecutionEngine({ autoAnswer: true }).trace(sv + emitMapped(atcChangeStack({ method: 'firmware' })).text);
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
