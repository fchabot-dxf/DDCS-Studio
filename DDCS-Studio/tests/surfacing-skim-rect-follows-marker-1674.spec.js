import { test, expect } from '@playwright/test';

/**
 * t1674 — USER-REPORTED: in Surfacing, Z-mode SKIM, dragging the start marker moved the previewed toolpath but
 * the teal W×H dimension rectangle stayed anchored at the origin (path moves, rectangle does not).
 *
 * ROOT CAUSE: the marker already resolved its position through `startMarkerTarget(zMode)` (jogX/jogY in Skim),
 * but the DRAWN RECT (surfacingView.js's `items` rect / surfacingData.js's `paths`) read `originX/originY`
 * unconditionally — a second, un-updated source for "where does the faced area sit." Skim's program is relative
 * to wherever the operator jogs (documented in surfacingData.js: "origin has no meaning there"), so the faced
 * area IS physically at the jog point — the drawn rect must follow it.
 *
 * THE FIX: both faces now derive the drawn rect's position from `posGeom` — the SAME value the marker handle is
 * built from (declared once, in `startMarkerTarget`'s mode→field mapping). `handleScale`'s own `ox/oy` argument
 * (the resize-handle anchor, `hs.size`) and `bbox` (the twin's PLACEMENT-frame extent) both stay on
 * originX/originY exactly as before — an EARLIER trial that fed the jog position into `handleScale` broke the
 * resize-handle anchor and diverged the wizard/twin seed by ~5mm on an identical drag.
 *
 * A SECOND, independently-discovered trap: once the rect's own bounding box tracks the SAME handle being
 * dragged, `featureCanvas.js`'s generic `_snapOffsets` (which derives extra snap candidates from the drawn
 * items' bbox, so ANY corner of a fixed-size feature can align to a stock anchor) becomes self-referential —
 * the offsets collapse to the rect's own {0,w/2,w}×{0,h/2,h}, independent of where the handle actually is,
 * turning the normal ~7px snap tolerance into a virtual net spanning the whole w×h rect. Caught live: a
 * 30,-15px drag in Skim mode snapped jogX/jogY to (20,15) instead of the raw, correct (~24.99,~12.49) — a
 * stock-centre coincidence nobody asked for. Fixed by declaring `noSnap:true` on the Skim marker (matching the
 * existing free-jog treatment already used for alignment/rotary probe starts) — and by fixing
 * `canvasWidgets.js`'s `buildCanvasWidgets`, which was silently dropping any declared `noSnap` (only `id`/
 * `color` were passed through), the same declared-but-unread-property class t1638 named for block mouths.
 */

test('direct-value: the drawn rect tracks the marker target by mode, both faces, emit stable under jogX/Y', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const SD = await import('/blocks/dataOps/surfacingData.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const def = SD.surfacingDataDef();
    registerUserOp(def);
    const build = builderOf(def.opType);
    const base = { originX: 20, originY: 20, w: 80, h: 60, wcs: 'active', strategy: 'raster', toolDia: 12, stepoverPct: 60, depth: 0.5, stepdown: 0.5, clearance: 5, feed: 200, plunge: 200, rpm: 18000 };

    const normalA = SD.surfacingPreviewGeometry({ ...base, zMode: 'normal', jogX: 0, jogY: 0 });
    const normalB = SD.surfacingPreviewGeometry({ ...base, zMode: 'normal', jogX: 999, jogY: -888 });
    const emitNormalA = emitMapped(build({ ...base, zMode: 'normal', jogX: 0, jogY: 0 })).text;
    const emitNormalB = emitMapped(build({ ...base, zMode: 'normal', jogX: 999, jogY: -888 })).text;

    const skimA = SD.surfacingPreviewGeometry({ ...base, zMode: 'skim', jogX: 55, jogY: 33 });
    const skimB = SD.surfacingPreviewGeometry({ ...base, zMode: 'skim', jogX: -70, jogY: 12 });
    const emitSkimA = emitMapped(build({ ...base, zMode: 'skim', jogX: 55, jogY: 33 })).text;
    const emitSkimB = emitMapped(build({ ...base, zMode: 'skim', jogX: -70, jogY: 12 })).text;

    // handleScale's resize-anchor stays on originX/Y regardless of mode/jog (the trap the advisor already found)
    const handleScaleUnaffected = skimA.handles.find((h) => h.id === 'sf_size').ax === 20 && skimA.handles.find((h) => h.id === 'sf_size').ay === 20;

    return {
      normalA_p0: normalA.paths[0].pts[0], normalB_p0: normalB.paths[0].pts[0],
      skimA_p0: skimA.paths[0].pts[0], skimB_p0: skimB.paths[0].pts[0],
      emitNormalIdentical: emitNormalA === emitNormalB,
      emitSkimIdentical: emitSkimA === emitSkimB,
      handleScaleUnaffected,
      skimMarkerNoSnap: skimA.handles.find((h) => h.id === 'sf_pos').noSnap === true,
      normalMarkerNoSnap: normalA.handles.find((h) => h.id === 'sf_pos').noSnap,
    };
  });

  expect(r.normalA_p0, 'Normal: rect corner at originX/Y regardless of jogX/Y').toEqual({ x: 20, y: 20 });
  expect(r.normalB_p0, 'Normal: rect corner UNCHANGED even at wildly different jogX/Y (999,-888)').toEqual({ x: 20, y: 20 });
  expect(r.skimA_p0, 'Skim: rect corner EQUALS jogX/Y (55,33)').toEqual({ x: 55, y: 33 });
  expect(r.skimB_p0, 'Skim: rect corner EQUALS jogX/Y (-70,12)').toEqual({ x: -70, y: 12 });
  expect(r.emitNormalIdentical, 'Normal: emit unchanged by jogX/Y (never read in this mode)').toBe(true);
  expect(r.emitSkimIdentical, 'Skim: emit unchanged by jogX/Y (preview-only, never emitted)').toBe(true);
  expect(r.handleScaleUnaffected, "the resize handle's anchor stays on originX/Y — the trap the advisor already measured").toBe(true);
  expect(r.skimMarkerNoSnap, 'Skim marker declares noSnap (the itemsBBox self-reference trap this turn found)').toBe(true);
  expect(r.normalMarkerNoSnap, 'Normal marker keeps its existing snap behaviour (unchanged)').not.toBe(true);
});

test('live drag: Skim marker no longer snaps to a stock-anchor-via-rect-corner coincidence', async ({ page }) => {
  test.info().annotations.push({ type: 'viewport', description: '1280x900' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = Object.assign(s.stock || {}, { x: 200, y: 150, z: 20, show: true, datum: 'nnp' }); });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
  await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id); if (e) { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('sf_w', 80); set('sf_h', 60); set('sf_originX', 20); set('sf_originY', 20); set('sf_zMode', 'normal');
  });
  await page.selectOption('#sf_zMode', 'skim');
  await page.waitForTimeout(300);
  const wc = await page.evaluate(() => { const el = document.querySelector('#surfacingLayoutCanvas svg [data-hid="origin"]'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(wc.x, wc.y);
  await page.mouse.down();
  await page.mouse.move(wc.x + 30, wc.y - 15, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const jogX = await page.evaluate(() => Number(document.getElementById('sf_jogX').value));
  const jogY = await page.evaluate(() => Number(document.getElementById('sf_jogY').value));

  // the raw, un-snapped delta this exact gesture should produce (scale measured independently — see spec below);
  // the OLD (buggy) behaviour snapped this to exactly (20, 15) — a stock-centre coincidence. Assert it's NOT that.
  expect(Math.hypot(jogX - 20, jogY - 15), 'the drag is NOT snapped to the old spurious (20,15) stock-centre coincidence').toBeGreaterThan(2);
});
