const { chromium } = require('@playwright/test');
const path = require('path'); const OUT = path.join(__dirname,'explore');
const URL = 'https://ddcs-studio.pages.dev/';
async function openATC(p, name){
  await p.mouse.click(960,600); await p.waitForTimeout(200);
  await p.locator('button.wizard-btn').filter({hasText:'ATC'}).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({hasText:name}).first().click(); await p.waitForTimeout(2000);
  const data = await p.evaluate(()=>{ const e=[...document.querySelectorAll('#wizard *')].find(x=>/\(data\)|lines|no drawable|needs/i.test(x.textContent||'') && x.childElementCount<4); return e?(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,50):'?'; });
  console.log(name+':', 'canvas='+await p.locator('#wizard canvas').filter({visible:true}).count(), '|', data);
  await p.screenshot({ path: path.join(OUT,'atc-'+name.replace(/\W+/g,'')+'.png') });
  await p.locator('#wizard button').filter({hasText:'CANCEL'}).first().click().catch(()=>{}); await p.waitForTimeout(600);
}
(async () => {
  const b = await chromium.launch({ headless: true }); const c = await b.newContext({ viewport:{width:1920,height:1080} }); const p = await c.newPage();
  p.on('dialog', d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(2500);
  for(const n of ['Tool Change','Tool Table','ATC Test','Tool Check']) await openATC(p,n);
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
