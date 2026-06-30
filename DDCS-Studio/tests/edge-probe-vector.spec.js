import { test, expect } from '@playwright/test';

// TRAVEL-START inc1 — the EDGE flip: START ← TRAVEL becomes TRAVEL ← START. The unit test below still covers the GENERIC
// probeVector widget (canvasWidgets.js — kept, may be adopted elsewhere). The integration test now covers the FLIP: the
// edge canvas shows a draggable ① START marker (the SOURCE); dragging it DERIVES the reach (#1) — no typed reach field.
test.use({ viewport: { width: 1280, height: 900 } });

// ── Unit: the generic probeVector gesture (cardinal snap → axis+dir enums + reach) — the widget itself is unchanged ─────
test('probeVector gesture: place from axis/dir/dist; drag snaps to the nearest cardinal + maps the reach', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
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

// ── Integration: TRAVEL-START inc1 — the START marker is the SOURCE; dragging it DERIVES the reach (#1) ───────────────
test('edge wizard: the ① start marker is the source — dragging it sticks + DERIVES the reach (read-only MAX PROBE)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('edge'));
  await page.waitForSelector('#wiz_edge', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#edgeLayoutCanvas .fc-handle'));

  // the reach is a READ-ONLY readout — the start is the source, you don't type the reach (the field is DROPPED as editable)
  expect(await page.evaluate(() => document.getElementById('p_dist').hasAttribute('readonly')), 'MAX PROBE is a read-only readout').toBeTruthy();

  // grab the ① START handle (a 'move' rect: centre = x + w/2, y + h/2) in client px
  const grab = () => page.evaluate(() => {
    const h = document.querySelector('#edgeLayoutCanvas .fc-handle');
    const svg = document.querySelector('#edgeLayoutCanvas svg').getBoundingClientRect();
    const cx = h.hasAttribute('cx') ? +h.getAttribute('cx') : +h.getAttribute('x') + (+h.getAttribute('width') || 12) / 2;
    const cy = h.hasAttribute('cy') ? +h.getAttribute('cy') : +h.getAttribute('y') + (+h.getAttribute('height') || 12) / 2;
    return { cx, cy, svgL: svg.left, svgT: svg.top };
  });

  const g = await grab();
  // drag the start AWAY from the wall (X+ → wall at world x=0; screen-left = world −x = a larger outset = a longer reach)
  await page.mouse.move(g.svgL + g.cx, g.svgT + g.cy);
  await page.mouse.down();
  await page.mouse.move(g.svgL + g.cx - 60, g.svgT + g.cy, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('#edgeLayoutCanvas .fc-handle'));   // canvas re-rendered

  // the START is the SOURCE: it STUCK where dropped (userStarts beats the inferred hint), and the reach DERIVED from it.
  const r = await page.evaluate(() => {
    const start = window.ddcsStudio.wizardManager._activePanel.getPassStarts()[0];
    return { startX: start.x, dist: +document.getElementById('p_dist').value };
  });
  expect(r.startX, 'the start stuck OUTSIDE the probed wall (x<0 for X+)').toBeLessThan(0);
  const expected = Math.max(1, Math.round(Math.abs(r.startX - 0) / 0.6));   // tieEdgeDist: reach = round(outset / 0.6)
  expect(r.dist, 'the reach DERIVES from the dragged start — round(outset / 0.6)').toBe(expected);
});
