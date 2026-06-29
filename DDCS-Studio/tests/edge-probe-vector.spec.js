import { test, expect } from '@playwright/test';

// FEATURE-CANVAS-IN-PROBE prototype #1: the EDGE probe-VECTOR. ADDITIVE — the axis/dir/dist form fields STAY; the canvas
// ADDS one draggable arrow, two-way synced. Drag the arrow → its CARDINAL direction sets axis+dir, its length sets dist.
// Type a field → the arrow moves. The field VALUES are the one source (the handle is just another view, the drill pattern).
test.use({ viewport: { width: 1280, height: 900 } });

// ── Unit: the probeVector gesture (cardinal snap → axis+dir enums + reach) ──────────────────────────────────────────
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

// ── Integration: both directions of the sync in the real wizard ─────────────────────────────────────────────────────
test('edge wizard: type a field → the arrow moves; drag the arrow → axis/dir/dist update (both directions)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('edge'));
  await page.waitForSelector('#wiz_edge', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#edgeLayoutCanvas .fc-handle'));

  // shaft = the one fc-guide line (centre → tip); handle = the .fc-handle circle at the tip. Both in screen px.
  const shaft = () => page.evaluate(() => {
    const l = document.querySelector('#edgeLayoutCanvas line.fc-guide');
    const h = document.querySelector('#edgeLayoutCanvas .fc-handle');
    const svg = document.querySelector('#edgeLayoutCanvas svg').getBoundingClientRect();
    return { x1: +l.getAttribute('x1'), y1: +l.getAttribute('y1'), x2: +l.getAttribute('x2'), y2: +l.getAttribute('y2'),
             hx: +h.getAttribute('cx'), hy: +h.getAttribute('cy'), svgL: svg.left, svgT: svg.top };
  });

  // FORM → CANVAS: default X+ → shaft horizontal, tip to the right
  let s = await shaft();
  expect(Math.abs(s.x2 - s.x1), 'X+ default: shaft is horizontal').toBeGreaterThan(Math.abs(s.y2 - s.y1));
  expect(s.x2, 'X+ default: tip points +X (right)').toBeGreaterThan(s.x1);

  // type AXIS=Y, DIR=neg, DIST=40 → the arrow becomes vertical, pointing down (world −Y = screen down), and longer
  await page.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
    set('p_axis', 'Y'); set('p_dir', 'neg'); set('p_dist', '40');
  });
  await page.waitForFunction(() => { const l = document.querySelector('#edgeLayoutCanvas line.fc-guide'); return l && Math.abs(+l.getAttribute('y2') - +l.getAttribute('y1')) > Math.abs(+l.getAttribute('x2') - +l.getAttribute('x1')); });
  s = await shaft();
  expect(Math.abs(s.y2 - s.y1), 'Y−: shaft is vertical').toBeGreaterThan(Math.abs(s.x2 - s.x1));
  expect(s.y2, 'Y−: tip points −Y (screen DOWN, y increases)').toBeGreaterThan(s.y1);

  // CANVAS → FORM: drag the handle to ABOVE the centre (screen up = world +Y) → axis Y, dir pos
  const cxScreen = s.svgL + s.x1, cyScreen = s.svgT + s.y1;   // the shaft origin = the centre, in client px
  const hxScreen = s.svgL + s.hx, hyScreen = s.svgT + s.hy;
  await page.mouse.move(hxScreen, hyScreen);
  await page.mouse.down();
  await page.mouse.move(cxScreen + 2, cyScreen - 80, { steps: 5 });   // up + slightly right → cardinal snaps to Y/pos
  await page.mouse.up();
  await page.waitForFunction(() => document.getElementById('p_dir').value === 'pos' && document.getElementById('p_axis').value === 'Y');
  const fields = await page.evaluate(() => ({ axis: document.getElementById('p_axis').value, dir: document.getElementById('p_dir').value, dist: +document.getElementById('p_dist').value }));
  expect(fields.axis, 'drag up → axis Y').toBe('Y');
  expect(fields.dir, 'drag up → dir pos').toBe('pos');
  expect(fields.dist, 'drag set a positive reach').toBeGreaterThan(1);
});
