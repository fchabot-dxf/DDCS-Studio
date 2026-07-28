const { chromium } = require('@playwright/test');
const path = require('path'); const OUT = path.join(__dirname,'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const opts = (p)=>p.evaluate(()=>[...document.querySelectorAll('.blk-sug-opt')].filter(e=>e.getBoundingClientRect().width>0).map(e=>(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,14)));
const status = (p)=>p.evaluate(()=>{const e=[...document.querySelectorAll('*')].find(x=>/cuts?\b|rapids?|no drawable/i.test(x.textContent||'') && x.childElementCount<3 && x.getBoundingClientRect().x>1500); return e?(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,20):'?';});
async function clickOpt(p,label){ const l=label?p.locator('.blk-sug-opt').filter({hasText:label}).filter({visible:true}).first():p.locator('.blk-sug-opt').filter({visible:true}).first(); if(await l.count()){ const t=(await l.textContent()||'').replace(/\s+/g,' ').trim().slice(0,14); await l.click().catch(()=>{}); await p.waitForTimeout(650); return t;} return null; }
(async () => {
  const b = await chromium.launch({ headless: true }); const c = await b.newContext({ viewport:{width:1920,height:1080} }); const p = await c.newPage();
  p.on('dialog', d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(2500);
  await p.locator('button.tab').filter({hasText:'BLOCKS'}).filter({visible:true}).first().click(); await p.waitForTimeout(2500);
  for(let i=0;i<5;i++) await clickOpt(p);                       // WCS Tool Spindle Move Feed
  console.log('L1?', await clickOpt(p,'Line'), '->', await status(p), JSON.stringify(await opts(p)));
  console.log('MT?', await clickOpt(p,'MoveTab'), '->', await status(p), JSON.stringify(await opts(p)));
  console.log('L2?', await clickOpt(p,'Line'), '->', await status(p), JSON.stringify(await opts(p)));
  console.log('MT?', await clickOpt(p,'MoveTab'), '->', await status(p), JSON.stringify(await opts(p)));
  console.log('D?',  await clickOpt(p,'Drill'), '->', await status(p), JSON.stringify(await opts(p)));
  console.log('MT?', await clickOpt(p,'MoveTab'), '->', await status(p), JSON.stringify(await opts(p)));
  console.log('L3?', await clickOpt(p,'Line'), '->', await status(p), JSON.stringify(await opts(p)));
  await p.waitForTimeout(800);
  // zoom the preview to see the path
  const cc = await p.evaluate(()=>{let b=null;document.querySelectorAll('canvas').forEach(cv=>{const r=cv.getBoundingClientRect();if(r.width>60&&r.height>60&&(!b||r.width*r.height>b.a))b={x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),a:r.width*r.height};});return b;});
  if(cc){await p.mouse.move(cc.x,cc.y);for(let i=0;i<5;i++){await p.mouse.wheel(0,-200);await p.waitForTimeout(60);}}
  await p.waitForTimeout(1200);
  console.log('FINAL:', await status(p));
  await p.screenshot({path:path.join(OUT,'cont-final.png')});
  await b.close(); console.log('DONE');
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
