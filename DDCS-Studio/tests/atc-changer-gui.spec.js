import { test, expect } from '@playwright/test';

/**
 * ATC CHANGER composer GUI (RE-PLAN #2, I3) — the two doors to the ONE declared changer config: a PRESET LIBRARY +
 * a FROM-ZERO composer (layout × grip × motion), writing settings.atc.{grip, motion, layout}. The I2 seam reads that
 * config (atcChoreography → atcCombo) so the SIM reflects the chosen changer. Byte-identical for the 3 presets (emit
 * still method-driven). Asserts the VALUE: presets set the config, the config drives the choreo, save-as-preset persists.
 */
test.use({ viewport: { width: 1280, height: 1000 } });

async function openAtc(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.openSettings);
  await page.evaluate(() => {
    const s = window.ddcsGetSettings();
    s.machine = { x: 600, y: 400, z: -120, show: true };
    s.hardwareTabs = s.hardwareTabs || {}; s.hardwareTabs.atc = true;
    s.atc = s.atc || {};
    delete s.atc.grip; delete s.atc.motion; delete s.atc.layout; s.atc.userPresets = [];
    window.ddcsSaveSettings && window.ddcsSaveSettings();
    window.openSettings({ group: 'hardware', panel: 'set_tab_atc' });
  });
  await page.waitForSelector('#atc_changer [data-atc-preset]', { timeout: 8000 });
}

const set = (page, attr, v) => page.evaluate(({ attr, v }) => { const s = document.querySelector(`#atc_changer [${attr}]`); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, { attr, v });
const readCfg = (page) => page.evaluate(() => { const a = window.ddcsGetSettings().atc; return { grip: a.grip, motion: a.motion, layout: a.layout }; });

test('the PRESET LIBRARY lists the presets (relabeled) and picking one sets settings.atc.{grip,motion,layout}', async ({ page }) => {
  await openAtc(page);
  const opts = await page.evaluate(() => [...document.querySelectorAll('#atc_changer [data-atc-preset] option')].map((o) => o.textContent));
  // "firmware" is relabeled "Push station" (NOT pneumatic-push); the candidate RapidChange is listed
  expect(opts, 'the library lists the relabeled presets').toEqual(expect.arrayContaining(['Push station', 'Drawbar pick & place', 'Disk carousel', 'RapidChange (candidate)']));
  expect(opts.join(' '), 'no "firmware" / "pneumatic" labels').not.toMatch(/firmware|pneumatic/i);
  await set(page, 'data-atc-preset', 'builtin:firmware');
  expect(await readCfg(page), 'Push station preset → the composable config (grip named by MECHANISM: pusher)').toEqual({ grip: 'pusher', motion: 'push', layout: 'station' });
});

test('the declared config DRIVES the sim — the choreo from settings.atc == the method choreo (identical)', async ({ page }) => {
  await openAtc(page);
  await set(page, 'data-atc-preset', 'builtin:disk');
  const r = await page.evaluate(async () => {
    const { atcChoreography } = await import('/wizards/atcModel.js');
    const atc = window.ddcsGetSettings().atc;
    return { fromConfig: atcChoreography({}, atc), fromMethod: atcChoreography({ method: 'disk' }) };   // config-driven vs the old method path
  });
  // the settings override (no method) yields the SAME descriptor the disk method did → sim identical
  expect(r.fromConfig, 'the declared config drives the disk carousel choreo').toMatchObject({ kind: 'pick-place', variant: 'carousel', device: 'collet' });
  expect(r.fromConfig.kind).toBe(r.fromMethod.kind);
  expect(r.fromConfig.variant).toBe(r.fromMethod.variant);
});

test('the FROM-ZERO composer builds a config (layout × grip × motion) — RapidChange-shaped', async ({ page }) => {
  await openAtc(page);
  await set(page, 'data-atc-layout', 'linear');
  await set(page, 'data-atc-grip', 'magnet');
  await set(page, 'data-atc-motion', 'plunge');
  expect(await readCfg(page), 'a from-zero magnet+plunge (RapidChange) config').toEqual({ grip: 'magnet', motion: 'plunge', layout: 'linear' });
});

test('SAVE AS PRESET persists the current config and it reappears in the library', async ({ page }) => {
  await openAtc(page);
  await set(page, 'data-atc-grip', 'drawbar');
  await set(page, 'data-atc-motion', 'pick-place');
  await page.evaluate(() => {
    document.querySelector('#atc_changer [data-atc-savename]').value = 'My changer';
    document.querySelector('#atc_changer [data-atc-save]').click();
  });
  const saved = await page.evaluate(() => window.ddcsGetSettings().atc.userPresets);
  expect(saved.length, 'one user preset persisted').toBe(1);
  expect(saved[0], 'it holds the composed config').toMatchObject({ name: 'My changer', grip: 'drawbar', motion: 'pick-place' });
  const inLib = await page.evaluate(() => [...document.querySelectorAll('#atc_changer [data-atc-preset] option')].some((o) => /My changer/.test(o.textContent)));
  expect(inLib, 'the saved preset reappears in the library').toBe(true);
});
