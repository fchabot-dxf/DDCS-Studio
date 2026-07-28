const { chromium } = require('@playwright/test');
const path = require('path'); const OUT = path.join(__dirname,'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const nBlocks = (p) => p.evaluate(()=>document.querySelectorAll('.blocklyDraggable').length);
const opts = (p) => p.evaluate(()=>[...document.querySelectorAll('.blk-sug-opt')].filter(e=>e.getBoundingClientRect().width>0).map(e=>(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,16)));
(async () => {
  const b = await chromium.launch({ headless: true }); const c = await b.newContext({ viewport:{width:1920,height:1080} }); const p = await c.newPage();
  p.on('dialog', d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(2500);
  await p.locator('button.tab').filter({hasText:'BLOCKS'}).filter({visible:true}).first().click();
  await p.waitForTimeout(2500);
  console.log('start:', await nBlocks(p), 'opts:', JSON.stringify(await opts(p)));
  for (let i=1;i<=6;i++){
    const loc = p.locator('.blk-sug-opt').filter({visible:true}).first();
    if (!await loc.count()) { console.log('no opts left'); break; }
    const t = (await loc.textContent()||'').trim().slice(0,14);
    await loc.click().catch(e=>console.log('  err',e.message.split('\n')[0]));
    await p.waitForTimeout(700);
    console.log(`click#${i} "${t}" -> blocks=${await nBlocks(p)} | next opts=${JSON.stringify(await opts(p))}`);
    if (i===2) await p.screenshot({path:path.join(OUT,'bb-step2.png')});
    if (i===5) await p.screenshot({path:path.join(OUT,'bb-step5.png')});
  }
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
