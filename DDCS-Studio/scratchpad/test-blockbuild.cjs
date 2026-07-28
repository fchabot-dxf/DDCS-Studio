const { chromium } = require('@playwright/test');
const path = require('path'); const OUT = path.join(__dirname,'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const nBlocks = (p) => p.evaluate(()=>document.querySelectorAll('.blocklyDraggable').length);
(async () => {
  const b = await chromium.launch({ headless: true }); const c = await b.newContext({ viewport:{width:1920,height:1080} }); const p = await c.newPage();
  p.on('dialog', d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(2500);
  await p.locator('button.tab').filter({hasText:'BLOCKS'}).filter({visible:true}).first().click();
  await p.locator('.blocklyDraggable').first().waitFor({state:'visible',timeout:12000}).catch(()=>{});
  await p.waitForTimeout(1500);
  console.log('fresh block count:', await nBlocks(p));
  const chips = await p.evaluate(()=>[...document.querySelectorAll('.blk-sug-chip,.blk-sug-opt')].filter(e=>e.getBoundingClientRect().width>0).map(e=>({t:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,20), c:(typeof e.className==='string'?e.className:'').slice(0,26), x:Math.round(e.getBoundingClientRect().x), y:Math.round(e.getBoundingClientRect().y)})));
  console.log('suggestion chips:', JSON.stringify(chips,null,1));
  await p.screenshot({path:path.join(OUT,'bb-0.png')});
  // click a few sug-opt chips, count after each
  for (const label of ['Move','Spindle','Tool','WCS']) {
    const loc = p.locator('.blk-sug-opt,.blk-sug-chip').filter({hasText:label}).filter({visible:true}).first();
    if (await loc.count()) { await loc.click().catch(e=>console.log('  click err',label,e.message.split('\n')[0])); await p.waitForTimeout(900); console.log('after click '+label+':', await nBlocks(p)); }
    else console.log('no chip for', label);
  }
  await p.screenshot({path:path.join(OUT,'bb-1.png')});
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
