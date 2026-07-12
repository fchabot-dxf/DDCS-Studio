import { test, expect } from '@playwright/test';

/**
 * t359 RELEASE-BLOCKER — the corner-pick and the stock DATUM are INDEPENDENT concerns (human t358: "select TOP-RIGHT
 * stock datum but still select BOTTOM-RIGHT corner"). The 4 corner-pick circles sit on the REAL physical stock corners
 * at ANY datum; the stock datum moves ONLY the origin crosshair (consistent with the stock modal + the 3D). The corner
 * EMIT never depends on the datum. ASSERT-THE-VALUE (circle pos == physical corner; crosshair == datum corner) + emit parity.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

const setDatum = (page, datum) => page.evaluate(async (d) => {
  const SP = await import('/ui/settingsPanel.js');
  SP.applySettings({ stock: { x: 100, y: 80, z: 20, shape: 'boss', show: true, datum: d, pin: 'origin' } });
}, datum);

test('corner-pick circles stay on the physical corners at any datum; the crosshair follows the datum; emit byte-identical', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram && window.ddcsGetSettings);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js'); localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef()); });

  // open the corner wizard fresh at `datum`, select probe `corner`, read the circle + crosshair + physical-corner geometry
  const inspect = async (datum, corner) => {
    await setDatum(page, datum);
    await page.evaluate(() => window.openWiz('user_corner_data'));
    await page.waitForSelector('#userVizContainer .fc-corner-pick', { timeout: 8000 });
    await page.evaluate((c) => { const s = document.querySelector('#wiz_user_form [data-param="corner"]'); if (s && s.value !== c) { s.value = c; s.dispatchEvent(new Event('change', { bubbles: true })); } }, corner);
    await page.waitForTimeout(300);
    return page.evaluate(() => {
      const svg = document.querySelector('#userVizContainer svg');
      const circles = {};
      svg.querySelectorAll('.fc-corner-pick').forEach((c) => { circles[c.getAttribute('data-corner')] = { x: Math.round(+c.getAttribute('cx')), y: Math.round(+c.getAttribute('cy')), cur: c.classList.contains('fc-corner-pick-cur') }; });
      const sr = svg.querySelector('.fc-stock');
      // Round each CORNER (the sum) once — matching how the circle centre is rounded (round(cx)). Rounding x and width
      // SEPARATELY then adding (round(a)+round(b)) split by 1px whenever the fit lands a corner on a .5 boundary — a
      // test-rounding artifact, not a real offset (featureCanvas emits circle.cx == rect.x+rect.width as equal floats).
      const rx = +sr.getAttribute('x'), ry = +sr.getAttribute('y'), rw = +sr.getAttribute('width'), rh = +sr.getAttribute('height');
      const phys = { FL: { x: Math.round(rx), y: Math.round(ry + rh) }, FR: { x: Math.round(rx + rw), y: Math.round(ry + rh) }, BL: { x: Math.round(rx), y: Math.round(ry) }, BR: { x: Math.round(rx + rw), y: Math.round(ry) } };   // screen: world min-XY = bottom-left
      const ax = svg.querySelector('.fc-axis-x');
      const cross = { x: Math.round((+ax.getAttribute('x1') + +ax.getAttribute('x2')) / 2), y: Math.round(+ax.getAttribute('y1')) };
      return { circles, phys, cross };
    });
  };

  // THE CONCRETE CASE — datum = back-right (the grid TOP-RIGHT) + probe corner = FR (the canvas BOTTOM-RIGHT)
  const br = await inspect('ppp', 'FR');
  for (const c of ['FL', 'FR', 'BL', 'BR']) expect({ x: br.circles[c].x, y: br.circles[c].y }, `circle ${c} sits on the physical corner (datum-independent)`).toEqual(br.phys[c]);
  expect(br.circles.FR.cur, 'FR (bottom-right) is the selected probe corner').toBe(true);
  expect(br.cross, 'the crosshair follows the datum → the BR corner (NOT FL)').toEqual(br.phys.BR);
  await page.locator('#userVizContainer').screenshot({ path: 'scratchpad/corner_datum_br.png' });

  // DEFAULT front-left datum — crosshair back at FL (unchanged); circles still physical
  const fl = await inspect('nnp', 'FR');
  for (const c of ['FL', 'FR', 'BL', 'BR']) expect({ x: fl.circles[c].x, y: fl.circles[c].y }).toEqual(fl.phys[c]);
  expect(fl.cross, 'front-left datum → crosshair at FL (the prior default, unshifted)').toEqual(fl.phys.FL);
  await page.locator('#userVizContainer').screenshot({ path: 'scratchpad/corner_datum_fl.png' });

  // CENTRE datum — crosshair at the block centre; circles still physical
  const cc = await inspect('ccp', 'FR');
  for (const c of ['FL', 'FR', 'BL', 'BR']) expect({ x: cc.circles[c].x, y: cc.circles[c].y }).toEqual(cc.phys[c]);
  expect(cc.cross.x, 'centre datum → crosshair x at mid-width').toBe(Math.round((cc.phys.FL.x + cc.phys.FR.x) / 2));
  expect(cc.cross.y, 'centre datum → crosshair y at mid-height').toBe(Math.round((cc.phys.BL.y + cc.phys.FL.y) / 2));

  // EMIT byte-identical across datums — the corner probe emit never reads the stock datum
  const emitAt = (datum) => page.evaluate(async (d) => {
    const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 100, y: 80, z: 20, shape: 'boss', show: true, datum: d, pin: 'origin' } });
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { CORNER_DEFAULTS } = await import('/blocks/dataOps/cornerData.js');
    return emitMapped(builderOf('user_corner_data')({ ...CORNER_DEFAULTS, corner: 'FR' })).text;
  }, datum);
  const eFL = await emitAt('nnp'), eBR = await emitAt('ppp'), eCC = await emitAt('ccp');
  expect(eBR, 'corner emit byte-identical: BR datum == FL datum (datum must not change the emit)').toBe(eFL);
  expect(eCC, 'corner emit byte-identical: centre datum == FL datum').toBe(eFL);
  expect(eFL.length, 'the corner emit is non-trivial').toBeGreaterThan(50);
});
