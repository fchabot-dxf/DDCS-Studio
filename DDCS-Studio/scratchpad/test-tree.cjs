const { chromium } = require('@playwright/test');
const path = require('path'); const OUT = path.join(__dirname,'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const opts = (p)=>p.evaluate(()=>[...document.querySelectorAll('.blk-sug-opt')].filter(e=>e.getBoundingClientRect().width>0).map(e=>(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,14)));
const status = (p)=>p.evaluate(()=>{const e=[...document.querySelectorAll('*')].find(x=>/cuts?\b|rapids?|no drawable/i.test(x.textContent||'') && x.childElementCount<3 && x.getBoundingClientRect().x>1500); return e?(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,20):'?';});
const nblocks = (p)=>p.evaluate(()=>document.querySelectorAll('.blockly-block, .blk-node, g.blocklyDraggable').length);
async function clickOpt(p,label){ const l=label?p.locator('.blk-sug-opt').filter({hasText:label}).filter({visible:true}).first():p.locator('.blk-sug-opt').filter({visible:true}).first(); if(await l.count()){ const t=(await l.textContent()||'').replace(/\s+/g,' ').trim().slice(0,14); await l.click().catch(()=>{}); await p.waitForTimeout(650); return t;} return null; }
(async () => {
  const b = await chromium.launch({ headless: true }); const c = await b.newContext({ viewport:{width:1920,height:1080} }); const p = await c.newPage();
  p.on('dialog', d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(2500);
  await p.locator('button.tab').filter({hasText:'BLOCKS'}).filter({visible:true}).first().click(); await p.waitForTimeout(2500);
  // Walk the first-opt chain, dumping opts+status at each step
  for(let i=0;i<12;i++){
    const before = await opts(p);
    const picked = await clickOpt(p);
    if(!picked){ console.log(`step ${i}: (no opt) STOP. opts were`, JSON.stringify(before)); break; }
    console.log(`step ${i}: +${picked.padEnd(14)} | now-opts ${JSON.stringify(await opts(p))} | ${await status(p)}`);
  }
  await p.screenshot({path:path.join(OUT,'tree-final.png')});
  await b.close(); console.log('DONE');
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
