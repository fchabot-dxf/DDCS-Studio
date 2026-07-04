import { test, expect } from '@playwright/test';

/**
 * ATC PIN-PICKER (GUI-3) — assign the ATC I/O pins visually. A PEER editor of the general I/O tables: it writes the
 * SAME settings.outputs / settings.inputs `.pin` the io-labeling reads, so assigning a pin here lights it in the I/O
 * panel (the P-C.2c/d join, on the row's canonical onCode/waitCode → ATC_DIALECT). One source, no duplicated data.
 * Free/taken aware — a pin can't map to two functions. SIM/UI only → emit byte-identical. Asserts the VALUE.
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function openAtc(page, seed) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.ddcsStudio && window.ioPanel);
  await page.evaluate((seed) => {
    const s = window.ddcsGetSettings();
    s.hardwareTabs = s.hardwareTabs || {}; s.hardwareTabs.atc = true;
    s.outputs = seed.outputs.slice(); s.inputs = seed.inputs.slice();
    s.atc = s.atc || {};
    window.ddcsSaveSettings && window.ddcsSaveSettings();
    window.openSettings({ group: 'hardware', panel: 'set_tab_atc' });
  }, seed);
  await page.waitForSelector('#atc_pin_picker [data-atc-pin="drawbar"]', { timeout: 8000 });
}

const assign = (page, key, val) => page.evaluate(({ key, val }) => {
  const s = document.querySelector(`#atc_pin_picker [data-atc-pin="${key}"]`);
  s.value = String(val); s.dispatchEvent(new Event('change', { bubbles: true }));
}, { key, val });

test('assigning an ATC OUTPUT pin writes the config row AND the io-tab lights it (the join)', async ({ page }) => {
  await openAtc(page, { outputs: [], inputs: [] });
  await assign(page, 'drawbar', 5);   // no row yet → created with the canonical M154
  const r = await page.evaluate(() => {
    const row = window.ddcsGetSettings().outputs.find((r) => String(r.onCode).includes('154'));
    window.ioPanel._deriveAtcMap();
    return { pin: row && row.pin, onCode: row && row.onCode, group: row && row.group, map: window.ioPanel._atcOutMap[5] };
  });
  expect(r.pin, 'the config .pin field updated to 5').toBe(5);
  expect(r.onCode, 'the created row carries the canonical M-code (the labeling join key)').toBe('M154');
  expect(r.group, 'tagged as an ATC row').toBe('atc');
  expect(r.map && r.map.semanticPin, 'the io-tab derives a semantic pin for pin 5 → it lights').toBeTruthy();
  expect(r.map && r.map.label, 'the pin is labeled with the function').toBeTruthy();
});

test('assigning an ATC INPUT pin (separate pin space) writes settings.inputs and lights it', async ({ page }) => {
  await openAtc(page, { outputs: [], inputs: [] });
  await assign(page, 'spindle_stopped', 3);
  const r = await page.evaluate(() => {
    const row = window.ddcsGetSettings().inputs.find((r) => r.group === 'atc' && String(r.waitCode).includes('300'));
    window.ioPanel._deriveAtcMap();
    return { pin: row && row.pin, waitCode: row && row.waitCode, map: window.ioPanel._atcInMap[3] };
  });
  expect(r.pin, 'the input .pin field updated to 3').toBe(3);
  expect(r.waitCode, 'the created sensor carries the DECLARED waitCode (the join key)').toBe('M300');
  expect(r.map && r.map.semanticPin, 'the io-tab derives the input semantic pin → it lights').toBeTruthy();
});

test('a taken pin is disabled so a pin cannot map to two functions (conflict prevented)', async ({ page }) => {
  await openAtc(page, { outputs: [], inputs: [] });
  await assign(page, 'drawbar', 5);
  // pin 5 is now taken by the drawbar → every OTHER output function has pin 5 disabled
  const r = await page.evaluate(() => {
    const dust = document.querySelector('#atc_pin_picker [data-atc-pin="dust"]');
    const opt5 = [...dust.options].find((o) => o.value === '5');
    // inputs are a SEPARATE pin space → pin 5 is still free for an input
    const spin = document.querySelector('#atc_pin_picker [data-atc-pin="spindle_stopped"]');
    const inOpt5 = [...spin.options].find((o) => o.value === '5');
    return { outputTaken: !!(opt5 && opt5.disabled), inputFree: !!(inOpt5 && !inOpt5.disabled) };
  });
  expect(r.outputTaken, 'pin 5 disabled for another OUTPUT (no double-assign)').toBe(true);
  expect(r.inputFree, 'pin 5 still free for an INPUT (separate pin bank)').toBe(true);
});

test('ONE-SOURCE: the picker reflects a pin set in the config, and clearing it frees the pin', async ({ page }) => {
  await openAtc(page, { outputs: [{ id: 'drawbar_atc', type: 'drawbar', label: 'Drawbar (ATC)', pin: 7, onCode: 'M154', offCode: 'M155', group: 'atc' }], inputs: [] });
  // the picker shows the existing config pin (7), not a duplicate
  const shown = await page.evaluate(() => document.querySelector('#atc_pin_picker [data-atc-pin="drawbar"]').value);
  expect(shown, 'the picker reads the existing config .pin (one source)').toBe('7');
  await assign(page, 'drawbar', '');   // clear
  const after = await page.evaluate(() => {
    const row = window.ddcsGetSettings().outputs.find((r) => String(r.onCode).includes('154'));
    return { pin: row && row.pin, count: window.ddcsGetSettings().outputs.filter((r) => String(r.onCode).includes('154')).length };
  });
  expect(after.pin, 'clearing frees the pin (no duplicate row created)').toBe('');
  expect(after.count, 'still ONE drawbar row — matched, not duplicated').toBe(1);
});
