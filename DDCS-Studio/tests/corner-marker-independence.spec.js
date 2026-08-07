import { test, expect } from '@playwright/test';

/**
 * CORNER-MARKER INDEPENDENCE (t120 Option A, HARDENED t122) — human directive (t116): "i dont want any coupling". Every
 * corner-datum emitting handle is FULLY INDEPENDENT: dragging one leaves the others at their MACHINE TARGET (their emitted
 * G91 increment re-derives off the moved planned anchor via a DATUM-RELATIVE spot store — one source off the trace's
 * passEnds, t107). Before this, #23/#24 (wall-2) was a FIXED increment off wall-1's end, so dragging the START (#21/#22)
 * rode M2 along.
 *
 * These specs assert the VALUE, not just the visual freeze: the reposition's actual machine world = passEnds[wall1] + (#23,#24)
 * (wall1 = the pass BEFORE wall2 = passEnds[len-2], robust in both probeZ states). Removing the panel-derive _writeParam
 * (panelTypes.js) leaves the handle VISUALLY frozen (the draw uses a local offset) but emits a WRONG machine target — so a
 * value assert is REQUIRED to catch it. Handles are keyed by their STABLE data-hid (start_pos / reposition_pos), never by
 * sort-by-screen-position. Test (5) locks the t122 cross-instance byte-parity fix (spots cleared per wizard OPEN).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function openCorner(page, probeZ) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsInteractive === '1');
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form input[type="number"]', { state: 'visible' });
  if (probeZ) {
    await page.evaluate(() => {
      const span = [...document.querySelectorAll('#wiz_user_form *')].find((e) => e.tagName === 'SPAN' && /Probe Z First/i.test(e.textContent || ''));
      const cb = span && span.parentElement && span.parentElement.querySelector('input[type="checkbox"]');
      if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await page.waitForFunction(() => document.querySelectorAll('#userVizContainer .fc-handle-move').length >= 2, { timeout: 6000 });
  } else {
    await page.waitForSelector('#userVizContainer .fc-handle-move', { timeout: 6000 });
  }
}

// full machine state: each emitting handle's screen box + the trace passEnds (world) + the emitted #21..#24 (number | 'EXPR')
const readMachine = (page) => page.evaluate(() => {
  const R = (n) => Math.round(n * 1000) / 1000;
  const handles = {};
  for (const el of document.querySelectorAll('#userVizContainer [data-hid]')) {
    const b = el.getBoundingClientRect(); handles[el.getAttribute('data-hid')] = { cx: R(b.x + b.width / 2), cy: R(b.y + b.height / 2) };
  }
  const b3 = document.getElementById('userViz3dContainer'); const host = b3 && b3.parentElement && b3.parentElement.querySelector('.wiz-viz3d'); const panel = host && host.__panel;
  const passEnds = (panel && panel.getPassEnds) ? panel.getPassEnds() : null;
  const code = (document.getElementById('wiz_user_code') || {}).textContent || '';
  const pv = (v) => { const m = code.split('\n').find((l) => new RegExp('#' + v + '\\s*=').test(l)); if (!m) return null; const mm = m.match(new RegExp('#' + v + '\\s*=\\s*(-?[0-9.]+)\\b')); return mm ? parseFloat(mm[1]) : 'EXPR'; };
  return { handles, passEnds: passEnds ? passEnds.map((e) => e ? { x: R(e.x), y: R(e.y) } : null) : null, code, p: { 21: pv(21), 22: pv(22), 23: pv(23), 24: pv(24) } };
});
// the reposition's machine world = wall1's runtime END (the pass before wall2 = passEnds[len-2]) + the emitted #23/#24 increment
const repoWorld = (m) => { const w1 = m.passEnds[m.passEnds.length - 2]; return { x: w1.x + m.p['23'], y: w1.y + m.p['24'] }; };
const startWorld = (m) => { const zs = m.passEnds[0]; return { x: zs.x + m.p['21'], y: zs.y + m.p['22'] }; };  // start #21/#22 anchors on the zsurf end
async function dragHid(page, m, hid, dx, dy) {
  const h = m.handles[hid];
  await page.mouse.move(h.cx, h.cy); await page.mouse.down();
  await page.mouse.move(h.cx + dx, h.cy + dy, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(380);
}
const screenMove = (a, b, hid) => Math.hypot(a.handles[hid].cx - b.handles[hid].cx, a.handles[hid].cy - b.handles[hid].cy);

// (1) VALUE — dragging the START (the formerly-coupled direction) keeps the reposition's MACHINE TARGET fixed. First bake
//     the reposition to a literal (a numeric baseline), then drag the start: passEnds[wall1] moves, so #23/#24 MUST re-derive
//     to hold the same world. Removing the panel-derive _writeParam leaves #23/#24 stale → this assert goes RED.
test('(1) drag START → reposition machine world (passEnds[wall1]+#23/#24) is preserved', async ({ page }) => {
  await openCorner(page, true);
  // bake the reposition to a numeric world so the baseline is a literal (not a socket expression)
  let m = await readMachine(page);
  await dragHid(page, m, 'reposition_pos', -46, 40);
  const baked = await readMachine(page);
  expect(typeof baked.p['23'], '#23 baked to a literal').toBe('number');
  const world0 = repoWorld(baked);
  // now drag the START — the formerly-coupled direction
  await dragHid(page, baked, 'start_pos', 60, -50);
  const after = await readMachine(page);
  expect(screenMove(baked, after, 'start_pos'), 'the dragged start moved').toBeGreaterThan(20);
  expect(screenMove(baked, after, 'reposition_pos'), 'reposition stays put visually').toBeLessThan(3);
  // the WALL-1 END actually moved (so a stale #23 would be wrong) …
  expect(Math.abs(after.passEnds[after.passEnds.length - 2].x - baked.passEnds[baked.passEnds.length - 2].x), 'wall-1 end moved').toBeGreaterThan(5);
  // … yet the reposition's MACHINE WORLD is preserved (its increment re-derived off the moved anchor)
  const world1 = repoWorld(after);
  expect(world1.x, 'reposition machine world X preserved (value)').toBeCloseTo(world0.x, 1);
  expect(world1.y, 'reposition machine world Y preserved (value)').toBeCloseTo(world0.y, 1);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

// (2) VALUE — dragging the reposition keeps the START's machine world fixed (independence the other way, value-asserted)
test('(2) drag reposition → start machine world (zsurf end+#21/#22) is preserved', async ({ page }) => {
  await openCorner(page, true);
  let m = await readMachine(page);
  await dragHid(page, m, 'start_pos', 44, -36);      // bake the start to a literal baseline
  const baked = await readMachine(page);
  expect(typeof baked.p['21'], '#21 baked to a literal').toBe('number');
  const s0 = startWorld(baked);
  await dragHid(page, baked, 'reposition_pos', -52, 46);
  const after = await readMachine(page);
  expect(screenMove(baked, after, 'reposition_pos'), 'the dragged reposition moved').toBeGreaterThan(20);
  expect(screenMove(baked, after, 'start_pos'), 'start stays put visually').toBeLessThan(3);
  const s1 = startWorld(after);
  expect(s1.x, 'start machine world X preserved (value)').toBeCloseTo(s0.x, 1);
  expect(s1.y, 'start machine world Y preserved (value)').toBeCloseTo(s0.y, 1);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

// (3) default undragged emit keeps the #23/#24 socket EXPRESSION (no baked literal) — byte-identical at rest
test('(3) default undragged emit keeps the #23/#24 socket expression (no literal override)', async ({ page }) => {
  await openCorner(page, true);
  const m = await readMachine(page);
  expect(m.p['23'], 'undragged #23 is a socket expression, not a literal').toBe('EXPR');
  expect(m.p['24'], 'undragged #24 is a socket expression, not a literal').toBe('EXPR');
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

// (4) VALUE — drag then change corner: the reposition's DATUM-RELATIVE spot (world − cornerXY) is PRESERVED across the
//     re-anchor (not merely "moved"). cornerXY: FL=(0,0) → BR=(stock.w, stock.h).
test('(4) drag then change corner → the datum-relative spot (dx,dy) is preserved', async ({ page }) => {
  await openCorner(page, true);
  const stock = await page.evaluate(() => { const s = window.ddcsGetSettings && window.ddcsGetSettings().stock; return { w: s.x, h: s.y }; });
  let m = await readMachine(page);
  await dragHid(page, m, 'reposition_pos', 48, -34);
  const before = await readMachine(page);
  const spot0 = { dx: repoWorld(before).x - 0, dy: repoWorld(before).y - 0 };   // FL corner = (0,0)
  await page.evaluate(() => { const sel = document.querySelector('#wiz_user_form [data-param="corner"]'); if (sel) { sel.value = 'BR'; sel.dispatchEvent(new Event('change', { bubbles: true })); } });
  await page.waitForTimeout(420);
  const after = await readMachine(page);
  const spot1 = { dx: repoWorld(after).x - stock.w, dy: repoWorld(after).y - stock.h };   // BR corner = (w,h)
  expect(spot1.dx, 'datum-relative dx preserved across the corner change').toBeCloseTo(spot0.dx, 1);
  expect(spot1.dy, 'datum-relative dy preserved across the corner change').toBeCloseTo(spot0.dy, 1);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

// (5) CROSS-INSTANCE BYTE-PARITY (t122 PART 1) — a freshly-opened, undragged corner emits byte-identical REGARDLESS of a
//     prior corner instance's drags. Capture the pristine default, drag a marker (baking a literal), RE-OPEN the wizard
//     (a new editing session) → its emit must equal the pristine default (spots are cleared per OPEN, not per opType).
test('(5) re-opening a corner after a drag emits byte-identical (no cross-instance spot leak)', async ({ page }) => {
  await openCorner(page, false);
  const pristine = (await readMachine(page)).code;
  let m = await readMachine(page);
  await dragHid(page, m, 'reposition_pos', -50, 44);
  const dragged = (await readMachine(page)).code;
  expect(dragged, 'the drag actually changed the emit').not.toBe(pristine);
  // re-open the wizard (instance #2, same opType) — onShow clears the spot store
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#userVizContainer .fc-handle-move', { timeout: 6000 });
  const reopened = (await readMachine(page)).code;
  expect(reopened, 'a freshly-opened corner is byte-identical to the default (no leaked spot)').toBe(pristine);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
