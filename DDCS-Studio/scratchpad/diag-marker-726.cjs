const { chromium } = require('playwright');
const openW = async (page, op) => { await page.evaluate((o)=>window.openWiz(o), op); await page.waitForSelector('#wiz_user_form',{state:'visible',timeout:8000}); await page.waitForTimeout(700); };
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport:{width:1300,height:980} });
  await page.goto('http://localhost:3211'); await page.waitForFunction(()=>window.ddcsGetSettings&&window.openWiz,null,{timeout:15000});
  await page.evaluate(()=>{const s=window.ddcsGetSettings(); s.stock={show:true,x:200,y:150,z:25,datum:'nnp'}; s.preview=s.preview||{}; s.preview.autoLoop=false;});
  const count = (page, sel) => page.evaluate((s)=>document.querySelectorAll(s).length, sel);
  await openW(page, 'user_contour_data');
  const millSim = await count(page, '#wiz_user .fc-handle-sim');
  const millMove = await count(page, '#wiz_user .fc-handle-move');
  // drag the entry marker (a move handle) and read entryX/entryY + the gcode
  const bb = await page.locator('#wiz_user [data-hid="__simstart0"]').first().boundingBox().catch(()=>null);
  let dragged = null;
  if (bb) {
    await page.mouse.move(bb.x+bb.width/2, bb.y+bb.height/2); await page.mouse.down();
    await page.mouse.move(bb.x+bb.width/2-50, bb.y+bb.height/2-30, {steps:6}); await page.mouse.up(); await page.waitForTimeout(400);
    dragged = await page.evaluate(()=>{ const x=document.querySelector('#wiz_user_form [data-param="entryX"]'); const y=document.querySelector('#wiz_user_form [data-param="entryY"]'); const code=(document.querySelector('#wiz_user_code')||{}).textContent||''; return { entryX:x&&x.value, entryY:y&&y.value, hasWaypoint:/\( entry \)/.test(code) }; });
  }
  await openW(page, 'user_corner_data');
  const cornerSim = await count(page, '#wiz_user .fc-handle-sim');
  console.log('CONTOUR (mill): fc-handle-sim =', millSim, '(want 0) | fc-handle-move =', millMove);
  console.log('DRAG entry:', JSON.stringify(dragged));
  console.log('CORNER (probe): fc-handle-sim =', cornerSim, '(want >=1, the ○ kept)');
  await b.close();
})();
