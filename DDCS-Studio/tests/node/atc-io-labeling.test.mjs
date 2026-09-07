import { test, expect } from './support/harness.mjs';

/**
 * ATC IO LABELED + LIVE in the io tab from the Settings config (P-C.2c-revised, t183). The io tab READS the config
 * output rows and LABELS each assigned ATC pin with its function; it TIES the sim's semantic outputs to the numbered
 * pins via the M-CODE (config.onCode → engine ATC_DIALECT → the OUT_ pin), so a firmware push lights the labeled pins
 * live in the existing numbered tab (watch the handshake in order — no new panel). Also fixes the stale dust-cover
 * M-code (M305/306 → M162/163). SIM/UI only → emit byte-identical. Asserts the VALUE.
 *
 * TIER MIGRATION — moved browser→node. Only 2 of the file's 7 tests are pure (no DOM at all — a plain module lookup
 * and a plain data-migration call). The other 5 render a real `window.ioPanel.show()` panel and read real DOM
 * (`.io-output`/`.io-input` elements' `.classList`/`.textContent`, a real `<input>`'s `dispatchEvent`, a real
 * `document.createElement` tree queried with `querySelector`) — register.mjs's document is structural-only
 * (querySelector always returns null, dispatchEvent never invokes listeners), so none of that can run here. Those
 * 5 moved to tests/atc-io-labeling-drive.spec.js.
 */
test('(0) the dust-cover output TYPE uses M162/M163 (not the stale M305/M306)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const t = await page.evaluate(async () => {
    const { OUTPUT_TYPES } = await import('/ui/ioTable.js');
    return OUTPUT_TYPES.find((x) => x.type === 'dustcover');
  });
  expect(t.onCode, 'dust cover ON = M162').toBe('M162');
  expect(t.offCode, 'dust cover OFF = M163').toBe('M163');
});

test('(6) migrateIO backfills the declared waitCode on legacy ATC sensor rows (no waitCode → M301 by id)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const wc = await page.evaluate(async () => {
    const { migrateIO } = await import('/ui/settingsPanel.js');
    const s = { inputs: [{ id: 'drawbar_released_atc', type: 'sensor', label: 'Drawbar released', pin: 3, level: 0, group: 'atc' }], outputs: [] };
    migrateIO(s);
    return s.inputs[0].waitCode;
  });
  expect(wc, 'legacy row (no waitCode) backfilled to M301 by its stable id').toBe('M301');
});
