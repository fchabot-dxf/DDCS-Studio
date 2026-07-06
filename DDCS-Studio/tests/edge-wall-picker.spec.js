import { test, expect } from '@playwright/test';

/**
 * EDGE-PORT E6 — the VISUAL WALL PICKER (human t342). Instead of the Axis/Direction dropdowns, CLICK a stock wall on the
 * canvas → sets axis+dir in ONE gesture (prefer-gui-over-fields; UX parity with corner's fc-corner-pick). The 4 clickable
 * edges map Left(x=0)→X/pos · Right(x=W)→X/neg · Front(y=0)→Y/pos · Back(y=H)→Y/neg. ASSERT-THE-VALUE: clicking a wall sets
 * the RIGHT axis+dir; the dropdowns stay in sync; the picker is a PURE INPUT (writes the params via the dropdowns' own change
 * seam) → the emit for a picked selection is BYTE-IDENTICAL to the built-in edge for that axis+dir (no new emit path).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('edge wall picker: clicking a stock wall sets axis+dir, syncs the dropdowns, emit == the built-in for that selection', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);

  // (1) UNIT — the edge op's layoutSpec carries the picker (edgeSel + onEdgePick); a non-axis/dir op (corner) does NOT
  const unit = await page.evaluate(async () => {
    const { edgeDataDef, EDGE_DEFAULTS } = await import('/blocks/dataOps/edgeData.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
    const es = layoutSpecFromOp(edgeDataDef(), { ...EDGE_DEFAULTS, axis: 'X', dir: 'pos' }, null, null);
    const cs = layoutSpecFromOp(CD.cornerDataDef(), CD.CORNER_DEFAULTS, null, null);
    return { edgeSel: es.edgeSel, hasOnEdgePick: typeof es.onEdgePick === 'function', cornerHasPicker: typeof cs.onEdgePick === 'function' };
  });
  expect(unit.edgeSel, 'the edge layoutSpec carries the current wall selection').toEqual({ axis: 'X', dir: 'pos' });
  expect(unit.hasOnEdgePick, 'the edge layoutSpec carries onEdgePick').toBe(true);
  expect(unit.cornerHasPicker, 'a non-axis/dir op (corner) does NOT get the edge picker (opt-in)').toBe(false);

  // (2) REAL-SYMPTOM — open the edge data-op (X/pos default) + CLICK a stock wall via a real pointer event on the canvas
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const ED = await import('/blocks/dataOps/edgeData.js'); localStorage.removeItem('ddcs_user_ops'); U.createUserOp(ED.edgeDataDef()); });
  await page.evaluate(() => window.openWiz('user_edge_data'));
  await page.waitForSelector('#wiz_user_form [data-param="axis"]', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(600);

  const clickWall = async (axis, dir) => {
    await page.evaluate(({ axis, dir }) => {
      const line = document.querySelector(`#userVizContainer svg .fc-edge-pick[data-axis="${axis}"][data-dir="${dir}"]`);
      const svg = line.ownerSVGElement || line.closest('svg');
      const r = line.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      svg.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true, cancelable: true, pointerId: 1 }));
    }, { axis, dir });
    await page.waitForTimeout(400);
    return page.evaluate(async () => {
      const axisV = document.querySelector('#wiz_user_form [data-param="axis"]').value;
      const dirV = document.querySelector('#wiz_user_form [data-param="dir"]').value;
      const { edgeStack } = await import('/wizards/edgeWizard.js');
      const { edgeDataDef, EDGE_DEFAULTS } = await import('/blocks/dataOps/edgeData.js');
      const { builderOf } = await import('/blocks/opBuilders.js');
      const { emitMapped } = await import('/blocks/blockEmitter.js');
      const p = { ...EDGE_DEFAULTS, axis: axisV, dir: dirV };
      const emit = emitMapped(builderOf('user_edge_data')(p)).text;
      const builtIn = emitMapped(edgeStack(p)).text;
      return { axisV, dirV, emitMatchesBuiltIn: emit === builtIn };
    });
  };

  const rightEdge = await clickWall('X', 'neg');   // the RIGHT wall → X / neg
  const frontEdge = await clickWall('Y', 'pos');   // the FRONT wall → Y / pos
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  // clicking the RIGHT wall set X/neg; the dropdowns synced; the emit == the built-in edge for X/neg (pure input, no new path)
  expect(rightEdge.axisV, 'clicking the right wall set axis=X').toBe('X');
  expect(rightEdge.dirV, 'clicking the right wall set dir=neg').toBe('neg');
  expect(rightEdge.emitMatchesBuiltIn, 'the picked X/neg emit == the built-in edge for X/neg (byte-identical — a pure input)').toBe(true);
  // clicking the FRONT wall then set Y/pos (a different wall, one gesture)
  expect(frontEdge.axisV, 'clicking the front wall set axis=Y').toBe('Y');
  expect(frontEdge.dirV, 'clicking the front wall set dir=pos').toBe('pos');
  expect(frontEdge.emitMatchesBuiltIn, 'the picked Y/pos emit == the built-in edge for Y/pos').toBe(true);
});
