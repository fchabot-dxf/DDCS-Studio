import { test, expect } from '@playwright/test';

/**
 * t107 CROSS-SURFACE COHERENCE — the Layout FeatureCanvas reposition handle (panelTypes.layoutSpecFromOp, REAL code)
 * and the top-panel 3D/2D marker sprite (gcodeViz3d._markerWorld / toolpath2d.markerWorld) must land on the SAME point,
 * fed the SAME passEnds, in BOTH travel modes:
 *   • AUTO  — the programmed dog-leg relocates ② to passEnds[wall1] + cross on ALL surfaces (machine-faithful).
 *   • MANUAL — the operator jogs (no programmed dog-leg → anchorsAtPrev is FALSE), so ② stays at the DECLARED wall-2 on
 *     ALL surfaces. The panelTypes shift is GATED on the destination's anchorsAtPrev EXACTLY like _markerWorld, so the
 *     Layout handle can't relocate while the marker doesn't (the divergence an adversarial pass caught: manual handle at
 *     the relocated spot while the marker stayed declared → 36-unit gap).
 * Deterministic (one trace → one passEnds; both surfaces read it). probeZ ON so wall-1 is itself a reposition destination.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('Layout handle == 3D/2D marker for BOTH auto (relocated) and manual (declared) travel — one passEnds, gated alike', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form [data-param="cross1_x"]', { state: 'attached' });   // t1303 — ATTACHED, not visible: this field is DECLARED out of the form (its editor is the canvas handle), so its presence is what proves the handle is built
  const r = await page.evaluate(async () => {
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
    const { opSimStarts, resolveRelToIndex } = await import('/viz/opSimStarts.js');
    registerUserOp(CD.cornerDataDef());
    const def = CD.cornerDataDef();
    const build = builderOf(CD.CORNER_DATA_OPTYPE);
    const stock = { x: 100, y: 80, z: 20, shape: 'box', show: true };
    const R = (n) => Math.round(n * 100) / 100;
    // the 3D/2D marker-sprite transform, VERBATIM from gcodeViz3d._markerWorld / toolpath2d.markerWorld
    const markerWorld = (rows, ends, i) => {
      const row = rows[i], prev = rows[i - 1], end = ends[i - 1];
      if (row.anchorsAtPrev && i > 0 && end && prev) return { x: end.x + (row.x - prev.x), y: end.y + (row.y - prev.y) };
      return { x: row.x, y: row.y };
    };
    const probe = (ta) => {
      const p = { ...CD.CORNER_DEFAULTS, probeZFirst: 1, travelApproach: ta };
      const declared = def.simStartsProvider(p, stock).map((m) => ({ x: m.x, y: m.y, z: m.z || 0, anchorsAtPrev: !!m.anchorsAtPrev }));
      const gcode = emitMapped(build(p)).text;
      const passEnds = traceToolpath(gcode, { stock, start: declared[0], passStarts: declared }).passEnds || [];
      const ri = resolveRelToIndex(def.opType, p, { row: 'wall1' });   // wall-1 among surviving (=1 under probeZ)
      const starts = opSimStarts(def.opType, p, stock) || [];
      const declWall2 = starts[ri + 1];                                // the DECLARED (start-based) wall-2
      const handle = (layoutSpecFromOp(def, p, null, null, passEnds).handles || []).find((h) => h.id === 'reposition_pos');
      const marker = markerWorld(declared, passEnds, ri + 1);          // the 3D/2D sprite for the wall-2 pass
      const relocated = { x: passEnds[ri].x + (declWall2.x - starts[ri].x), y: passEnds[ri].y + (declWall2.y - starts[ri].y) };
      return {
        ta, flagged: !!declared[ri + 1].anchorsAtPrev,
        handle: { x: R(handle.x), y: R(handle.y) }, marker: { x: R(marker.x), y: R(marker.y) },
        declWall2: { x: R(declWall2.x), y: R(declWall2.y) }, relocated: { x: R(relocated.x), y: R(relocated.y) },
      };
    };
    return { auto: probe('auto'), manual: probe('manual') };
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  const eq = (a, b) => Math.abs(a.x - b.x) < 0.05 && Math.abs(a.y - b.y) < 0.05;
  // AUTO — a programmed dog-leg: BOTH surfaces relocate ② to passEnds[wall1] + cross (machine-faithful)
  expect(r.auto.flagged, 'auto reposition destination is flagged anchorsAtPrev').toBe(true);
  expect(eq(r.auto.handle, r.auto.marker), `AUTO: Layout handle (${JSON.stringify(r.auto.handle)}) == 3D/2D marker (${JSON.stringify(r.auto.marker)})`).toBe(true);
  expect(eq(r.auto.handle, r.auto.relocated), 'AUTO: both at passEnds[wall1] + cross (relocated)').toBe(true);
  expect(eq(r.auto.handle, r.auto.declWall2), 'AUTO: the relocated point is DISTINCT from the static declared wall-2').toBe(false);
  // MANUAL — the operator jogs (anchorsAtPrev false): BOTH surfaces keep the DECLARED wall-2 (no relocation → no divergence)
  expect(r.manual.flagged, 'manual reposition destination is NOT flagged (operator jogs)').toBe(false);
  expect(eq(r.manual.handle, r.manual.marker), `MANUAL: Layout handle (${JSON.stringify(r.manual.handle)}) == 3D/2D marker (${JSON.stringify(r.manual.marker)}) — no cross-surface divergence`).toBe(true);
  expect(eq(r.manual.handle, r.manual.declWall2), 'MANUAL: both sit at the DECLARED wall-2 (the panelTypes shift is gated on anchorsAtPrev, like _markerWorld)').toBe(true);
});
