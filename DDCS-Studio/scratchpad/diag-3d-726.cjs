const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({viewport:{width:1300,height:980}});
  await page.goto('http://localhost:3211'); await page.waitForFunction(()=>window.ddcsGetSettings&&window.openWiz,null,{timeout:15000});
  await page.evaluate(()=>{const s=window.ddcsGetSettings(); s.stock={show:true,x:200,y:150,z:25,datum:'nnp'}; s.preview=s.preview||{}; s.preview.autoLoop=false;});
  await page.evaluate(()=>window.openWiz('user_contour_data')); await page.waitForSelector('#wiz_user_form',{state:'visible',timeout:8000}); await page.waitForTimeout(800);
  // move the entry so the 3D shows the marker + the waypoint
  for (const [k,v] of [['entryX',60],['entryY',-40]]) await page.evaluate(([k2,v2])=>{const f=document.querySelector(`#wiz_user_form [data-param="${k2}"]`); if(f){f.value=v2; f.dispatchEvent(new Event('input',{bubbles:true})); f.dispatchEvent(new Event('change',{bubbles:true}));}},[k,v]);
  await page.waitForTimeout(900);
  const bb = await page.locator('#wiz_user').boundingBox(); if (bb) await page.screenshot({path:'scratchpad/p2b-entry-3d.png', clip:bb});
  console.log('screenshot saved');
  await b.close();
})();
