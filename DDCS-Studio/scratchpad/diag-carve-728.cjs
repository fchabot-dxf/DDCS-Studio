const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({viewport:{width:1300,height:980}});
  await page.goto('http://localhost:3211'); await page.waitForFunction(()=>window.ddcsGetSettings&&window.openWiz,null,{timeout:15000});
  await page.evaluate(()=>{const s=window.ddcsGetSettings(); s.stock={show:true,x:120,y:120,z:12,datum:'nnp'}; s.preview=s.preview||{}; s.preview.autoLoop=false; s.preview.carve=true;});
  const shot = async (op, cfg, name) => {
    await page.evaluate((o)=>window.openWiz(o), op); await page.waitForSelector('#wiz_user_form',{state:'visible',timeout:8000}); await page.waitForTimeout(700);
    for (const [k,v] of Object.entries(cfg)) await page.evaluate(([k2,v2])=>{const f=document.querySelector(`#wiz_user_form [data-param="${k2}"]`); if(f){f.value=v2; f.dispatchEvent(new Event('input',{bubbles:true})); f.dispatchEvent(new Event('change',{bubbles:true}));}},[k,v]);
    await page.waitForTimeout(1500);   // let the end-state carve build
    const box = await page.locator('#wiz_user [id*="Viz3d"], #wiz_user canvas').first().boundingBox().catch(()=>null);
    const bb = await page.locator('#wiz_user').boundingBox();
    if (bb) await page.screenshot({path:`scratchpad/${name}.png`, clip:{x:bb.x+400, y:bb.y, width:Math.min(830,bb.width-400), height:440}});
    console.log(name, 'saved');
  };
  await shot('user_pocket_data', { shape:'rect', w:80, h:60, depth:9, toolDia:10 }, 'carve-rect-corner');
  await shot('user_pocket_data', { shape:'circle', dia:80, depth:9, toolDia:10 }, 'carve-circle-diag');
  await b.close();
})();
