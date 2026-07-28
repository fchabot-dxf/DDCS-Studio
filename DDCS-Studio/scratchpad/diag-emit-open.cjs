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
    const c = emitMapped(builderOf(CONTOUR_DATA_OPTYPE)({ shape:'rect', w:80, h:60, originX:0, originY:0, toolDia:6 })).text;
    const d = emitMapped(builderOf(DRILL_DATA_OPTYPE)({ pattern:'grid', cols:2, rows:1, dx:20 })).text;
    return { c: c.split('\n').slice(0,10).join('\n'), d: d.split('\n').slice(0,10).join('\n') };
  });
  console.log('=== CONTOUR opening ==='); console.log(out.c);
  console.log('=== DRILL opening ==='); console.log(out.d);
  await b.close();
})();
