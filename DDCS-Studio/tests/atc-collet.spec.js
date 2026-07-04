import { test, expect } from '@playwright/test';

/**
 * PICK-PLACE choreography kind + the COLLET device (P-C.3a, t193). generic/disk resolve to a NEW 'pick-place' kind via
 * the seam; the spindle COLLET opens on M154 (OUT_SPINDLE_UNCLAMP) / closes on M155 (OUT_SPINDLE_CLAMP), driven by the
 * setAtcSwap io_change listener (reuses the P-C.2b device pattern, but on the SPINDLE — part frame). The input SENSOR
 * live-lighting activates (generic/disk wait on M300/301/302 → the io-tab pins light via the P-C.2f waitCode join).
 * SIM/VISUAL only → emit byte-identical. Asserts the VALUE.
 */
test.use({ viewport: { width: 1280, height: 900 } });

test('(1) the seam resolves generic/disk to the pick-place kind (firmware stays push, m6 macro-call)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const c = await page.evaluate(async () => {
    const { atcChoreography } = await import('/wizards/atcChangeWizard.js');
    return {
      generic: atcChoreography({ method: 'generic' }), disk: atcChoreography({ method: 'disk' }),
      firmware: atcChoreography({ method: 'firmware' }).kind, m6: atcChoreography({ method: 'm6' }).kind, manual: atcChoreography({ method: 'manual' }),
    };
  });
  expect(c.generic, 'generic → pick-place / magazine').toMatchObject({ kind: 'pick-place', variant: 'magazine' });
  expect(c.disk, 'disk → pick-place / carousel').toMatchObject({ kind: 'pick-place', variant: 'carousel' });
  expect(c.firmware, 'firmware stays push').toBe('push');
  expect(c.m6, 'm6 stays macro-call').toBe('macro-call');
  expect(c.manual, 'manual → no inline choreography').toBeNull();
});

test('(2) the collet device opens/closes (position + tint) on setStationDevice', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
  const r = await page.evaluate(() => {
    const v = window.ddcsStudio.wizardManager._activePanel.viz;
    v.setAnimate(true);   // build the spindle assembly (_animParts.collet)
    const collet = v._animParts.collet;
    v.setStationDevice('collet', true); const openZ = collet.position.z, openCol = collet.material.color.getHex(), openFlag = v._colletOpen;
    v.setStationDevice('collet', false); const closeZ = collet.position.z, closeCol = collet.material.color.getHex(), closeFlag = v._colletOpen;
    v.setAnimate(false);
    return { openZ, closeZ, openCol, closeCol, openFlag, closeFlag };
  });
  expect(r.openFlag, 'M154 → collet OPEN').toBe(true);
  expect(r.closeFlag, 'M155 → collet CLOSE').toBe(false);
  expect(r.openZ, 'open lifts the collet').toBeGreaterThan(r.closeZ);
  expect(r.openCol, 'open tints cyan; closed grey (distinct)').not.toBe(r.closeCol);
});

test('(3) a generic (pick-place) op arms the collet; it flips on the drawbar io_change (M154/M155)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.preview = s.preview || {}; s.preview.autoLoop = false; s.machine = { x: 600, y: 400, z: -150, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } }; s.atc = s.atc || {}; s.atc.magazine = [{ pocket: 1, tool: 1, x: 100, y: 100, z: -50 }]; s.atc.tools = [{ num: 1, type: 'endmill', dia: 6, length: 40 }]; });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('atc_change'));
  await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
  await page.evaluate(() => { const sel = document.getElementById('atc_change_method'); if (sel) { sel.value = 'generic'; sel.dispatchEvent(new Event('change', { bubbles: true })); } window.ddcsStudio.wizardManager.update(); });
  await page.waitForTimeout(300);
  const r = await page.evaluate(async () => {
    const { atcChoreography } = await import('/wizards/atcChangeWizard.js');
    const host = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d');
    host.__panel.setAtcSwap(atcChoreography({ method: 'generic' }), null);   // arm pick-place (no station region)
    const v = host.__panel.viz; v.setAnimate(true);
    const fire = (pin, state) => window.dispatchEvent(new CustomEvent('io_change', { detail: { pin, state } }));
    const rest = v._colletOpen;
    fire('OUT_SPINDLE_UNCLAMP', true); const afterOpen = v._colletOpen;   // M154
    fire('OUT_SPINDLE_CLAMP', true); const afterClose = v._colletOpen;    // M155
    v.setAnimate(false);
    return { rest: !!rest, afterOpen, afterClose };
  });
  expect(r.rest, 'collet starts closed').toBe(false);
  expect(r.afterOpen, 'OUT_SPINDLE_UNCLAMP (M154) OPENS the collet').toBe(true);
  expect(r.afterClose, 'OUT_SPINDLE_CLAMP (M155) CLOSES it').toBe(false);
});

test('(4) input SENSOR live-lighting activates: a generic change trace lights the M300/301/302 pins', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ioPanel && window.ddcsGetSettings && window.virtualIO);
  const r = await page.evaluate(async () => {
    const s = window.ddcsGetSettings();
    s.atc = s.atc || {}; s.atc.magazine = [{ pocket: 1, tool: 5, x: 100, y: 100, z: -50 }]; s.atc.tools = [{ num: 5, type: 'endmill', dia: 6, length: 40 }];
    s.inputs = [
      { id: 'spindle_stopped_atc', type: 'sensor', label: 'Spindle stopped', pin: 3, level: 0, group: 'atc', waitCode: 'M300' },
      { id: 'drawbar_released_atc', type: 'sensor', label: 'Drawbar released', pin: 4, level: 0, group: 'atc', waitCode: 'M301' },
      { id: 'drawbar_clamped_atc', type: 'sensor', label: 'Drawbar clamped', pin: 5, level: 0, group: 'atc', waitCode: 'M302' },
    ];
    window.ioPanel.show();
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    const { atcChangeStack } = await import('/wizards/atcChangeWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    // a generic change with a tool preloaded so it runs the put-away + pick-up (fires M300/M301/M302 waits)
    const code = '#1300=2\n' + emitMapped(atcChangeStack({ method: 'generic', fixedT: 5, magazine: s.atc.magazine, waitSpindle: true })).text;
    new GcodeExecutionEngine({ autoAnswer: true }).trace(code);   // trace injects each wait's sensor synchronously
    window.ioPanel.refresh();
    const lit = (p) => document.querySelector(`.io-input[data-pin="${p}"]`).classList.contains('active');
    return { spindleStopped: lit(3), drawbarReleased: lit(4), drawbarClamped: lit(5) };
  });
  expect(r.spindleStopped, 'M300 wait → the Spindle-stopped pin lights').toBe(true);
  expect(r.drawbarReleased, 'M301 wait → the Drawbar-released pin lights').toBe(true);
  expect(r.drawbarClamped, 'M302 wait → the Drawbar-clamped pin lights').toBe(true);
});
