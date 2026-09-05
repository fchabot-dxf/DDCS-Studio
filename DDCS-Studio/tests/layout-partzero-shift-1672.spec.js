import { test, expect } from '@playwright/test';

/**
 * t1672 — RULED (advisor): the Layout (2D) pane's stock+handles now read `sceneFrame.partZeroShift` — THE ONE
 * declared scene transform (sceneFrame.js's own doc: "Every renderer... reads this ONE source... so their
 * frames can never drift") — the SAME transform the 3D pane already applied unconditionally. Before this turn,
 * `panelTypes.js` only computed it when `opSimContext(opType).toolMachineFrame` was true — a flag about whether
 * to draw the ENVELOPE BACKDROP, an unrelated decision — so every non-machine-frame op's Layout pane (corner,
 * drill, pocket, ...) silently stayed unshifted whenever a WCS pin was active, diverging from the 3D pane
 * (t1670's Corner bug, generalized to 14 other op types by the SAME root cause).
 *
 * THE FIX: `layoutSpecFromOp` now computes `partZeroShift` unconditionally (its own internal `r.shown` gate
 * already returns {0,0,0} for the common no-envelope case, so "unpinned is byte-identical to today" falls out
 * of the shared function, not a second local condition) and applies it two ways:
 *   - the STOCK rect via its existing `ox/oy` mechanism (unchanged shape, just no longer gated), and
 *   - every HANDLE/MARKER/PATH via a NEW `spec.placement` field — an ALREADY-EXISTING, already-tested
 *     FeatureCanvas mechanism (`_disp()` for display, `onDrag` for the symmetric un-shift on write-back;
 *     "pattern items/handles ride this; stock is datum-fixed") that was simply never populated before. Reusing
 *     it means every handle/marker/path in the spec picks up the shift automatically, with zero changes to the
 *     hundreds of individual coordinate computations throughout the function — one declared value, not a
 *     second source per call site.
 *
 * The envelope BACKDROP (`machSpread`/`machine`) stays gated on `toolMachineFrame` — that IS the legitimate,
 * separate "does this op want the envelope rectangle drawn" decision the advisor's ruling preserved.
 */

const AFFECTED_OPS = [
  ['/blocks/dataOps/cornerData.js', 'cornerDataDef'],
  ['/blocks/dataOps/boreData.js', 'boreDataDef'],
  ['/blocks/dataOps/alignmentData.js', 'alignmentDataDef'],
  ['/blocks/dataOps/contourData.js', 'contourDataDef'],
  ['/blocks/dataOps/drillData.js', 'drillDataDef'],
  ['/blocks/dataOps/edgeData.js', 'edgeDataDef'],
  ['/blocks/dataOps/pocketData.js', 'pocketDataDef'],
  ['/blocks/dataOps/rotaryClockData.js', 'rotaryClockDataDef'],
  ['/blocks/dataOps/rotaryCenterData.js', 'rotaryCenterDataDef'],
  ['/blocks/dataOps/surfacingData.js', 'surfacingDataDef'],
  ['/blocks/dataOps/slotData.js', 'slotDataDef'],
  ['/blocks/dataOps/tapData.js', 'tapDataDef'],
  ['/blocks/dataOps/textData.js', 'textDataDef'],
  ['/blocks/dataOps/middleData.js', 'middleDataDef'],
  ['/blocks/dataOps/homingData.js', 'homingDataDef'],   // the CONTROL: already toolMachineFrame:true before this turn
];

test('every mill/probe op with a Layout pane: unpinned is byte-identical (0), pinned stock+handles both read the ONE partZeroShift, emit never moves', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async (ops) => {
    const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
    const { partZeroShift } = await import('/viz/sceneFrame.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { opSimContext } = await import('/viz/opSimContext.js');

    const setStock = (pin) => {
      const s = window.ddcsGetSettings();
      s.stock = Object.assign(s.stock || {}, { x: 200, y: 150, z: 20, show: true, datum: 'nnp' });
      if (pin) {
        s.stock.pin = pin;
        s.machine = Object.assign(s.machine || {}, { x: 800, y: 500, z: 120, show: true });
        s.machine.wcs = s.machine.wcs || {}; s.machine.wcs.active = 1;
        s.machine.wcs.table = [{ x: 0, y: 0, z: 0 }, { x: 300, y: 200, z: -10 }];
      } else {
        delete s.stock.pin;
        s.machine = Object.assign(s.machine || {}, { show: false });
      }
      if (window.ddcsSetSettings) window.ddcsSetSettings(s);
      return s;
    };

    const out = [];
    for (const [mod, fn] of ops) {
      const M = await import(mod);
      const def = M[fn]();
      registerUserOp(def);
      const params = Object.fromEntries((def.bindings || []).filter((b) => b.param && 'default' in b).map((b) => [b.param, b.default]));
      const build = builderOf(def.opType);

      setStock(null);
      const unpinnedSpec = layoutSpecFromOp(def, params);
      const unpinnedEmit = emitMapped(build(params)).text;

      const s1 = setStock('G55');
      const pinnedSpec = layoutSpecFromOp(def, params);
      const pinnedEmit = emitMapped(build(params)).text;
      const expectedPz = partZeroShift(s1.machine, s1.stock, null);

      out.push({
        opType: def.opType,
        toolMachineFrame: opSimContext(def.opType).toolMachineFrame,
        unpinnedStock: { ox: unpinnedSpec.stock.ox, oy: unpinnedSpec.stock.oy },
        unpinnedPlacement: unpinnedSpec.placement,
        pinnedStock: { ox: pinnedSpec.stock.ox, oy: pinnedSpec.stock.oy },
        pinnedPlacement: pinnedSpec.placement,
        expectedPz: { x: expectedPz.x, y: expectedPz.y },
        emitIdentical: unpinnedEmit === pinnedEmit,
      });
    }
    return out;
  }, AFFECTED_OPS);

  expect(r.length, 'swept every declared op — none silently skipped').toBe(AFFECTED_OPS.length);
  for (const row of r) {
    expect(row.unpinnedStock.ox, `${row.opType}: unpinned stock.ox stays 0 — byte-identical to before this turn`).toBe(0);
    expect(row.unpinnedStock.oy, `${row.opType}: unpinned stock.oy stays 0`).toBe(0);
    expect(row.unpinnedPlacement.x, `${row.opType}: unpinned placement.x is 0 (handles/markers don't move either)`).toBe(0);
    expect(row.unpinnedPlacement.y, `${row.opType}: unpinned placement.y is 0`).toBe(0);
    expect(row.pinnedStock.ox, `${row.opType}: pinned stock.ox == the independently-computed partZeroShift.x`).toBeCloseTo(row.expectedPz.x, 6);
    expect(row.pinnedStock.oy, `${row.opType}: pinned stock.oy == partZeroShift.y`).toBeCloseTo(row.expectedPz.y, 6);
    expect(row.pinnedPlacement.x, `${row.opType}: pinned placement.x == the SAME partZeroShift.x — stock and handles read ONE source, moving together`).toBeCloseTo(row.expectedPz.x, 6);
    expect(row.pinnedPlacement.y, `${row.opType}: pinned placement.y == the SAME partZeroShift.y`).toBeCloseTo(row.expectedPz.y, 6);
    expect(row.emitIdentical, `${row.opType}: emit is byte-identical pinned vs unpinned — a rendering-only transform`).toBe(true);
  }
});

test('a non-default datum never moves a part-frame op\'s stock rect, even with zero WCS-pin shift (the bug this file itself caught)', async ({ page }) => {
  // t1672 — a real bug in this turn's first implementation attempt: `stockOut.ox` unconditionally subtracted the
  // datum offset (`_dp`), which pre-t1672 only applied to MACHINE-FRAME ops (homing) — every other op's stock rect
  // always sat at local {0,0} regardless of datum, with only the crosshair (`spec.origin`) showing the datum. With
  // `partZeroShift` returning {0,0,0} (no pin, the common case) but a non-default datum still non-zero, the
  // unconditional subtraction moved the stock rect for every part-frame op even at zero shift — caught by
  // `corner-datum-independence.spec.js` going red on a datum it had always exercised. Pinned here permanently so
  // this exact class can't silently reappear: only DEFAULT-datum coverage (where `_dp` is {0,0}) would hide it.
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async (ops) => {
    const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { opSimContext } = await import('/viz/opSimContext.js');
    const out = [];
    for (const [mod, fn] of ops) {
      const M = await import(mod);
      const def = M[fn]();
      registerUserOp(def);
      if (opSimContext(def.opType).toolMachineFrame) continue;   // machine-frame ops (homing) legitimately DO subtract the datum — not this test's claim
      const params = Object.fromEntries((def.bindings || []).filter((b) => b.param && 'default' in b).map((b) => [b.param, b.default]));
      const s = window.ddcsGetSettings();
      s.stock = Object.assign(s.stock || {}, { x: 200, y: 150, z: 20, show: true, datum: 'ppp' });   // NON-default: back-right, _dp != {0,0}
      delete s.stock.pin;
      s.machine = Object.assign(s.machine || {}, { show: false });   // no envelope → partZeroShift is {0,0,0}
      if (window.ddcsSetSettings) window.ddcsSetSettings(s);
      const spec = layoutSpecFromOp(def, params);
      out.push({ opType: def.opType, ox: spec.stock.ox, oy: spec.stock.oy });
    }
    return out;
  }, AFFECTED_OPS);

  expect(r.length, 'checked every non-machine-frame op (homing correctly excluded)').toBe(AFFECTED_OPS.length - 1);
  for (const row of r) {
    expect(row.ox, `${row.opType}: stock.ox stays 0 at a non-default datum with zero shift (datum-independent, per its own pre-existing contract)`).toBe(0);
    expect(row.oy, `${row.opType}: stock.oy stays 0`).toBe(0);
  }
});

test('a lathe op never reaches the mill/probe shift code — no placement field, its own early-return spec shape', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/facingData.js');
    const def = CD.facingDataDef();
    registerUserOp(def);
    const params = Object.fromEntries((def.bindings || []).filter((b) => b.param && 'default' in b).map((b) => [b.param, b.default]));
    const s = window.ddcsGetSettings();
    s.stock = Object.assign(s.stock || {}, { x: 200, y: 150, z: 20, show: true, datum: 'nnp', pin: 'G55' });
    s.machine = Object.assign(s.machine || {}, { x: 800, y: 500, z: 120, show: true });
    s.machine.wcs = s.machine.wcs || {}; s.machine.wcs.active = 1;
    s.machine.wcs.table = [{ x: 0, y: 0, z: 0 }, { x: 300, y: 200, z: -10 }];
    if (window.ddcsSetSettings) window.ddcsSetSettings(s);
    const spec = layoutSpecFromOp(def, params);
    return { hasPlacementField: 'placement' in spec };
  });
  expect(r.hasPlacementField, 'a lathe op spec carries no placement field — proves latheLayoutSpec\'s early return, not this fix, produced it').toBe(false);
});

test('live drag while WCS-pinned writes the correct un-shifted param (the _disp/onDrag round-trip really works, not just the data model)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  await page.evaluate(() => {
    const s = window.ddcsGetSettings();
    s.stock = Object.assign(s.stock || {}, { x: 200, y: 150, z: 20, show: true, datum: 'nnp', pin: 'G55' });
    s.machine = Object.assign(s.machine || {}, { x: 800, y: 500, z: 120, show: true });
    s.machine.wcs = s.machine.wcs || {}; s.machine.wcs.active = 1;
    s.machine.wcs.table = [{ x: 0, y: 0, z: 0 }, { x: 300, y: 200, z: -10 }];
    if (window.ddcsSetSettings) window.ddcsSetSettings(s);
  });
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#userVizContainer_tree .fc-handle-sim', { timeout: 8000 });
  await page.waitForTimeout(700);

  const read = () => page.evaluate(() => {
    const box = document.getElementById('userViz3dContainer_tree');
    const host = box && box.parentElement && box.parentElement.querySelector('.wiz-viz3d');
    const panel = host && host.__panel;
    return { start0: (panel && panel.getPassStarts()[0]) || null };
  });
  const before = await read();

  const handle = page.locator('#userVizContainer_tree .fc-handle-sim').first();
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + 70, hb.y + 48, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  const after = await read();
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  const dist = Math.hypot((after.start0.x || 0) - (before.start0.x || 0), (after.start0.y || 0) - (before.start0.y || 0));
  expect(dist, 'the drag moved the RAW start param a small, sane distance').toBeGreaterThan(3);
  // t2635 — threshold widened 150→280: corner's REDIVIDE composition (its own 4 labelled sections, owner
  // ruling) permanently reduces the feature canvas's own available height (measured live: 874×323 → 874×154
  // even with the now-empty LAYOUT-2D section collapsed by default — 3D-SIM's own header, unavoidable since
  // it's meant to stay visible, plus LAYOUT-2D's own collapsed header line, cost real space the pre-REDIVIDE
  // sectionless layout never paid), which shrinks the canvas's own world-per-pixel scale and so grows the
  // world-space distance the SAME fixed-pixel drag (48,-34 screen px) produces — verified NOT a timing race
  // first (identical 222.03 result at both 700ms and 1200ms settle waits). 280 stays far below what an
  // actual 300/200 pin-shift inflation bug would produce (roughly +360 world units on top of the legitimate
  // small delta, per this test's own comment) — still catches the real regression this guards against.
  expect(dist, 'not inflated by the 300/200 pin shift — proves onDrag received the un-shifted local delta').toBeLessThan(280);
});
