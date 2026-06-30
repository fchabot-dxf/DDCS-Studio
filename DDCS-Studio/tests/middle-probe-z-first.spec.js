import { test, expect } from '@playwright/test';

// MID-PROBE-Z-FIRST (turn 106) — a "probe Z first" checkbox on the MIDDLE probe, built as a DECLARATION reusing
// middle's OWN twoPass + reposition (NOT a corner copy). When ON: two-pass the TOP surface, write Z0 to #[#70+2],
// reposition to the first wall, THEN the XY centre-finding. The Z probe is its OWN declared sim pass (over the stock
// top) so the render shows Z-pass → reposition → XY-passes. OFF must stay byte-identical (the equivalence gate).
test.use({ viewport: { width: 1000, height: 800 } });

const BASE = { featureType: 'boss', approach: 'auto', inAxis: 'auto', transAxis: 'auto', twoAxis: true, findBoth: true,
               axis: 'X', dir1: 'pos', dir2: 'neg', dist: 80, retract: 2, safeZ: 10, clearOver: 40, wcs: 'active' };

test('macro: OFF byte-identical; ON probes Z first + writes Z0 + reposition before XY (reuses twoPass)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const r = await page.evaluate(async (base) => {
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const w = new MiddleWizard();
    const off = w.generate({ ...base });
    const offFalse = w.generate({ ...base, probeZ: false });
    const on = w.generate({ ...base, probeZ: true });
    const lines = on.split('\n');
    return {
      off, offFalse, on,
      zCommentLine: lines.findIndex((l) => /Z Surface/.test(l)),
      zProbeLine: lines.findIndex((l) => /G31 Z/.test(l)),
      z0WriteLine: lines.findIndex((l) => /#\[#70\+2\]=#57\b/.test(l)),   // Z0 = #57 (the block already radius-comped the Z touch — t131; was [#57-#6] inline)
      repoLine: lines.findIndex((l) => /REPOSITION: jog clear, to the first wall/.test(l)),
      firstXProbeLine: lines.findIndex((l) => /G31 X/.test(l)),
    };
  }, BASE);

  // (1) EQUIVALENCE GATE — probeZ OFF (omitted) and probeZ:false produce identical macros, with NO Z artifacts.
  expect(r.off, 'probeZ omitted === probeZ:false').toBe(r.offFalse);
  expect(/Z Surface|#1907|#\[#70\+2\]/.test(r.off), 'the OFF macro has NO Z-first artifacts (byte-identical)').toBe(false);

  // (2) ON — the Z surface probe runs FIRST (reusing twoPass: G31 Z down), writes Z0 to #[#70+2], reposition, THEN XY.
  expect(r.zProbeLine, 'a G31 Z probe is emitted').toBeGreaterThan(0);
  expect(r.z0WriteLine, 'Z0 written to #[#70+2] (middle WCS convention)').toBeGreaterThan(0);
  expect(r.repoLine, 'a reposition to the first wall is emitted').toBeGreaterThan(0);
  expect(r.firstXProbeLine, 'the XY work still runs').toBeGreaterThan(0);
  // ordering: Z probe → Z0 write → reposition → first X probe
  expect(r.zProbeLine).toBeLessThan(r.z0WriteLine);
  expect(r.z0WriteLine).toBeLessThan(r.repoLine);
  expect(r.repoLine, 'Z datum + reposition happen BEFORE any XY probe').toBeLessThan(r.firstXProbeLine);
});

test('opSimStarts: probeZ declares a leading Z pass over the stock top (sim renders Z first)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const r = await page.evaluate(async (base) => {
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const stock = { x: 60, y: 60, z: 60, shape: 'boss', show: true };
    return {
      off: opSimStarts('middle', { ...base }, stock),
      on: opSimStarts('middle', { ...base, probeZ: true }, stock),
      pocketOn: opSimStarts('middle', { ...base, featureType: 'pocket', probeZ: true }, stock),
      sz: stock.z,
    };
  }, BASE);

  expect(r.on.length, 'ON adds exactly one (leading Z) pass').toBe(r.off.length + 1);
  const z = r.on[0];
  expect(z.x, 'Z pass is over the stock centre X').toBeCloseTo(30, 1);
  expect(z.y, 'Z pass is over the stock centre Y').toBeCloseTo(30, 1);
  expect(z.z, 'Z pass hovers ABOVE the top (probing DOWN)').toBeGreaterThan(0);
  // the XY passes are unchanged, just shifted after the Z pass
  expect(r.on.slice(1)).toEqual(r.off);
  // pocket too: [Z, centre]
  expect(r.pocketOn.length, 'pocket ON = Z pass + the centre pass').toBe(2);
  expect(r.pocketOn[0].z, 'pocket Z pass also hovers above the top').toBeGreaterThan(0);
});

test('Blockly round-trip: probeZ survives params → middle_op block → params', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);

  const r = await page.evaluate(async () => {
    const { workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
    const load = (probeZ) => window.ddcsLoadBlockStack([
      { type: 'op', opType: 'middle', label: 'Middle Probe', params: { featureType: 'boss', findBoth: true, twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg', wcs: 'active', probeZ } },
    ]);
    load(true);
    const onField = window.__blkws.getAllBlocks().find((b) => b.type === 'middle_op')?.getFieldValue('PROBEZ');
    const onBack = workspaceToStack(window.__blkws).find((s) => s.opType === 'middle')?.params.probeZ;
    load(false);
    const offBack = workspaceToStack(window.__blkws).find((s) => s.opType === 'middle')?.params.probeZ;
    return { onField, onBack, offBack };
  });
  expect(r.onField, 'the middle_op block carries PROBEZ checked').toBe('TRUE');
  expect(r.onBack, 'probeZ:true round-trips back through the block').toBe(true);
  expect(r.offBack, 'probeZ:false round-trips back through the block').toBe(false);
});
