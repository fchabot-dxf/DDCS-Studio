const { chromium } = require('@playwright/test');
const path = require('path'); const OUT = path.join(__dirname,'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const opts = (p)=>p.evaluate(()=>[...document.querySelectorAll('.blk-sug-opt')].filter(e=>e.getBoundingClientRect().width>0).map(e=>(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,14)));
const status = (p)=>p.evaluate(()=>{const e=[...document.querySelectorAll('*')].find(x=>/cuts?\b|rapids?|no drawable/i.test(x.textContent||'') && x.childElementCount<3 && x.getBoundingClientRect().x>1500); return e?(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,26):'?';});
(async () => {
  const b = await chromium.launch({ headless: true }); const c = await b.newContext({ viewport:{width:1920,height:1080} }); const p = await c.newPage();
  p.on('dialog', d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(2500);
  await p.locator('button.tab').filter({hasText:'BLOCKS'}).filter({visible:true}).first().click(); await p.waitForTimeout(2500);
  for(let i=0;i<5;i++){ await p.locator('.blk-sug-opt').filter({visible:true}).first().click().catch(()=>{}); await p.waitForTimeout(650); }
  console.log('after 5 clicks, opts:', JSON.stringify(await opts(p)), '| status:', await status(p));
  const line = p.locator('.blk-sug-opt').filter({hasText:'Line'}).filter({visible:true}).first();
  if (await line.count()) { console.log('clicking Line suggestion'); await line.click().catch(e=>console.log('err',e.message.split('\n')[0])); await p.waitForTimeout(1500); }
  console.log('after Line, status:', await status(p));
  await p.screenshot({path:path.join(OUT,'suggtp2.png')});
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
