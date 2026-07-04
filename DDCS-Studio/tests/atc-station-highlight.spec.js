import { test, expect } from '@playwright/test';

/**
 * ATC FIRMWARE PUSH-STATION highlight (P-C.1a, t171). A DECLARED per-method choreography seam (ATC_CHOREOGRAPHY, keyed
 * on resolveMethod) drives the sim visual by the op's DECLARED method (valid-by-construction). FIRMWARE = a fixed-station
 * push → highlight the taught #1320-1326 station region on the FIXED machine frame (raw machine coords, like the magazine
 * + envelope, post-P-A); the already-animated G53 push travel lands there. NO tool swap yet (P-C.1b). SIM/VISUAL only —
 * emit byte-identical. Asserts the VALUE: the seam resolves firmware (not generic), the highlight sits at the taught
 * station coords, it is WCS-INDEPENDENT (fixed frame), and the traced push reaches the same station coords.
 */
test.use({ viewport: { width: 1280, height: 900 } });

test('(1) the choreography seam declares firmware=push, m6=macro-call, others no-op', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const c = await page.evaluate(async () => {
    const { atcChoreography } = await import('/wizards/atcChangeWizard.js');
    const fw = atcChoreography({ method: 'firmware' });
    return {
      fwKind: fw && fw.kind, fwVars: fw && fw.stationVars,
      fwRegion: fw && fw.region({ 1306: -10, 1320: 200, 1321: 150, 1323: 250, 1324: 150, 1325: 300, 1326: 150 }),
      generic: atcChoreography({ method: 'generic' }), m6: atcChoreography({ method: 'm6' }),
      manual: atcChoreography({ method: 'manual' }), disk: atcChoreography({ method: 'disk' }),
    };
  });
  expect(c.fwKind, 'firmware → a push choreography').toBe('push');
  expect(c.fwVars, 'the taught station params it reads').toEqual([1306, 1320, 1321, 1323, 1324, 1325, 1326]);
  expect(c.fwRegion, 'region() builds start/end/retreat from the resolved vars').toEqual({ z: -10, start: { x: 200, y: 150 }, end: { x: 250, y: 150 }, retreat: { x: 300, y: 150 } });
  expect(c.m6.kind, 'm6 → a macro call (controller runs T.nc, nothing inline)').toBe('macro-call');
  expect(c.generic && c.generic.kind, 'generic → pick-place (P-C.3a)').toBe('pick-place');
  expect(c.disk && c.disk.kind, 'disk → pick-place').toBe('pick-place');
  expect(c.manual, 'manual → no inline choreography').toBeNull();
});

test('(2) the station highlight sits at RAW machine coords on the fixed frame — WCS-INDEPENDENT', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
  const place = (g54) => page.evaluate((off) => {
    const v = window.ddcsStudio.wizardManager._activePanel.viz;
    v.setStock({ show: false });
    v.setMachine({ x: 600, y: 400, z: -150, show: true, workOrigin: off, wcs: { active: 1, table: [off, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }] } });
    v.highlightStation({ z: -10, start: { x: 200, y: 150 }, end: { x: 250, y: 150 }, retreat: { x: 300, y: 150 } });
    const spheres = v._stationGroup.children.filter((o) => o.geometry && o.geometry.type === 'SphereGeometry').map((o) => ({ x: +o.position.x.toFixed(0), y: +o.position.y.toFixed(0) }));
    return spheres;
  }, g54);
  const a = await place({ x: 0, y: 0, z: 0 });        // zero WCS
  const b = await place({ x: 200, y: 150, z: -40 });  // a real non-zero WCS
  expect(a, 'station markers at the taught raw machine coords').toEqual([{ x: 200, y: 150 }, { x: 250, y: 150 }, { x: 300, y: 150 }]);
  expect(b, 'the station did NOT move with the WCS (fixed frame — aligns with the G53 push, post-P-A)').toEqual(a);
});

test('(3) the traced FIRMWARE push reaches the taught station; the view wires the highlight for firmware only', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  // (a) headless: the emitted firmware push, with taught station coords, reaches the station machine coords + region matches
  const t = await page.evaluate(async () => {
    const { atcChangeStack, atcChoreography } = await import('/wizards/atcChangeWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const choreo = atcChoreography({ method: 'firmware' });
    const code = '#1306=-10\n#1320=200\n#1321=150\n#1322=100\n#1323=250\n#1324=150\n#1325=300\n#1326=150\n#563=3000\n#1327=500\n' + emitMapped(atcChangeStack({ method: 'firmware', callMacro: false })).text;   // INC-B: the inline push stations (default is now a T# M6 call)
    const r = traceToolpath(code, { captureVars: choreo.stationVars });
    const xy = r.segments.map((s) => ({ x: +(+s.x2).toFixed(0), y: +(+s.y2).toFixed(0) }));
    return { region: choreo.region(r.vars), reachesStart: xy.some((p) => p.x === 200 && p.y === 150), reachesEnd: xy.some((p) => p.x === 250 && p.y === 150), reachesRetreat: xy.some((p) => p.x === 300 && p.y === 150) };
  });
  expect(t.reachesStart && t.reachesEnd && t.reachesRetreat, 'the G53 push travels start→end→retreat at the taught station').toBe(true);
  expect(t.region, 'the highlight region = the taught #1320-1326 (captured from the trace)').toEqual({ z: -10, start: { x: 200, y: 150 }, end: { x: 250, y: 150 }, retreat: { x: 300, y: 150 } });

  // (b) real wizard: firmware method → the seam resolves firmware, the view wires the station highlight (a _stationGroup)
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('atc_change'));
  await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
  await page.evaluate(() => { const sel = document.getElementById('atc_change_method'); if (sel) { sel.value = 'firmware'; sel.dispatchEvent(new Event('change', { bubbles: true })); } window.ddcsStudio.wizardManager.update(); });
  await page.waitForTimeout(500);
  const w = await page.evaluate(() => {
    const cont = document.getElementById('atcChangeViz');
    const host = cont && cont.parentElement && cont.parentElement.querySelector('.wiz-viz3d');
    const viz = host && host.__panel && host.__panel.viz;
    const sel = document.getElementById('atc_change_method');
    return { method: sel && sel.value, hasStation: !!(viz && viz._stationGroup) };
  });
  expect(w.method, 'the firmware method is selected').toBe('firmware');
  expect(w.hasStation, 'the view wired the push-station highlight for the firmware op (not generic/no-op)').toBe(true);
});
