const { chromium } = require('@playwright/test');
const path = require('path'); const OUT = path.join(__dirname,'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const nB = (p)=>p.evaluate(()=>document.querySelectorAll('.blocklyWorkspace .blocklyDraggable, .blk-ws .blocklyDraggable').length);
const status = (p)=>p.evaluate(()=>{const e=[...document.querySelectorAll('*')].find(x=>/cuts?\b|rapids?|no drawable/i.test(x.textContent||'') && x.childElementCount<3 && x.getBoundingClientRect().x>1500); return e?(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,26):'?';});
(async () => {
  const b = await chromium.launch({ headless: true }); const c = await b.newContext({ viewport:{width:1920,height:1080} }); const p = await c.newPage();
  p.on('dialog', d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(2500);
  await p.locator('button.tab').filter({hasText:'BLOCKS'}).filter({visible:true}).first().click(); await p.waitForTimeout(2500);
  for(let i=0;i<3;i++){ await p.locator('.blk-sug-opt').filter({visible:true}).first().click().catch(()=>{}); await p.waitForTimeout(600); }
  console.log('setup blocks:', await nB(p), '| status:', await status(p));
  // open Toolpaths category flyout
  await p.locator('.blocklyToolboxCategory, .blocklyTreeRow').filter({hasText:'Toolpaths'}).first().click().catch(e=>console.log('cat err',e.message.split('\n')[0]));
  await p.waitForTimeout(900);
  const fly = await p.evaluate(()=>[...document.querySelectorAll('.blocklyFlyout .blocklyDraggable')].map(e=>{const t=e.querySelector('.blocklyText'); const r=e.getBoundingClientRect(); return {t:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,20), x:Math.round(r.x+30), y:Math.round(r.y+12)};}).slice(0,10));
  console.log('flyout blocks:', JSON.stringify(fly));
  await p.screenshot({path:path.join(OUT,'tp2-flyout.png')});
  if (fly.length){
    // try click-to-add first
    const before = await nB(p);
    await p.mouse.click(fly[0].x, fly[0].y); await p.waitForTimeout(1000);
    let after = await nB(p);
    console.log('after click flyout[0]:', after, '(before', before+')');
    if (after<=before){ // drag it to canvas
      await p.mouse.move(fly[0].x, fly[0].y); await p.mouse.down(); await p.mouse.move(900,400,{steps:12}); await p.mouse.move(900,400); await p.mouse.up(); await p.waitForTimeout(1200);
      after = await nB(p); console.log('after drag:', after);
    }
    console.log('status now:', await status(p));
    await p.screenshot({path:path.join(OUT,'tp2-added.png')});
  }
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
