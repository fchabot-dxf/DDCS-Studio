import { test, expect } from '@playwright/test';

// DATUM-AT-CENTRE (turn 112) — the WCS datum gizmo must rest OVER the feature centre, not on the last probed wall. ROOT:
// the datum was pinned to the probe-CONTACT events (the walls); the WCS is written by the middle CALCULUS
// (#53=[#51+#52]/2 → #[#70+off]=#53/#56). FIX: re-pin the datum to the WCS-WRITE event — createPreviewPanel detects
// `#[#70+N]=#src` and calls viz.markDatumWrite(axis, engine.vars[src]); _updateDatum positions the gizmo there. SIM-ONLY,
// no macro change, the probe-contact discs + the tool are untouched. #53/#56 are in the datum's part-local frame (verified).
test.use({ viewport: { width: 1300, height: 950 } });

async function runDatum(page, p, stock) {
  return page.evaluate(async (a) => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    // t1730 — MiddleWizard (the legacy screen class) was deleted alongside its view; middleStack/opSimStarts are
    // the surviving builder + start-inference registry.
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const code = emitMapped(middleStack(a.p)).text;
    const starts = opSimStarts('middle', a.p, a.stock);
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz._anchorToStart = true;
    viz.starts = starts.map((s) => ({ ...s }));
    viz.resetProbe && viz.resetProbe();

    // mirror createPreviewPanel.onLineChange: resolve probes on the next line + detect the WCS-offset write → markDatumWrite
    const probeAxis = (raw) => { const m = /G31\s+([XYZ])/i.exec(raw || ''); return m ? m[1].toLowerCase() : null; };
    let pending = null;
    const e = new GcodeExecutionEngine({
      autoAnswer: true, simSpeed: 1, stock: a.stock, stockOffset: starts[0],
      onLineChange: ({ raw }) => {
        if (pending && viz.probeAxisTouched) viz.probeAxisTouched(pending, e.feedVal);
        pending = null;
        if (raw) { const pa = probeAxis(raw); if (pa) pending = pa; }
        const ww = raw && /#\[#70\+(\d)\]\s*=\s*#(\d+)/.exec(raw);
        if (ww && viz.markDatumWrite) {
          const dax = ['x', 'y', 'z'][+ww[1]], dval = e.vars && e.vars.get(+ww[2]);
          if (dax && Number.isFinite(dval)) viz.markDatumWrite(dax, dval);
        }
      },
      onPositionChange: (pos) => viz.setToolPosition(pos),
    });
    e._passStarts = starts;
    e.step(code);
    let g = 0; while (e.running && g++ < 5000) e.step();
    if (pending && viz.probeAxisTouched) viz.probeAxisTouched(pending, e.feedVal);

    const gz = viz._probeGizmo;
    const cs = viz._probeContacts || [];
    return {
      datum: gz ? { x: +gz.position.x.toFixed(2), y: +gz.position.y.toFixed(2), vis: gz.visible } : null,
      lastWall: viz._probeVals ? { x: +viz._probeVals.x.toFixed(2), y: +viz._probeVals.y.toFixed(2) } : null,
      c53: +(e.vars.get(53) || 0).toFixed(2), c56: +(e.vars.get(56) || 0).toFixed(2),
      centre: { x: a.stock.x / 2, y: a.stock.y / 2 }, code, nContacts: cs.length,
    };
  }, { p, stock });
}

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));   // any wizard panel with a real viz
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
});

test('both-axis boss: the datum RESTS at the centre (WCS-write), not the last wall', async ({ page }) => {
  const p = { featureType: 'boss', approach: 'auto', inAxis: 'auto', transAxis: 'auto', twoAxis: true, findBoth: true,
              axis: 'X', dir1: 'pos', dir2: 'neg', dist: 80, retract: 2, safeZ: 10, clearOver: 40, wcs: 'active' };
  const r = await runDatum(page, p, { x: 60, y: 60, z: 60, shape: 'boss', show: true });

  // the macro really writes the offset in the #[#70+N]=#src form the hook keys off
  expect(r.code, 'middle writes #[#70+0]=#53 and #[#70+1]=#56').toMatch(/#\[#70\+0\]=#53/);
  expect(r.code).toMatch(/#\[#70\+1\]=#56/);
  // the calculus centre == the scene centre (the values were always correct)
  expect(r.c53).toBeCloseTo(r.centre.x, 1);
  expect(r.c56).toBeCloseTo(r.centre.y, 1);
  // THE DATUM now sits at the centre …
  expect(r.datum.vis, 'datum is visible (≥2 axes)').toBe(true);
  expect(Math.abs(r.datum.x - r.centre.x), 'datum X at centre').toBeLessThan(1);
  expect(Math.abs(r.datum.y - r.centre.y), 'datum Y at centre').toBeLessThan(1);
  // … NOT on the last probed wall (the bug it had before the re-pin)
  const offWall = Math.hypot(r.datum.x - r.lastWall.x, r.datum.y - r.lastWall.y);
  expect(offWall, 'datum is OFF the last-wall corner (the bug)').toBeGreaterThan(5);
});

test('Y-first boss + pocket-both: the datum also rests at the centre', async ({ page }) => {
  const yFirst = await runDatum(page, { featureType: 'boss', approach: 'auto', inAxis: 'auto', transAxis: 'auto', twoAxis: true, findBoth: true, axis: 'Y', dir1: 'pos', dir2: 'neg', dist: 80, retract: 2, safeZ: 10, clearOver: 40, wcs: 'active' }, { x: 60, y: 60, z: 60, shape: 'boss', show: true });
  expect(Math.abs(yFirst.datum.x - yFirst.centre.x), 'Y-first datum X at centre').toBeLessThan(1);
  expect(Math.abs(yFirst.datum.y - yFirst.centre.y), 'Y-first datum Y at centre').toBeLessThan(1);

  const pocket = await runDatum(page, { featureType: 'pocket', approach: 'auto', inAxis: 'auto', transAxis: 'auto', twoAxis: true, findBoth: true, axis: 'X', dir1: 'pos', dir2: 'neg', dist: 80, retract: 2, safeZ: 10, clearOver: 40, wcs: 'active' }, { x: 100, y: 80, z: 20, shape: 'pocket', show: true });
  expect(Math.abs(pocket.datum.x - pocket.centre.x), 'pocket datum X at centre').toBeLessThan(1);
  expect(Math.abs(pocket.datum.y - pocket.centre.y), 'pocket datum Y at centre').toBeLessThan(1);
});
