import { test, expect } from './support/harness.mjs';

// TRAVEL-START inc1 (EDGE) — DROP the "reach" ARROW (the GUI element), ADD a draggable ① START marker. The unit test below
// still covers the GENERIC probeVector widget (canvasWidgets.js — kept). The integration test (edge-probe-vector-drive.spec.js)
// covers the DECOUPLED model: the start marker (the "reach") moves the SIM start; MAX PROBE (#1) stays a SEPARATE editable
// safety field, untouched.

// ── Unit: the generic probeVector gesture (cardinal snap → axis+dir enums + reach) — the widget itself is unchanged ─────
test('probeVector gesture: place from axis/dir/dist; drag snaps to the nearest cardinal + maps the reach', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { buildCanvasWidgets } = await import('/viz/canvasWidgets.js');
    const decl = (axis, dir, dist) => [{ type: 'probeVector', id: 'p', cx: 50, cy: 40, axis, dir, dist, fieldAxis: 'p_axis', fieldDir: 'p_dir', field: 'p_dist', minR: 1, label: 'reach', value: dist }];
    const placed = (axis, dir, dist) => buildCanvasWidgets(decl(axis, dir, dist), () => {}).handles[0];
    // drag returns the {field:value} map for a world point; capture it via setFields
    const dragTo = (w) => { let out = null; const { onDrag } = buildCanvasWidgets(decl('X', 'pos', 15), (m) => { out = m; }); onDrag('p', w); return out; };
    return {
      placeXpos: placed('X', 'pos', 15),    // tip at centre + 15 in +X
      placeYneg: placed('Y', 'neg', 20),    // tip at centre − 20 in Y
      dragXpos: dragTo({ x: 90, y: 41 }),    // mostly +X, tiny +Y → snaps X/pos
      dragYneg: dragTo({ x: 51, y: 10 }),    // mostly −Y → snaps Y/neg
      dragXneg: dragTo({ x: 20, y: 38 }),    // mostly −X → snaps X/neg
    };
  });
  expect(r.placeXpos).toMatchObject({ x: 65, y: 40 });       // 50+15, 40
  expect(r.placeYneg).toMatchObject({ x: 50, y: 20 });       // 50, 40−20
  expect(r.dragXpos).toMatchObject({ p_axis: 'X', p_dir: 'pos' });
  expect(r.dragXpos.p_dist).toBeCloseTo(40, 0);             // hypot(40,1) ≈ 40
  expect(r.dragYneg).toMatchObject({ p_axis: 'Y', p_dir: 'neg' });
  expect(r.dragXneg).toMatchObject({ p_axis: 'X', p_dir: 'neg' });
});
