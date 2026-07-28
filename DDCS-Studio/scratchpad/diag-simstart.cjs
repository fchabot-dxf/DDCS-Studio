const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await b.newPage();
  await page.goto('http://localhost:3211'); await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
  const out = await page.evaluate(async () => {
    const { contourDataDef, CONTOUR_DATA_OPTYPE } = await import('/blocks/dataOps/contourData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    registerUserOp(contourDataDef());
    const p = { shape:'rect', w:80, h:60, originX:0, originY:0, toolDia:6 };
    let s = null; try { s = opSimStarts(CONTOUR_DATA_OPTYPE, p, { x:200, y:150, z:25 }); } catch(e){ s = 'ERR '+e.message; }
    return { starts: s };
  });
  console.log('opSimStarts:', JSON.stringify(out.starts));
  await b.close();
})();
