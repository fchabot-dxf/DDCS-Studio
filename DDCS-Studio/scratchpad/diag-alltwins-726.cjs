const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await b.newPage();
  await page.goto('http://localhost:3211'); await page.waitForFunction(()=>window.ddcsStudio,null,{timeout:15000});
  const r = await page.evaluate(async () => {
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const defs = {
      user_contour_data: (await import('/blocks/dataOps/contourData.js')).contourDataDef,
      user_drill_data: (await import('/blocks/dataOps/drillData.js')).drillDataDef,
      user_bore_data: (await import('/blocks/dataOps/boreData.js')).boreDataDef,
      user_slot_data: (await import('/blocks/dataOps/slotData.js')).slotDataDef,
      user_pocket_data: (await import('/blocks/dataOps/pocketData.js')).pocketDataDef,
      user_surfacing_data: (await import('/blocks/dataOps/surfacingData.js')).surfacingDataDef,
      user_text_data: (await import('/blocks/dataOps/textData.js')).textDataDef,
    };
    const out = {};
    for (const op in defs) {
      registerUserOp(defs[op]());
      const moved = emitMapped(builderOf(op)({ entryX:77, entryY:-33 })).text;
      const has = /\( entry \)/.test(moved);
      const wline = moved.split('\n').find(l => /\( entry \)/.test(l)) || '(none)';
      out[op] = { has, wline: wline.trim() };
    }
    return out;
  });
  for (const op in r) console.log(op.padEnd(22), r[op].has ? 'OK' : 'NO-WAYPOINT', '|', r[op].wline);
  await b.close();
})();
