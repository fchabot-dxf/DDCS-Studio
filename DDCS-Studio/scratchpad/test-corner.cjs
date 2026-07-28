const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';
(async () => {
  const b = await chromium.launch({ headless: true }); const c = await b.newContext({ viewport:{width:1920,height:1080} }); const p = await c.newPage();
  p.on('dialog', d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(2500);
  await p.locator('button.wizard-btn').filter({hasText:'Probe'}).first().click(); await p.waitForTimeout(400);
  await p.locator('.toolbar-dropdown-content button').filter({hasText:'Corner'}).first().click(); await p.waitForTimeout(1600);
  const sels = await p.evaluate(() => [...document.querySelectorAll('#wizard select')].map(s=>({id:s.id, vis:s.getBoundingClientRect().width>0 && getComputedStyle(s).display!=='none', val:s.value, opts:[...s.options].map(o=>o.text)})).filter(s=>s.vis && s.opts.some(o=>/left|right|corner/i.test(o))));
  console.log('CORNER-ish visible selects:', JSON.stringify(sels,null,1));
  await p.screenshot({ path: path.join(OUT,'corner-before.png') });
  // try changing the corner select to a back/right corner
  const cs = p.locator('#wizard select').filter({ hasText: 'Front-Left' }).filter({ visible:true }).first();
  console.log('front-left select count:', await p.locator('#wizard select').filter({ hasText: 'Front-Left' }).filter({ visible:true }).count());
  await cs.selectOption({ index: 3 }).catch(e=>console.log('sel err', e.message.split('\n')[0]));
  await p.waitForTimeout(1200);
  const after = await p.evaluate(()=>{ const s=[...document.querySelectorAll('#wizard select')].find(x=>[...x.options].some(o=>/Front-Left/i.test(o.text))); return s?s.value+' / '+s.options[s.selectedIndex].text:'?'; });
  console.log('corner after change:', after);
  await p.screenshot({ path: path.join(OUT,'corner-after.png') });
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
