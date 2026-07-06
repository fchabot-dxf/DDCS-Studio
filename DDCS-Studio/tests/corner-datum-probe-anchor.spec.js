import { test, expect } from '@playwright/test';

/**
 * t363 FACE 1 — the 3D probe geometry (path + tool + markers) lands on the PHYSICAL stock corner at ANY datum. Model
 * (human-confirmed): ONE physical stock; the datum/part-zero and the probed corner are TWO independent physical points;
 * the offset is derived. The stock is datum-placed (its datum corner at part-zero); the probe geometry — authored in the
 * stock min-XY frame — is mapped by `− datumXY` onto that datum-placed stock. ASSERT-THE-VALUE: the probe marker sits at
 * the SAME spot relative to the stock's FL corner regardless of the datum (before the fix a non-FL datum offset it one
 * stock width); EMIT byte-identical (the datum is preview-only for a probe).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('the 3D probe lands on the physical corner at any datum (path/tool/markers map onto the datum-placed stock); emit byte-identical', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram && window.ddcsGetSettings);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js'); localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef()); });

  const measure = async (datum) => {
    await page.evaluate(async (d) => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 100, y: 80, z: 20, shape: 'boss', show: true, datum: d, pin: 'origin' } }); }, datum);
    await page.evaluate(() => window.openWiz('user_corner_data'));
    await page.waitForSelector('#userVizContainer .fc-handle-sim', { timeout: 8000 });
    await page.evaluate(() => { const s = document.querySelector('#wiz_user_form [data-param="corner"]'); if (s) { s.value = 'FL'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
    await page.waitForTimeout(400);
    return page.evaluate(() => {
      const viz = window.ddcsStudio.wizardManager._activePanel.viz;
      const pg = viz._partGroup, sk = window.ddcsGetSettings().stock;
      const stockFL = { x: pg.position.x - sk.x / 2, y: pg.position.y - sk.y / 2 };   // the datum-placed stock's FL corner (part frame)
      const m = viz.spindleMarkers[0].position;                                       // the first probe marker (part frame)
      // the marker RELATIVE to the stock's FL corner — datum-INVARIANT once the probe maps onto the datum-placed stock
      return { relX: +(m.x - stockFL.x).toFixed(2), relY: +(m.y - stockFL.y).toFixed(2), stockFL: { x: +stockFL.x.toFixed(1), y: +stockFL.y.toFixed(1) } };
    });
  };

  const fl = await measure('nnp');   // front-left datum (part-zero AT the probed corner)
  const tr = await measure('ppp');   // TOP-RIGHT (back-right) datum — the human's case (part-zero one stock-width away)
  // sanity: the datum actually MOVED the stock (part-zero at the datum) — front-left → FL at origin; back-right → FL at −(x,y)
  expect(fl.stockFL, 'front-left datum: the stock FL corner is at part-zero').toEqual({ x: 0, y: 0 });
  expect(tr.stockFL, 'back-right datum: part-zero moved → the stock FL corner is one stock-width away').toEqual({ x: -100, y: -80 });
  // THE FIX: the probe marker sits at the SAME spot relative to the stock's FL corner at BOTH datums — on the physical corner
  expect(Math.hypot(tr.relX - fl.relX, tr.relY - fl.relY), 'the 3D probe lands on the physical corner at any datum (no one-stock-width phantom offset)').toBeLessThan(1);

  await page.screenshot({ path: 'scratchpad/corner_datum_probe_tr.png' });   // full wizard — the 3D preview (top) + 2D layout (bottom), both on the real corners

  // EMIT byte-identical across datums — the datum is a preview/display concept for a probe (never changes the G-code)
  const emitAt = (datum) => page.evaluate(async (d) => {
    const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 100, y: 80, z: 20, shape: 'boss', show: true, datum: d, pin: 'origin' } });
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { CORNER_DEFAULTS } = await import('/blocks/dataOps/cornerData.js');
    return emitMapped(builderOf('user_corner_data')({ ...CORNER_DEFAULTS, corner: 'FL' })).text;
  }, datum);
  expect(await emitAt('ppp'), 'emit byte-identical: back-right datum == front-left datum (datum is preview-only)').toBe(await emitAt('nnp'));
});
