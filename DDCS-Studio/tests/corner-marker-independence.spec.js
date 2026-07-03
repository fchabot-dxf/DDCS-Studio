import { test, expect } from '@playwright/test';

/**
 * CORNER-MARKER INDEPENDENCE (t120, Option A) — the human directive (t116): "i dont want any coupling". Every corner-datum
 * emitting handle is FULLY INDEPENDENT: dragging one leaves the others visually PUT (their emitted G91 increment re-derives
 * off the moved planned anchor via a DATUM-RELATIVE spot store — one-source off the trace's passEnds, t107). Before this,
 * #23/#24 (wall-2) was a FIXED increment off wall-1's end, so dragging M1 (#21/#22, the Z→wall1 start) rode M2 along.
 *
 * probeZ-ON reveals BOTH emitting handles (#21/#22 start + #23/#24 reposition = two `.fc-handle-move` rects); the sim-only
 * chain-root ◇ is `.fc-handle-sim` (excluded here). Handles carry no DOM id, so we identify by screen position and assert
 * direction-agnostically: drag either handle → the OTHER stays put. Default (undragged) emit stays the socket expression
 * (byte-identical — the twin==built-in byte-for-byte gate lives in corner-draw-anchor.spec). A drag then a corner change
 * RE-ANCHORS both handles to the new corner (datum-relative). No re-render loop (the test completes; the derive is acyclic).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function openCornerProbeZ(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form input[type="number"]', { state: 'visible' });
  // enable "Probe Z First" so BOTH emitting handles (#21/#22 + #23/#24) render
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#wiz_user_form *')];
    const span = rows.find((e) => e.tagName === 'SPAN' && /Probe Z First/i.test(e.textContent || ''));
    const cb = span && span.parentElement && span.parentElement.querySelector('input[type="checkbox"]');
    if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForFunction(() => document.querySelectorAll('#userVizContainer .fc-handle-move').length >= 2, { timeout: 6000 });
}

// centers of the two emitting handles, deterministically ordered (by x then y), + the emitted code
const readState = (page) => page.evaluate(() => {
  const R = (n) => Math.round(n * 10) / 10;
  const moves = [...document.querySelectorAll('#userVizContainer .fc-handle-move')].map((el) => {
    const b = el.getBoundingClientRect(); return { cx: R(b.x + b.width / 2), cy: R(b.y + b.height / 2) };
  }).sort((a, b) => (a.cx - b.cx) || (a.cy - b.cy));
  return { moves, code: (document.getElementById('wiz_user_code') || {}).textContent || '' };
});

async function drag(page, from, dx, dy) {
  await page.mouse.move(from.cx, from.cy); await page.mouse.down();
  await page.mouse.move(from.cx + dx, from.cy + dy, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(350);
}
const dist = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy);

// (1) drag the FIRST emitting handle → the SECOND stays put (independence, one direction)
test('(1) drag handle A → handle B stays put (no coupling)', async ({ page }) => {
  await openCornerProbeZ(page);
  const before = await readState(page);
  expect(dist(before.moves[0], before.moves[1]), 'the two emitting handles are distinct').toBeGreaterThan(10);
  await drag(page, before.moves[0], 55, -46);
  const after = await readState(page);
  expect(dist(after.moves[0], before.moves[0]), 'dragged handle A moved').toBeGreaterThan(20);
  expect(dist(after.moves[1], before.moves[1]), 'handle B stayed put (independence)').toBeLessThan(3);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

// (2) drag the SECOND emitting handle → the FIRST stays put (independence, other direction)
test('(2) drag handle B → handle A stays put (no coupling either way)', async ({ page }) => {
  await openCornerProbeZ(page);
  const before = await readState(page);
  await drag(page, before.moves[1], -50, 44);
  const after = await readState(page);
  expect(dist(after.moves[1], before.moves[1]), 'dragged handle B moved').toBeGreaterThan(20);
  expect(dist(after.moves[0], before.moves[0]), 'handle A stayed put (independence)').toBeLessThan(3);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

// (3) default (undragged) emit holds the socket EXPRESSION for #23/#24 (no baked literal) — byte-identical at rest
test('(3) default undragged emit keeps the #23/#24 socket expression (no literal override)', async ({ page }) => {
  await openCornerProbeZ(page);
  const { code } = await readState(page);
  const line23 = code.split('\n').find((l) => /#23\s*=/.test(l)) || '';
  const line24 = code.split('\n').find((l) => /#24\s*=/.test(l)) || '';
  // the reposition socket derives from the signed-travel registers (#15/#16), NOT a bare number
  expect(line23 + ' ‖ ' + line24, 'undragged #23/#24 is an expression, not a baked literal').toMatch(/#1[56]/);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

// (4) drag then change corner → BOTH handles re-anchor to the new corner (datum-relative spot store)
test('(4) drag then change corner → both handles re-anchor', async ({ page }) => {
  await openCornerProbeZ(page);
  const before = await readState(page);
  await drag(page, before.moves[0], 40, -34);        // give handle A a spot
  const dragged = await readState(page);
  // switch corner FL → BR via the dropdown ([data-param="corner"])
  await page.evaluate(() => {
    const sel = document.querySelector('#wiz_user_form [data-param="corner"]');
    if (sel) { sel.value = 'BR'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForTimeout(400);
  const after = await readState(page);
  // both handles moved substantially (re-anchored across the stock to the BR corner)
  expect(dist(after.moves[0], dragged.moves[0]), 'handle A re-anchored to the new corner').toBeGreaterThan(30);
  expect(dist(after.moves[1], dragged.moves[1]), 'handle B re-anchored to the new corner').toBeGreaterThan(30);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
