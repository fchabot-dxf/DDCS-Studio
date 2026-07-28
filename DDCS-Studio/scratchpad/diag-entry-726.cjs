const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await b.newPage();
  await page.goto('http://localhost:3211'); await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
  const out = await page.evaluate(async () => {
    const { contourStack } = await import('/wizards/contourWizard.js');
    const { contourDataDef, CONTOUR_DATA_OPTYPE } = await import('/blocks/dataOps/contourData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    registerUserOp(contourDataDef());
    const twin = builderOf(CONTOUR_DATA_OPTYPE);
    const P = { shape:'rect', w:80, h:60, originX:0, originY:0, toolDia:6 };
    const builtin = emitMapped(contourStack(P)).text;
    const twinUnset = emitMapped(twin(P)).text;
    const twinMoved = emitMapped(twin({ ...P, entryX:50, entryY:30 })).text;
    const twinSame = emitMapped(twin({ ...P, entryX:0, entryY:0 })).text;   // == cut entry → within ε → no waypoint
    return {
      byteIdentical: twinUnset === builtin,
      movedHasWaypoint: /G0 X50 Y30\s+\( entry \)/.test(twinMoved),
      movedOpen: twinMoved.split('\n').slice(0,7).join(' | '),
      sameByteIdentical: twinSame === builtin,
    };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
