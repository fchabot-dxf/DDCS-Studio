const { chromium } = require('@playwright/test');
const path = require('path'); const OUT = path.join(__dirname,'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const opts = (p)=>p.evaluate(()=>[...document.querySelectorAll('.blk-sug-opt')].filter(e=>e.getBoundingClientRect().width>0).map(e=>(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,12)));
const status = (p)=>p.evaluate(()=>{const e=[...document.querySelectorAll('*')].find(x=>/cuts?\b|rapids?|no drawable/i.test(x.textContent||'') && x.childElementCount<3 && x.getBoundingClientRect().x>1500); return e?(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,24):'?';});
async function clickOpt(p,label){ const l=label?p.locator('.blk-sug-opt').filter({hasText:label}).filter({visible:true}).first():p.locator('.blk-sug-opt').filter({visible:true}).first(); if(await l.count()){ await l.click().catch(()=>{}); await p.waitForTimeout(650); return true;} return false; }
(async () => {
  const b = await chromium.launch({ headless: true }); const c = await b.newContext({ viewport:{width:1920,height:1080} }); const p = await c.newPage();
  p.on('dialog', d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(2500);
  await p.locator('button.tab').filter({hasText:'BLOCKS'}).filter({visible:true}).first().click(); await p.waitForTimeout(2500);
  for(let i=0;i<5;i++) await clickOpt(p);
  console.log('setup opts:', JSON.stringify(await opts(p)), '| st:', await status(p));
  console.log('Line1?', await clickOpt(p,'Line'), '->', await status(p), JSON.stringify(await opts(p)));
  console.log('Drill?', await clickOpt(p,'Drill'), '->', await status(p), JSON.stringify(await opts(p)));
  console.log('Line2?', await clickOpt(p,'Line'), '->', await status(p), JSON.stringify(await opts(p)));
  await p.waitForTimeout(1000);
  console.log('final:', await status(p));
  await p.screenshot({path:path.join(OUT,'bigbuild.png')});
  await b.close(); console.log('DONE');
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
