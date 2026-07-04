import { test, expect } from '@playwright/test';

/**
 * ATC FIXED-STATION DEVICES (P-C.2b, t179) — the M350 pneumatics modelled + animated at the push station: a PUSHER
 * (piston whose rod extends toward the push-end) + a LOCATING PIN (rises to engage). On the FIXED machine frame (raw
 * machine coords, WCS-independent, like the highlight/magazine). They ANIMATE on the pneumatic io_change (P-C.2a):
 * OUT_PUSHER open (M160) → extend / close (M161) → retract; OUT_LOCATING_PIN open (M156) → engage / close (M157) →
 * release. Armed ONLY for the firmware push choreography. SIM/VISUAL only → emit byte-identical. Asserts the VALUE.
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function viz(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
}

const REGION = { z: -10, start: { x: 200, y: 150 }, end: { x: 250, y: 150 }, retreat: { x: 300, y: 150 } };

test('(1) the devices are modelled at the station (WCS-independent) + transform on setStationDevice', async ({ page }) => {
  await viz(page);
  const build = (g54) => page.evaluate((off) => {
    const v = window.ddcsStudio.wizardManager._activePanel.viz;
    v.setStock({ show: false });
    v.setMachine({ x: 600, y: 400, z: -150, show: true, workOrigin: off, wcs: { active: 1, table: [off, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }] } });
    v.setStationDevices({ z: -10, start: { x: 200, y: 150 }, end: { x: 250, y: 150 }, retreat: { x: 300, y: 150 } });
    return { pinX: +v._locatingPin.position.x.toFixed(0), pinY: +v._locatingPin.position.y.toFixed(0), rodRest: +v._pusherRod.position.x.toFixed(0), hasGroup: !!v._deviceGroup };
  }, g54);
  const a = await build({ x: 0, y: 0, z: 0 });
  const b = await build({ x: 200, y: 150, z: -40 });
  expect(a.hasGroup, 'a device group is built').toBe(true);
  expect({ x: a.pinX, y: a.pinY }, 'locating pin at the push-end station coords (250,150)').toEqual({ x: 250, y: 150 });
  expect({ x: b.pinX, y: b.pinY }, 'devices are WCS-independent (fixed frame)').toEqual({ x: a.pinX, y: a.pinY });
  // the transforms
  const t = await page.evaluate(() => {
    const v = window.ddcsStudio.wizardManager._activePanel.viz;
    const rodIn = v._pusherRod.position.x, pinDown = v._locatingPin.position.z;
    v.setStationDevice('pusher', true); const rodOut = v._pusherRod.position.x;
    v.setStationDevice('pin', true); const pinUp = v._locatingPin.position.z;
    v.setStationDevice('pusher', false); const rodBack = v._pusherRod.position.x;
    v.setStationDevice('pin', false); const pinBack = v._locatingPin.position.z;
    return { rodIn, rodOut, rodBack, pinDown, pinUp, pinBack };
  });
  expect(t.rodOut, 'pusher EXTENDS on true (rod x increases)').toBeGreaterThan(t.rodIn);
  expect(t.rodBack, 'pusher RETRACTS on false (back to rest)').toBe(t.rodIn);
  expect(t.pinUp, 'pin ENGAGES on true (rises)').toBeGreaterThan(t.pinDown);
  expect(t.pinBack, 'pin RELEASES on false (drops)').toBe(t.pinDown);
  await page.evaluate(() => { const v = window.ddcsStudio.wizardManager._activePanel.viz; v.setStationDevices(null); });
  const cleared = await page.evaluate(() => !!window.ddcsStudio.wizardManager._activePanel.viz._deviceGroup);
  expect(cleared, 'null clears the devices').toBe(false);
});

test('(2) a firmware push arms the devices; they transform on the pneumatic io_change (M160/M161/M156/M157)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.preview = s.preview || {}; s.preview.autoLoop = false; s.machine = { x: 600, y: 400, z: -150, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } }; });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('atc_change'));
  await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
  await page.evaluate(() => { const sel = document.getElementById('atc_change_method'); if (sel) { sel.value = 'firmware'; sel.dispatchEvent(new Event('change', { bubbles: true })); } window.ddcsStudio.wizardManager.update(); });
  await page.waitForTimeout(300);
  const r = await page.evaluate(async () => {
    const { atcChoreography } = await import('/wizards/atcChangeWizard.js');
    const host = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d');
    host.__panel.setAtcSwap(atcChoreography({ method: 'firmware' }), { z: -10, start: { x: 200, y: 150 }, end: { x: 250, y: 150 }, retreat: { x: 300, y: 150 } });
    const v = host.__panel.viz;
    const built = !!v._deviceGroup;
    const fire = (pin, state) => window.dispatchEvent(new CustomEvent('io_change', { detail: { pin, state } }));
    const rodRest = v._pusherRod.position.x, pinRest = v._locatingPin.position.z;
    fire('OUT_PUSHER', true); const rodExt = v._pusherRod.position.x;      // M160
    fire('OUT_LOCATING_PIN', true); const pinEng = v._locatingPin.position.z; // M156
    fire('OUT_PUSHER', false); const rodRet = v._pusherRod.position.x;     // M161
    fire('OUT_LOCATING_PIN', false); const pinRel = v._locatingPin.position.z; // M157
    return { built, rodRest, rodExt, rodRet, pinRest, pinEng, pinRel };
  });
  expect(r.built, 'the firmware push armed the station devices').toBe(true);
  expect(r.rodExt, 'M160 (OUT_PUSHER open) EXTENDS the pusher').toBeGreaterThan(r.rodRest);
  expect(r.rodRet, 'M161 (OUT_PUSHER close) RETRACTS it').toBe(r.rodRest);
  expect(r.pinEng, 'M156 (OUT_LOCATING_PIN open) ENGAGES the pin').toBeGreaterThan(r.pinRest);
  expect(r.pinRel, 'M157 (OUT_LOCATING_PIN close) RELEASES it').toBe(r.pinRest);
});

test('(3) end-to-end: a real firmware push PLAY animates the devices via the engine io_change', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.preview = s.preview || {}; s.preview.autoLoop = false; s.machine = { x: 600, y: 400, z: -150, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } }; });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('atc_change'));
  await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
  await page.evaluate(() => { const sel = document.getElementById('atc_change_method'); if (sel) { sel.value = 'firmware'; sel.dispatchEvent(new Event('change', { bubbles: true })); } window.ddcsStudio.wizardManager.update(); });
  await page.waitForTimeout(300);
  await page.evaluate(async () => {
    const { atcChoreography, atcChangeStack } = await import('/wizards/atcChangeWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const host = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d');
    host.__panel.setAtcSwap(atcChoreography({ method: 'firmware' }), { z: -10, start: { x: 200, y: 150 }, end: { x: 250, y: 150 }, retreat: { x: 300, y: 150 } });
    const sv = '#1306=-10\n#1320=200\n#1321=150\n#1322=100\n#1323=250\n#1324=150\n#1325=300\n#1326=150\n#563=3000\n#1327=500\n';
    host.__gcode = sv + emitMapped(atcChangeStack({ method: 'firmware', callMacro: false })).text;   // INC-B: the inline O10102 dance (default is now a T# M6 call)
    host.querySelector('.pp-run').click();
  });
  // the firmware sequence ends with M156 (locating OPEN → engage) + M161 (pusher CLOSE → retract): wait for the pin to engage
  await page.waitForFunction(() => { const v = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__panel.viz; return v && v._locatingPin && Math.abs(v._locatingPin.position.z - v._PIN_UP) < 0.01; }, null, { timeout: 8000 });
  const pinEngaged = await page.evaluate(() => { const v = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__panel.viz; return Math.abs(v._locatingPin.position.z - v._PIN_UP) < 0.01; });
  expect(pinEngaged, 'the real M156 io_change during play engaged the locating pin (end-to-end)').toBe(true);
});

test('(4) a NON-firmware method (m6) arms NO devices', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.machine = { x: 600, y: 400, z: -150, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } }; });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('atc_change'));
  await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
  await page.evaluate(() => { const sel = document.getElementById('atc_change_method'); if (sel) { sel.value = 'm6'; sel.dispatchEvent(new Event('change', { bubbles: true })); } window.ddcsStudio.wizardManager.update(); });
  await page.waitForTimeout(400);
  const hasDevices = await page.evaluate(() => { const v = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__panel.viz; return !!v._deviceGroup; });
  expect(hasDevices, 'm6 (macro-call, not a push) → no station devices').toBe(false);
});
