import { test, expect } from '@playwright/test';

/**
 * PROBESEQ START-POS (t114) — the corner sim-start markers + emit must flip per PROBE-ORDER (probeSeq XY↔YX = which wall
 * is wall-1), not just per corner (t109). Findings: the MARKERS already flip per probeSeq (cornerReposOffsets/axesOf swaps
 * which axis is wall-1/wall-2) — verified below. The bug was the LIVE-FORM EMIT of the Z→wall1 start #21/#22: `startX`'s
 * CANONICAL (FL/YX) socket default is the PERP-axis `'0'` — a FINITE value the t109 omit-fix (non-numeric only) did NOT
 * omit → the form injected startX=0 → it overwrote the pruned per-probeSeq socket (XY wall-1 is X, so #21 should be the
 * X-travel #16, but stayed 0). FIX: a SOCKET-HELD binding (deriveBindings, no spec default) is OMITTED when the field is
 * untouched — even a finite canonical default — so the template's per-combo socket holds. Emit-output correctness; build()
 * byte-identical (build omits the sockets already, so it was always right — the 8-combo check never went through the form).
 */

const stock = { x: 100, y: 80, z: 20, shape: 'box', show: true };
const R = (n) => Math.round(n * 10) / 10;

test('(1) the sim-start markers FLIP per probeSeq (wall order swaps) — build path, independent geometry', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async ({ stock }) => {
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    registerUserOp(CD.cornerDataDef());
    const def = CD.cornerDataDef();
    const out = {};
    for (const c of ['FL', 'BR']) for (const seq of ['YX', 'XY']) {
      out[c + seq] = def.simStartsProvider({ ...CD.CORNER_DEFAULTS, corner: c, probeSeq: seq }, stock).map((m) => [Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10]);
    }
    return out;
  }, { stock });
  // YX: wall1 = the Y-probe start (below/above), wall2 = the X-probe start (left/right). XY = the same two walls SWAPPED.
  expect(r.FLYX, 'FL/YX: wall1 Y-approach (7,-43), wall2 X-approach (-43,7)').toEqual([[7, -43], [-43, 7]]);
  expect(r.FLXY, 'FL/XY: wall1 X-approach (-43,7), wall2 Y-approach (7,-43) — SWAPPED vs YX').toEqual([[-43, 7], [7, -43]]);
  expect(r.BRYX, 'BR/YX').toEqual([[93, 123], [143, 73]]);
  expect(r.BRXY, 'BR/XY — SWAPPED vs YX').toEqual([[143, 73], [93, 123]]);
  // the flip is REAL, not canonical-YX: XY ≠ YX for both corners
  expect(r.FLXY, 'FL/XY is NOT canonical-YX').not.toEqual(r.FLYX);
  expect(r.BRXY, 'BR/XY is NOT canonical-YX').not.toEqual(r.BRYX);
});

test('(2) the sim probe fires on the RIGHT wall per probeSeq (XY last-probe = Y-wall; YX last-probe = X-wall)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async ({ stock }) => {
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    registerUserOp(CD.cornerDataDef());
    const def = CD.cornerDataDef();
    const build = builderOf(CD.CORNER_DATA_OPTYPE);
    const out = {};
    for (const c of ['FL', 'BR']) for (const seq of ['YX', 'XY']) {
      const p = { ...CD.CORNER_DEFAULTS, corner: c, probeSeq: seq };
      const declared = def.simStartsProvider(p, stock).map((m) => ({ x: m.x, y: m.y, z: m.z || 0, anchorsAtPrev: !!m.anchorsAtPrev }));
      const eng = new GcodeExecutionEngine({ autoAnswer: true, stock, stockOffset: declared[0] });
      eng._passStarts = declared;
      eng.trace(emitMapped(build(p)).text);
      out[c + seq] = { x1925: Math.round(eng.vars.get(1925) * 10) / 10, y1926: Math.round(eng.vars.get(1926) * 10) / 10 };
    }
    return out;
  }, { stock });
  // YX: last probe = X-probe → #1925 on the X-wall (FL/BR: x=0−2 / x=100+2). XY: last = Y-probe → #1926 on the Y-wall.
  expect(R(r.FLYX.x1925), 'FL/YX last-probe on the x=0 wall').toBe(-2);
  expect(R(r.FLXY.y1926), 'FL/XY last-probe on the y=0 wall (SWAPPED axis)').toBe(-2);
  expect(R(r.BRYX.x1925), 'BR/YX last-probe on the x=100 wall').toBe(102);
  expect(R(r.BRXY.y1926), 'BR/XY last-probe on the y=80 wall (SWAPPED axis)').toBe(82);
});

test('(3) LIVE form — the emitted Z→wall1 start #21/#22 (+ dog-leg #23/#24) flip per probeSeq (socket-held fix)', async ({ page }) => {
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
  // probeZFirst ON (so #21/#22 emit), FL
  await page.evaluate(() => { const cb = document.querySelector('#wiz_user_form input[type="checkbox"]'); if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); } });
  await page.waitForTimeout(150);

  const setSeqRead = (seq) => page.evaluate((sq) => {
    const s = [...document.querySelectorAll('#wiz_user_form select')].find((x) => [...x.options].some((o) => o.value === 'YX'));
    s.value = sq; s.dispatchEvent(new Event('change', { bubbles: true }));
    const box = document.getElementById('userViz3dContainer_tree');
    const host = box && box.parentElement && box.parentElement.querySelector('.wiz-viz3d');
    const g = (host && host.__gcode) || '';
    const m = (v) => ((g.match(new RegExp('#' + v + '\\s*=\\s*([^\\n(]+)')) || [])[1] || '').trim();
    return { g21: m(21), g22: m(22), g23: m(23), g24: m(24) };
  }, seq);

  // FL/YX: wall1=Y → #21=0 (perp X), #22=#16 (Y-travel); #23=#16, #24=#15.
  const yx = await setSeqRead('YX');
  expect([yx.g21, yx.g22, yx.g23, yx.g24], 'FL/YX Z→wall1 #21/#22 = 0/#16 (wall-1 is Y)').toEqual(['0', '#16', '#16', '#15']);
  // FL/XY: wall1=X → #21=#16 (X-travel), #22=0 (perp Y) — the SWAP; #23=#15, #24=#16. Was #21=0 before the socket-held fix.
  const xy = await setSeqRead('XY');
  expect([xy.g21, xy.g22, xy.g23, xy.g24], 'FL/XY Z→wall1 #21/#22 = #16/0 (wall-1 is X — the fix; not the stale 0)').toEqual(['#16', '0', '#15', '#16']);
  // and it TRACKS back to YX (not stuck)
  const yx2 = await setSeqRead('YX');
  expect([yx2.g21, yx2.g22], 'flips back to YX (#21/#22 = 0/#16)').toEqual(['0', '#16']);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
