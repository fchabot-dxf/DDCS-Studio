const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await b.newPage();
  await page.goto('http://localhost:3211'); await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
  const out = await page.evaluate(async () => {
    const { contourDataDef, CONTOUR_DATA_OPTYPE } = await import('/blocks/dataOps/contourData.js');
    const { drillDataDef, DRILL_DATA_OPTYPE } = await import('/blocks/dataOps/drillData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    registerUserOp(contourDataDef()); registerUserOp(drillDataDef());
    const ct = builderOf(CONTOUR_DATA_OPTYPE), dr = builderOf(DRILL_DATA_OPTYPE);
    const P = { shape:'rect', w:80, h:60, originX:0, originY:0, toolDia:6 };
    const ctMoved = emitMapped(ct({ ...P, entryX:50, entryY:30 })).text.split('\n').slice(0,7);
    const drMoved = emitMapped(dr({ pattern:'grid', cols:2, rows:1, dx:20, entryX:-10, entryY:5 })).text.split('\n').slice(0,6);
    // the entryX/entryY bindings exist in the def (round-trip)
    const def = contourDataDef();
    const hasEntryBind = (def.bindings||[]).filter(b => b.param==='entryX'||b.param==='entryY').length;
    return { ctMoved, drMoved, hasEntryBind };
  });
  console.log('CONTOUR moved:', JSON.stringify(out.ctMoved));
  console.log('DRILL moved  :', JSON.stringify(out.drMoved));
  console.log('contour def entryX/Y bindings:', out.hasEntryBind);
  await b.close();
})();
