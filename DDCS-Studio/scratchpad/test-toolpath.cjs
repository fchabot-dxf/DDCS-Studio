const { chromium } = require('@playwright/test');
const path = require('path'); const OUT = path.join(__dirname,'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const nB = (p)=>p.evaluate(()=>document.querySelectorAll('.blocklyDraggable').length);
const gcode = (p)=>p.evaluate(()=>{const e=document.querySelector('.gcode'); return e?(e.textContent||'').replace(/\s+/g,' ').slice(0,160):'?';});
const cuts = (p)=>p.evaluate(()=>{const e=[...document.querySelectorAll('*')].find(x=>/drawable moves|\d+ cuts?|running line/i.test(x.textContent||'') && x.childElementCount<4); return e?(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,30):'?';});
(async () => {
  const b = await chromium.launch({ headless: true }); const c = await b.newContext({ viewport:{width:1920,height:1080} }); const p = await c.newPage();
  p.on('dialog', d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(2500);
  await p.locator('button.tab').filter({hasText:'BLOCKS'}).filter({visible:true}).first().click();
  await p.waitForTimeout(2500);
  // build a few setup blocks
  for(let i=0;i<3;i++){ await p.locator('.blk-sug-opt').filter({visible:true}).first().click().catch(()=>{}); await p.waitForTimeout(700); }
  console.log('after 3 sug:', await nB(p), '| cuts:', await cuts(p), '| gc:', await gcode(p));
  // try Complete Programs > Milling (palette)
  await p.locator('text=Complete Programs').first().click().catch(()=>{}); await p.waitForTimeout(500);
  console.log('--- clicking Milling (complete program) ---');
  await p.locator('text=Milling').first().click().catch(e=>console.log('milling err',e.message.split('\n')[0])); await p.waitForTimeout(1500);
  await p.screenshot({path:path.join(OUT,'tp-milling.png')});
  console.log('after Milling click:', await nB(p), '| cuts:', await cuts(p), '| gc:', await gcode(p));
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
