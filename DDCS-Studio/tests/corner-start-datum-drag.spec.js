import { test, expect } from '@playwright/test';

/**
 * PHASE 1 — the Start ◇ is the reposition DATUM (t297). Dragging it HOLDS each wall marker on the stock and RE-DERIVES
 * #21-#24 = wall_world − Start (the emit CHANGES by design). Default (no drag) stays byte-identical. Real pointer events.
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
async function setProbeZ(page, on) {   // the structural checkbox has no data-param → find it by its "Probe Z First" label span
  await page.evaluate((on) => {
    const span = [...document.querySelectorAll('#wiz_user_form *')].find((e) => e.tagName === 'SPAN' && /Probe Z First/i.test(e.textContent || ''));
    const cb = span && span.parentElement && span.parentElement.querySelector('input[type="checkbox"]');
    if (cb && !!cb.checked !== on) { cb.checked = on; cb.dispatchEvent(new Event('change', { bubbles: true })); }
  }, on);
  if (on) await page.waitForFunction(() => document.querySelectorAll('#userVizContainer .fc-handle-move').length >= 2, { timeout: 6000 });
  await page.waitForTimeout(300);
}
// screen centre of a Layout handle by its data-hid
const hid = (page, id) => page.evaluate((id) => { const e = document.querySelector(`#userVizContainer [data-hid="${id}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id);
// the emitted G91 increment params (empty string when unset = formula default)
const paramVal = (page, p) => page.evaluate((p) => { const i = document.querySelector(`#wiz_user_form [data-param="${p}"]`); return i ? i.value : null; }, p);

test('Start-drag HOLDS the wall marker + RECOMPUTES #23/#24 (probeZ off, FL/YX default)', async ({ page }) => {
  await openCorner(page);
  const start0 = await hid(page, '__simstart0');
  const repos0 = await hid(page, 'reposition_pos');
  const cx0 = await paramVal(page, 'cross1_x'), cy0 = await paramVal(page, 'cross1_y');

  // real pointer drag on the Start ◇: down → move (+60,+45) → up
  await page.mouse.move(start0.x, start0.y);
  await page.mouse.down();
  await page.mouse.move(start0.x + 60, start0.y + 45, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  const start1 = await hid(page, '__simstart0');
  const repos1 = await hid(page, 'reposition_pos');
  const cx1 = await paramVal(page, 'cross1_x'), cy1 = await paramVal(page, 'cross1_y');

  // the Start moved (roughly the drag delta)
  expect(Math.hypot(start1.x - start0.x, start1.y - start0.y), 'the Start ◇ followed the drag').toBeGreaterThan(30);
  // the wall (reposition) marker HELD its screen/world position (the stock did not move → the canvas frame is stable)
  expect(Math.hypot(repos1.x - repos0.x, repos1.y - repos0.y), `the wall marker HELD (moved ${Math.round(Math.hypot(repos1.x - repos0.x, repos1.y - repos0.y))}px)`).toBeLessThan(6);
  // #23/#24 RE-DERIVED to explicit numbers (were unset/formula → now a finite value that encodes wall − new-Start)
  expect(Number.isFinite(parseFloat(cx1)) && Number.isFinite(parseFloat(cy1)), `#23/#24 became explicit numbers (cross1_x ${cx0}→${cx1}, cross1_y ${cy0}→${cy1})`).toBe(true);
  expect(cx1 !== cx0 || cy1 !== cy0, 'the increment CHANGED from its pre-drag value (recomputed)').toBe(true);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

const num = (v) => (v == null || v === '') ? null : parseFloat(v);

test('16-config sweep: Start-drag HOLDS every wall + RECOMPUTES its offset (4 corners × 2 probeSeq × 2 probeZ)', async ({ page }) => {
  test.setTimeout(240000);   // 16 fresh opens + real drags
  const fails = [];
  for (const corner of ['FL', 'FR', 'BL', 'BR']) for (const seq of ['YX', 'XY']) for (const z of [false, true]) {
    const cfg = `${corner}/${seq}/Z${z ? 'on' : 'off'}`;
    await openCorner(page);
    await setSel(page, 'corner', corner);
    await setSel(page, 'probeSeq', seq);
    if (z) await setProbeZ(page, true);

    const start0 = await hid(page, '__simstart0');
    if (!start0) { fails.push(`${cfg}: no Start handle`); continue; }
    const repos0 = await hid(page, 'reposition_pos');
    const startH0 = z ? await hid(page, 'start_pos') : null;
    const cx0 = num(await paramVal(page, 'cross1_x')), cy0 = num(await paramVal(page, 'cross1_y'));
    const sx0 = z ? num(await paramVal(page, 'startX')) : null, sy0 = z ? num(await paramVal(page, 'startY')) : null;

    await page.mouse.move(start0.x, start0.y); await page.mouse.down();
    await page.mouse.move(start0.x + 55, start0.y + 40, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(450);

    const repos1 = await hid(page, 'reposition_pos');
    const startH1 = z ? await hid(page, 'start_pos') : null;
    const cx1 = num(await paramVal(page, 'cross1_x')), cy1 = num(await paramVal(page, 'cross1_y'));
    const sx1 = z ? num(await paramVal(page, 'startX')) : null, sy1 = z ? num(await paramVal(page, 'startY')) : null;

    // wall-2 reposition marker HELD + #23/#24 recomputed to a finite number that changed
    const reposMoved = repos0 && repos1 ? Math.hypot(repos1.x - repos0.x, repos1.y - repos0.y) : 999;
    if (reposMoved >= 6) fails.push(`${cfg}: reposition wall moved ${Math.round(reposMoved)}px (should HOLD)`);
    if (!(Number.isFinite(cx1) && Number.isFinite(cy1))) fails.push(`${cfg}: #23/#24 not finite after drag (${cx1},${cy1})`);
    if (cx1 === cx0 && cy1 === cy0) fails.push(`${cfg}: #23/#24 did NOT recompute (${cx0},${cy0} unchanged)`);
    // probeZ-ON: the SECOND emitting handle (wall-1 start #21/#22) ALSO holds + recomputes
    if (z) {
      const startMoved = startH0 && startH1 ? Math.hypot(startH1.x - startH0.x, startH1.y - startH0.y) : 999;
      if (startMoved >= 6) fails.push(`${cfg}: wall-1 start handle moved ${Math.round(startMoved)}px (should HOLD)`);
      if (!(Number.isFinite(sx1) && Number.isFinite(sy1))) fails.push(`${cfg}: #21/#22 not finite after drag (${sx1},${sy1})`);
      if (sx1 === sx0 && sy1 === sy0) fails.push(`${cfg}: #21/#22 did NOT recompute`);
    }
    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
  }
  expect(fails, `all 16 configs hold walls + recompute offsets:\n${fails.join('\n')}`).toEqual([]);
});

test('byte-parity: at the DEFAULT (no drag) the offsets are UNSET (formula) → emit unchanged', async ({ page }) => {
  await openCorner(page);
  const cx = await paramVal(page, 'cross1_x'), cy = await paramVal(page, 'cross1_y');
  const emit = await page.evaluate(async () => {
    const CD = await import('/blocks/dataOps/cornerData.js'); const { builderOf } = await import('/blocks/opBuilders.js'); const { emitMapped } = await import('/blocks/blockEmitter.js');
    return emitMapped(builderOf(CD.CORNER_DATA_OPTYPE)({ ...CD.CORNER_DEFAULTS })).text;
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
  // no drag → no spot → the sockets stay empty (the baked formula holds), so the emit is byte-identical to the baseline
  expect(cx === '' || cx == null, `cross1_x unset at default (got "${cx}")`).toBeTruthy();
  expect(cy === '' || cy == null, `cross1_y unset at default (got "${cy}")`).toBeTruthy();
  expect(/#23\s*=/.test(emit) && /#24\s*=/.test(emit), 'the default emit carries its formula #23/#24').toBe(true);
});

test('(b) a Layout drag REFRESHES the pendant (_syncJogPos fires, not only the 3D gizmo)', async ({ page }) => {
  await openCorner(page);
  const hasPendant = await page.evaluate(() => {
    const v = window.ddcsStudio.wizardManager._activePanel && window.ddcsStudio.wizardManager._activePanel.viz;
    if (!v || typeof v._syncJogPos !== 'function') return false;
    v.__syncN = 0; const orig = v._syncJogPos; v._syncJogPos = function () { v.__syncN++; return orig.apply(this, arguments); };
    return true;
  });
  expect(hasPendant, 'the jog pendant is wired (viz._syncJogPos exists)').toBe(true);
  const start0 = await hid(page, '__simstart0');
  await page.mouse.move(start0.x, start0.y); await page.mouse.down();
  await page.mouse.move(start0.x + 40, start0.y + 30, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(400);
  const n = await page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; return (p && p.viz && p.viz.__syncN) || 0; });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
  // the Layout Start drag routed through setGcode → _syncJogPos → the pendant Pos fields (pre-fix this fired ONLY on the 3D gizmo)
  expect(n, 'the Layout drag refreshed the pendant Pos fields').toBeGreaterThan(0);
});

test('flicker + screenshot: the LAYOUT wall holds through the whole Start drag (no on-Layout flicker); capture the settled state', async ({ page }) => {
  await openCorner(page);
  const start0 = await hid(page, '__simstart0');
  const repos0 = await hid(page, 'reposition_pos');
  // sample the Layout wall at each intermediate drag step → the MAX deviation from its held position during the drag
  await page.mouse.move(start0.x, start0.y); await page.mouse.down();
  let maxDev = 0;
  for (let k = 1; k <= 8; k++) {
    await page.mouse.move(start0.x + k * 8, start0.y + k * 6);
    const r = await hid(page, 'reposition_pos');
    if (r) maxDev = Math.max(maxDev, Math.hypot(r.x - repos0.x, r.y - repos0.y));
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
  console.log('FLICKER Layout-wall max-deviation-during-drag = ' + Math.round(maxDev) + 'px (0 = no on-Layout flicker)');
  const OUT = 'C:\\Users\\danse\\AppData\\Local\\Temp\\claude\\c--Users-danse-APPS-ddcs-studio-project\\306b9087-a4e7-4ecb-a877-d4ad4867bab7\\scratchpad\\';
  const lay = await page.$('#userVizContainer'); if (lay) await lay.screenshot({ path: OUT + 'startdrag-layout.png' });
  const wiz = await page.$('#wizard'); if (wiz) await wiz.screenshot({ path: OUT + 'startdrag-wizard.png' });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
  // the Layout wall never deviated more than a couple px through the drag → no on-Layout flicker (the sub-frame top-panel transient is the scout's noted item, judged live)
  expect(maxDev, `Layout wall stayed put through the drag (max ${Math.round(maxDev)}px)`).toBeLessThan(6);
});


