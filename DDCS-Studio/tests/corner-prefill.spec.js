import { test, expect } from '@playwright/test';

/**
 * PREFILL FIX (t109) — the per-corner SIM-START markers must FLIP per corner. The offsets (cornerReposOffsets/axesOf)
 * already flipped, but the frac BASE (zsurf) was CANONICAL-FL → the whole non-FL chain sat at the FL corner and the sim
 * probe fired into EMPTY SPACE (e.g. BR wall-2 X-probe at x=-947). Fix: cornerSimStartsProvider mirrors the base per
 * corner via dirsOf (the SAME sign source the emit uses). PLUS the LIVE-FORM dog-leg fix: an untouched expression-holding
 * reposition socket (cross1_x/cross1_y default to a PER-CORNER #var expression) no longer injects its FL-canonical default
 * over the pruned per-corner socket (formWidgets omits a non-numeric-default field when empty) → the emitted dog-leg flips
 * per corner INSTANTLY in the form, not just when a marker is nudged. SIM/PREVIEW + form-emit correctness; build() byte-identical.
 *
 * Independent geometry (probeZ-off, YX, stock 100×80, tipR 2, retract 5, td 50): base = (xd='−'? 100−7:7, yd='−'? 80−7:7);
 * off.wall1 = (0, oppN(yd)); off.wall2 = (oppN(xd), ownN(yd)). ownN('+')=+50/'−'=−50; oppN('+')=−50/'−'=+50.
 */

const stock = { x: 100, y: 80, z: 20, shape: 'box', show: true };
const R = (n) => Math.round(n * 10) / 10;

// hand-derived per-corner declared markers (probeZ-off, YX) + the wall-2 X-probe contact wall
const EXPECT = {
  FL: { markers: [[7, -43], [-43, 7]], xWall: 0, contact: -2 },     // FL X-wall x=0 → contact 0−tipR
  FR: { markers: [[93, -43], [143, 7]], xWall: 100, contact: 102 }, // FR X-wall x=100 → contact 100+tipR
  BL: { markers: [[7, 123], [-43, 73]], xWall: 0, contact: -2 },
  BR: { markers: [[93, 123], [143, 73]], xWall: 100, contact: 102 },
};

test('(1) per-corner sim-start markers land at the correct corner (independent geometry, NOT canonical-FL) — all 4', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async ({ stock }) => {
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    registerUserOp(CD.cornerDataDef());
    const def = CD.cornerDataDef();
    const out = {};
    for (const c of ['FL', 'FR', 'BL', 'BR']) {
      const p = { ...CD.CORNER_DEFAULTS, corner: c };   // probeZ-off, YX
      out[c] = def.simStartsProvider(p, stock).map((m) => [Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10]);
    }
    return out;
  }, { stock });
  for (const c of ['FL', 'FR', 'BL', 'BR']) {
    expect(r[c], `${c} markers at the correct per-corner positions`).toEqual(EXPECT[c].markers);
  }
  // non-FL must be DISTINCT from the FL canonical chain (the bug was: all corners = FL)
  for (const c of ['FR', 'BL', 'BR']) {
    expect(r[c], `${c} is NOT canonical-FL (the prefill bug)`).not.toEqual(EXPECT.FL.markers);
  }
});

test('(2) the sim probe fires ON the corner wall (not empty space) — all 4 corners', async ({ page }) => {
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
    for (const c of ['FL', 'FR', 'BL', 'BR']) {
      const p = { ...CD.CORNER_DEFAULTS, corner: c };
      const declared = def.simStartsProvider(p, stock).map((m) => ({ x: m.x, y: m.y, z: m.z || 0, anchorsAtPrev: !!m.anchorsAtPrev }));
      const eng = new GcodeExecutionEngine({ autoAnswer: true, stock, stockOffset: declared[0] });
      eng._passStarts = declared;
      eng.trace(emitMapped(build(p)).text);
      out[c] = Math.round(eng.vars.get(1925) * 10) / 10;   // wall-2 X-probe contact
    }
    return out;
  }, { stock });
  for (const c of ['FL', 'FR', 'BL', 'BR']) {
    // the X-probe contact is ON the corner's X-wall (±tipR), NOT a full-travel miss into empty space (|x| would be ~900+)
    expect(Math.abs(r[c] - EXPECT[c].contact), `${c} wall-2 probe contacts x≈${EXPECT[c].contact} (on the x=${EXPECT[c].xWall} wall), got ${r[c]}`).toBeLessThan(1.5);
  }
});

test('(3) LIVE form — the emitted dog-leg #23/#24 flips per corner INSTANTLY (no marker nudge needed)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form [data-param="cross1_x"]', { state: 'visible' });

  const setCornerRead = (c) => page.evaluate((cc) => {
    const f = [...document.querySelectorAll('#wiz_user_form select')].find((s) => [...s.options].some((o) => o.value === cc));
    f.value = cc; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
    const box = document.getElementById('userViz3dContainer');
    const host = box && box.parentElement && box.parentElement.querySelector('.wiz-viz3d');
    const g = (host && host.__gcode) || '';
    const m = (v) => (g.match(new RegExp('#' + v + '\\s*=\\s*([^\\n(]+)')) || [])[1];
    return { g23: (m(23) || '').trim(), g24: (m(24) || '').trim() };
  }, c);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops')).catch(() => {});

  // #15 = +td, #16 = −td. Per corner (YX): #23 = opp(xd), #24 = own(yd). opp('+')=#16/opp('−')=#15; own('+')=#15/own('−')=#16.
  const EMIT = { FL: ['#16', '#15'], FR: ['#15', '#15'], BL: ['#16', '#16'], BR: ['#15', '#16'] };
  for (const c of ['FL', 'BR', 'FR', 'BL', 'BR', 'FL']) {   // switch AROUND (incl. back to FL) to prove it TRACKS, not sticks
    const r = await setCornerRead(c);
    expect([r.g23, r.g24], `LIVE form dog-leg for ${c} = ${JSON.stringify(EMIT[c])} (flips instantly, not stuck on FL)`).toEqual(EMIT[c]);
  }
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
