import { test, expect } from '@playwright/test';

/**
 * MACHINE-FRAME P-A (t163): the ATC magazine + a G53/machine tool-change path are MACHINE-space objects, so they must
 * ride the FIXED machine frame (raw machine coords, like the envelope/home) — NOT drift by the WCS offset. Before this
 * fix, setMagazine drew pockets at `machine − workOrigin` (added straight to the scene) and the G53 path rode the part
 * frame at xy=0 (no stock pin) while the engine subtracted the active wcsOffset → with a real non-zero pulled WCS both
 * slid off the fixed envelope by the WCS offset. This asserts the RESULT: the magazine anchor is INDEPENDENT of the WCS
 * (fixed frame = raw machine coords), and the part frame carries the ACTIVE WCS when there's no stock pin (so the
 * engine's G53 − wcsOffset cancels → the path lands at raw machine on the envelope, aligned with the magazine).
 * SIM/VISUAL only — the emitted .nc is untouched (byte-parity covered elsewhere).
 */
test.use({ viewport: { width: 1280, height: 900 } });

// grab a live GcodeViz3D (any wizard) to drive setMachine/setMagazine directly, like sim-machine-frame.spec
async function viz(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
}

test('the magazine anchor is on the FIXED frame — raw machine coords, INDEPENDENT of workOrigin', async ({ page }) => {
  await viz(page);
  // a pocket at machine (100,100,-50); read its scene position (the magGroup sits at the scene root, so a child's
  // local position IS its world position). Vary the WCS + workOrigin and assert the pocket does NOT move.
  const place = (g54) => page.evaluate((off) => {
    const v = window.ddcsStudio.wizardManager._activePanel.viz;
    v.setStock({ show: false });   // ATC-like: no real workpiece
    v.setMachine({ x: 600, y: 400, z: -150, show: true, workOrigin: off,
      wcs: { active: 1, table: [off, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }] } });
    v.setMagazine([{ pocket: 1, tool: { type: 'endmill', dia: 6, length: 30 }, x: 100, y: 100, z: -50 }]);
    const c = v._magGroup && v._magGroup.children[0];
    const part = v.partFrame.group.position;
    return { magX: +c.position.x.toFixed(1), magY: +c.position.y.toFixed(1), partX: +part.x.toFixed(1), partY: +part.y.toFixed(1) };
  }, g54);

  const a = await place({ x: 0, y: 0, z: 0 });        // zero WCS
  const b = await place({ x: 200, y: 150, z: -40 });  // a real non-zero WCS
  const c = await place({ x: -80, y: 260, z: -20 });  // another non-zero WCS

  // (1) the magazine pocket sits at its RAW machine coords (100,100) — on the fixed envelope
  expect(a.magX, 'zero WCS: pocket at raw machine X').toBe(100);
  expect(a.magY, 'zero WCS: pocket at raw machine Y').toBe(100);
  // (2) it is INDEPENDENT of the WCS / workOrigin (the fixed-frame guarantee) — the whole point of the fix
  expect({ x: b.magX, y: b.magY }, 'non-zero WCS #1: pocket did NOT drift (fixed frame)').toEqual({ x: 100, y: 100 });
  expect({ x: c.magX, y: c.magY }, 'non-zero WCS #2: pocket did NOT drift (fixed frame)').toEqual({ x: 100, y: 100 });
  // (3) the part frame CARRIES the active WCS when there's no stock pin → a G53 path (engine − wcsOffset) cancels to
  //     raw machine on the fixed envelope, aligned with the magazine. (Zero WCS → 0, the common case unchanged.)
  expect({ x: a.partX, y: a.partY }, 'zero WCS: part frame at origin (unchanged common case)').toEqual({ x: 0, y: 0 });
  expect({ x: b.partX, y: b.partY }, 'non-zero WCS #1: part frame rides the active WCS (G53 cancels to raw machine)').toEqual({ x: 200, y: 150 });
  expect({ x: c.partX, y: c.partY }, 'non-zero WCS #2: part frame rides the active WCS').toEqual({ x: -80, y: 260 });
});

test('a STOCK pinned to its WCS is unaffected — the part still rides the stock pin (no regression to mill ops)', async ({ page }) => {
  await viz(page);
  const part = await page.evaluate(() => {
    const v = window.ddcsStudio.wizardManager._activePanel.viz;
    // a stock pinned to G54; active WCS is G55 (a different, non-zero row). The part must ride the STOCK's pin (G54),
    // NOT the active-WCS fallback — the fallback is ONLY for the no-pin case.
    v.setStock({ x: 50, y: 40, z: 20, show: true, datum: 'nnp', pin: 'g54' });
    v.setMachine({ x: 300, y: 300, z: 120, show: true, wcs: { active: 2, table: [{ x: 100, y: 60, z: 0 }, { x: 250, y: 240, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }] } });
    const p = v.partFrame.group.position;
    return { x: +p.x.toFixed(1), y: +p.y.toFixed(1) };
  });
  expect(part, 'part rides the STOCK pin (G54=100,60), not the active WCS (G55=250,240)').toEqual({ x: 100, y: 60 });
});

test('a PARTIAL profile (workOrigin set, NO wcs.table) — part rides workOrigin so G53 aligns with the raw-machine magazine (t173)', async ({ page }) => {
  await viz(page);
  const r = await page.evaluate(() => {
    const v = window.ddcsStudio.wizardManager._activePanel.viz;
    v.setStock({ show: false });   // no stock pin (ATC-like) → the fallback chain applies
    // a partial/legacy profile: workOrigin set but wcs.table is null. wcsForViz falls back to m.workOrigin -> the engine
    // offsets G53 by workOrigin; the part frame MUST match (else the G53 path drifts to machine-workOrigin while the
    // magazine sits at raw machine → MISALIGN). Mirror the fallback.
    v.setMachine({ x: 600, y: 400, z: -150, show: true, workOrigin: { x: 220, y: 130, z: -30 }, wcs: { active: 1, table: null } });
    v.setMagazine([{ pocket: 1, tool: { type: 'endmill', dia: 6, length: 30 }, x: 100, y: 100, z: -50 }]);
    const part = v.partFrame.group.position;
    const mag = v._magGroup.children[0].position;   // magazine at RAW machine coords (workOrigin-independent)
    return { partX: +part.x.toFixed(1), partY: +part.y.toFixed(1), magX: +mag.x.toFixed(1), magY: +mag.y.toFixed(1) };
  });
  // the part frame rides workOrigin (so the engine's G53 -wcsOffset cancels → the path lands at raw machine)
  expect({ x: r.partX, y: r.partY }, 'table null → part frame falls back to workOrigin (mirrors wcsForViz)').toEqual({ x: 220, y: 130 });
  // and the magazine stays at raw machine coords — so the two ALIGN (both resolve to raw machine), no drift
  expect({ x: r.magX, y: r.magY }, 'magazine at raw machine coords (aligned with the G53 path, not drifted)').toEqual({ x: 100, y: 100 });
});
