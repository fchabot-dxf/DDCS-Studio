import { test, expect } from '@playwright/test';

/**
 * ASSERT-THE-VALUE (t305) — the parity guards prove the two panels AGREE, NOT that the marker is at the geometrically
 * CORRECT stock spot (a marker wrong in BOTH panels passes green — the class the human's eye caught). This pins each
 * rendered probe-marker world against an INDEPENDENT geometric truth computed OUTSIDE the render path from
 * {datum corner + stock dims + declared offsets + stylus radius + retract}, across all 16 configs incl probeZ-first's
 * 2 emitting markers. The truth reproduces the machine-faithful chain — including the passEnds probe-touch+retract
 * relocation — so it ALSO nets the passEnds[0].y latent-bug flag (a wrong runtime end fails the assert).
 *
 * Model (verified against 4 configs in the DIAG pass): the tool approaches each wall from OUTSIDE, offset along it by
 * travelDist; the FIRST pass renders at its approach; a reposition-destination pass renders at the PREVIOUS pass's
 * runtime END + its declared offset; the runtime END of a wall probe = wall_edge − probeDir·(stylusR + retract) on the
 * probe axis, unchanged on the along axis; a Z-surface probe leaves XY untouched.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function openCorner(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js'); localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef()); });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#userVizContainer .fc-handle-sim', { timeout: 8000 });
  await page.waitForTimeout(400);
}
async function setSel(page, param, value) {
  await page.evaluate(({ param, value }) => { const s = document.querySelector(`#wiz_user_form [data-param="${param}"]`); if (s && s.value !== value) { s.value = value; s.dispatchEvent(new Event('change', { bubbles: true })); } }, { param, value });
  await page.waitForTimeout(300);
}
async function setProbeZ(page, on) {
  await page.evaluate((on) => {
    const span = [...document.querySelectorAll('#wiz_user_form *')].find((e) => e.tagName === 'SPAN' && /Probe Z First/i.test(e.textContent || ''));
    const cb = span && span.parentElement && span.parentElement.querySelector('input[type="checkbox"]');
    if (cb && !!cb.checked !== on) { cb.checked = on; cb.dispatchEvent(new Event('change', { bubbles: true })); }
  }, on);
  if (on) await page.waitForFunction(() => document.querySelectorAll('#userVizContainer .fc-handle-move').length >= 2, { timeout: 6000 });
  await page.waitForTimeout(300);
}
const paramNum = (page, p, dflt) => page.evaluate(({ p, dflt }) => { const i = document.querySelector(`#wiz_user_form [data-param="${p}"]`); const v = i ? parseFloat(i.value) : NaN; return Number.isFinite(v) ? v : dflt; }, { p, dflt });

const rendered = (page) => page.evaluate(() => {
  const panel = window.ddcsStudio.wizardManager._activePanel; const viz = panel && panel.viz;
  const markers = (viz && viz.spindleMarkers || []).map((m) => ({ x: +m.position.x, y: +m.position.y }));
  const sk = window.ddcsGetSettings().stock;
  return { markers, sx: sk.x, sy: sk.y };
});

// ── THE INDEPENDENT GEOMETRIC TRUTH — computed OUTSIDE the render path, from declared inputs only ────────────────────
// The expected RENDERED world for each probe marker (order = zsurf?, wall1, wall2), given the config + physical params.
function truthMarkers(corner, seq, probeZ, sx, sy, td, stylusR, retract) {
  const dirs = { FL: ['+', '+'], FR: ['-', '+'], BL: ['+', '-'], BR: ['-', '-'] }[corner];
  const [xd, yd] = dirs;
  const xDir = xd === '+' ? 1 : -1, yDir = yd === '+' ? 1 : -1;
  const cornerX = (corner === 'FR' || corner === 'BR') ? sx : 0;   // the datum stock corner
  const cornerY = (corner === 'BL' || corner === 'BR') ? sy : 0;
  const standoff = stylusR + retract;                              // the probe leaves the tool this far from the wall edge

  // zsurf = a small inset frac near the corner, mirrored to the corner via the probe-dir signs (the chain ANCHOR — present
  // even when probeZ is off, per cornerData's t109 prefill). Its marker only shows under probeZ, but the chain uses it always.
  const zf = { x: sx * 0.07, y: sy * 0.0875 };
  const zsurf = { x: xd === '-' ? sx - zf.x : zf.x, y: yd === '-' ? sy - zf.y : zf.y };

  // #21/#22 (Z→wall1) + #23/#24 (wall1→wall2) reposition offsets, from the first-wall axis + the corner signs.
  const fA = seq === 'YX' ? 'Y' : 'X';                             // first wall axis
  const fD = fA === 'Y' ? yd : xd;                                 // first wall probe dir
  const own = (d) => (d === '+' ? td : -td), opp = (d) => (d === '+' ? -td : td);
  const off1 = { dx: fA === 'X' ? opp(fD) : 0, dy: fA === 'Y' ? opp(fD) : 0 };
  const off2 = { dx: fA === 'X' ? own(xd) : opp(xd), dy: fA === 'Y' ? own(yd) : opp(yd) };

  const wall1Approach = { x: zsurf.x + off1.dx, y: zsurf.y + off1.dy };
  // The RUNTIME END of the wall1 probe = wall_edge − probeDir·standoff on the probe axis, approach coord on the along axis.
  const wall1End = (fA === 'Y')
    ? { x: wall1Approach.x, y: cornerY - yDir * standoff }         // Y-wall first: probe in Y, along = X
    : { x: cornerX - xDir * standoff, y: wall1Approach.y };        // X-wall first: probe in X, along = Y
  const wall2Marker = { x: wall1End.x + off2.dx, y: wall1End.y + off2.dy };

  // Rendered order: [zsurf?] then wall1 then wall2. wall1 renders at its approach in BOTH probeZ states (probeZ on: it is
  // passEnds[zsurf] + off1, and a Z probe leaves XY = zsurf, so == the approach). zsurf renders at its approach (pass 0).
  const out = [];
  if (probeZ) out.push({ id: 'zsurf', ...zsurf });
  out.push({ id: 'wall1', ...wall1Approach });
  out.push({ id: 'wall2', ...wall2Marker });
  return out;
}

const CONFIGS = [];
for (const corner of ['FL', 'FR', 'BL', 'BR']) for (const seq of ['YX', 'XY']) for (const z of [false, true]) CONFIGS.push([corner, seq, z]);
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('ASSERT-THE-VALUE: every probe marker sits at the INDEPENDENT geometric truth across all 16 configs', async ({ page }) => {
  test.setTimeout(240000);
  const fails = [];
  for (const [corner, seq, z] of CONFIGS) {
    const cfg = `${corner}/${seq}/Z${z ? 'on' : 'off'}`;
    await openCorner(page);
    await setSel(page, 'corner', corner);
    await setSel(page, 'probeSeq', seq);
    if (z) await setProbeZ(page, true);
    const td = await paramNum(page, 'travelDist', 50);
    const retract = await paramNum(page, 'retract', 5);
    const stylusR = await paramNum(page, 'radius', 2);
    const r = await rendered(page);
    const truth = truthMarkers(corner, seq, z, r.sx, r.sy, td, stylusR, retract);
    if (r.markers.length !== truth.length) { fails.push(`${cfg}: marker count ${r.markers.length} != expected ${truth.length}`); continue; }
    for (let i = 0; i < truth.length; i++) {
      const dv = d(r.markers[i], truth[i]);
      if (dv >= 1) fails.push(`${cfg}: ${truth[i].id} rendered (${r.markers[i].x.toFixed(1)},${r.markers[i].y.toFixed(1)}) != truth (${truth[i].x.toFixed(1)},${truth[i].y.toFixed(1)}) Δ=${dv.toFixed(2)}mm`);
    }
    console.log(`${cfg}: ${truth.map((t, i) => `${t.id} Δ=${d(r.markers[i], truth[i]).toFixed(2)}`).join('  ')}`);
    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
  }
  expect(fails, `every probe marker at its independent geometric truth (<1mm):\n${fails.join('\n')}`).toEqual([]);
});

test('NON-TAUTOLOGICAL: the assert FAILS when the expected offset is deliberately mutated', async ({ page }) => {
  await openCorner(page);
  await setSel(page, 'corner', 'FL'); await setSel(page, 'probeSeq', 'YX');
  const r = await rendered(page);
  const good = truthMarkers('FL', 'YX', false, r.sx, r.sy, 50, 2, 5);
  // wall2 matches the CORRECT truth...
  expect(d(r.markers[1], good[1]), 'wall2 matches the correct truth').toBeLessThan(1);
  // ...and does NOT match a truth built with the wall2 offset flipped (proves the assert constrains the VALUE, not a shape)
  const mutated = truthMarkers('FL', 'YX', false, r.sx, r.sy, -50, 2, 5);   // travelDist negated → off1/off2 flip
  expect(d(r.markers[1], mutated[1]), 'wall2 does NOT match a mutated-offset truth — the assert has teeth').toBeGreaterThan(10);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
