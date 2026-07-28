const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await b.newPage();
  await page.goto('http://localhost:3211'); await page.waitForFunction(()=>window.ddcsStudio,null,{timeout:15000});
  const r = await page.evaluate(async () => {
    const { pocketDataDef, POCKET_DATA_OPTYPE } = await import('/blocks/dataOps/pocketData.js');
    const { registerUserOp, flattenBlocks } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { entryBindingsFor } = await import('/blocks/dataOps/deriveBindings.js');
    const def = pocketDataDef(); registerUserOp(def);
    const built = builderOf(POCKET_DATA_OPTYPE)({ entryX:77, entryY:-33 });
    const flat = flattenBlocks(built);
    const entryBlk = flat.find(x => x && x.type === 'entry');
    const entryBinds = (def.bindings||[]).filter(x => x.param==='entryX'||x.param==='entryY');
    // what does entryBindingsFor find on the template?
    const { pocketDataDef: _ } = {};
    return {
      entryInStack: !!entryBlk,
      entryParams: entryBlk ? entryBlk.params : null,
      entryBindsInDef: entryBinds.map(x=>({param:x.param,blockIndex:x.blockIndex,key:x.key})),
      flatTypes: flat.map(x=>x&&x.type).filter(Boolean),
    };
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
