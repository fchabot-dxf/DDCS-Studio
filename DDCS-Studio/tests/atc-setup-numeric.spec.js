import { test, expect } from '@playwright/test';

/**
 * NUMERIC + PARAMETRIC ATC setup (GUI-2) — the human redirect: precision comes from XY COORD FIELDS + pattern params
 * (disk Ø + count, linear length + count), not drag. The numeric fields/table are the primary editor; the canvas is a
 * read-back + coarse drag. SIM/UI only: pockets write the existing config (emit reflects it); the firmware fields write
 * the settings.atc.firmwareStation store that var-seeds the sim (never pushed to the controller). Asserts the VALUE.
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function openAtcTab(page, seed) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate((seed) => {
    const s = window.ddcsGetSettings();
    s.machine = { x: 600, y: 400, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
    s.hardwareTabs = s.hardwareTabs || {}; s.hardwareTabs.atc = true;
    s.atc = s.atc || {};
    Object.assign(s.atc, seed);
    window.ddcsSaveSettings && window.ddcsSaveSettings();
    window.openSettings({ group: 'hardware', panel: 'set_tab_atc' });
  }, seed);
  await page.waitForSelector('#atc_magazine', { timeout: 8000 });
}

test('LINEAR: an origin + LENGTH + count generates evenly-spaced pockets (pitch = length ÷ (count−1))', async ({ page }) => {
  await openAtcTab(page, {
    magType: 'straight', firmwareStation: null, tools: [],
    magazine: [{ pocket: 1, tool: '', x: 10, y: 5, z: -50 }, { pocket: 2, tool: '', x: '', y: '', z: '' }, { pocket: 3, tool: '', x: '', y: '', z: '' }, { pocket: 4, tool: '', x: '', y: '', z: '' }],
  });
  // set Length = 90 over 4 pockets on X, then Fill from P1 (the real UI gesture)
  await page.evaluate(() => {
    const len = document.querySelector('#atc_magazine [data-atc-len]');
    len.value = '90'; len.dispatchEvent(new Event('change', { bubbles: true }));
    const ax = document.querySelector('#atc_magazine [data-atc-line-axis]');
    ax.value = 'x'; ax.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#atc_magazine [data-atc-fill]').click();
  });
  const mag = await page.evaluate(() => window.ddcsGetSettings().atc.magazine.map((p) => ({ x: p.x, y: p.y, z: p.z })));
  // pitch = 90/(4−1) = 30 → P1..P4 at x = 10, 40, 70, 100; y/z carried from the origin P1
  expect(mag.map((p) => p.x), 'evenly spaced over the length from P1').toEqual([10, 40, 70, 100]);
  expect(mag.every((p) => p.y === 5 && p.z === -50), 'the off-axis coords carry from the origin').toBe(true);
});

test('DISK: diameter + pocket count lays the ring (count pockets, each at Ø/2 from the carousel centre)', async ({ page }) => {
  await openAtcTab(page, { magType: 'disk', pickup: { x: 150, y: 100, z: -40 }, diskDia: 120, diskAxis: '+y', firmwareStation: null, magazine: [{ pocket: 1, tool: '' }, { pocket: 2, tool: '' }] });
  // set the pocket COUNT to 8 via the numeric field (the parametric input)
  await page.evaluate(() => { const c = document.querySelector('#atc_magazine [data-atc-count]'); c.value = '8'; c.dispatchEvent(new Event('change', { bubbles: true })); });
  const r = await page.evaluate(async () => {
    const { magazinePockets } = await import('/wizards/views/atcViews.js');
    const atc = window.ddcsGetSettings().atc;
    const ring = magazinePockets(atc);
    const R = atc.diskDia / 2;
    // carousel centre = pickup offset by R along the axis (+y here)
    const cx = atc.pickup.x, cy = atc.pickup.y + R;
    const radii = ring.map((p) => Math.round(Math.hypot(p.x - cx, p.y - cy)));
    return { count: ring.length, magLen: atc.magazine.length, R, radii };
  });
  expect(r.magLen, 'the count field built 8 pockets').toBe(8);
  expect(r.count, 'the ring has one position per pocket').toBe(8);
  expect(r.radii.every((d) => d === Math.round(r.R)), 'every pocket sits on the carousel radius (Ø/2 = 60)').toBe(true);
});

test('FIRMWARE: typing the push-station coords writes the store AND the sim station renders the exact values', async ({ page }) => {
  await openAtcTab(page, { magType: 'straight', firmwareStation: null, magazine: [] });
  // type the precise station coords (the human: "xy coord field, not drag")
  await page.evaluate(() => {
    const set = (id, v) => { const e = document.querySelector('#' + id); e.value = String(v); e.dispatchEvent(new Event('change', { bubbles: true })); };
    set('atc_fw_sx', 321); set('atc_fw_sy', 222); set('atc_fw_ex', 340); set('atc_fw_ey', 222); set('atc_fw_safez', -15);
  });
  const st = await page.evaluate(() => window.ddcsGetSettings().atc.firmwareStation);
  expect(st.pushStart, 'the store holds the exact typed push-start').toEqual({ x: 321, y: 222 });
  expect(st.pushEnd, 'the store holds the exact typed push-end').toEqual({ x: 340, y: 222 });
  expect(st.safeZ, 'the store holds the exact typed safe-Z (#1306)').toBe(-15);
  // the sim station renders from the typed store (var-seed) — open the firmware wizard and read the region
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('atc_change'));
  await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
  await page.evaluate(() => { const sel = document.getElementById('atc_change_method'); sel.value = 'firmware'; sel.dispatchEvent(new Event('change', { bubbles: true })); window.ddcsStudio.wizardManager.update(); });
  await page.waitForFunction(() => { const v = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__panel.viz; return v && v._station; }, null, { timeout: 8000 });
  const region = await page.evaluate(() => document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__panel.viz._station);
  expect(Math.round(region.start.x), 'sim station push-start X = the typed value').toBe(321);
  expect(Math.round(region.start.y), 'sim station push-start Y = the typed value').toBe(222);
  expect(Math.round(region.end.x), 'sim station push-end X = the typed value').toBe(340);
  expect(Math.round(region.z), 'sim station safe-Z = the typed value').toBe(-15);
});
