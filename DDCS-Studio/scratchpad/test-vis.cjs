const { chromium } = require('@playwright/test');
const URL = 'https://ddcs-studio.pages.dev/';
const vis = (p) => p.evaluate(() => { const s=[...document.querySelectorAll('#wizard select')].find(x=>x.getBoundingClientRect().width>0 && [...x.options].map(o=>o.value).join()==='pocket,boss'); return s?s.value:'?'; });
(async () => {
  const b = await chromium.launch({ headless: true }); const c = await b.newContext({ viewport:{width:1920,height:1080} }); const p = await c.newPage();
  p.on('dialog', d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(2500);
  await p.locator('button.wizard-btn').filter({hasText:'Probe'}).first().click(); await p.waitForTimeout(400);
  await p.locator('.toolbar-dropdown-content button').filter({hasText:'Middle'}).first().click(); await p.waitForTimeout(1500);
  console.log('default visible Feature:', await vis(p));
  await p.locator('#wizard select').filter({hasText:'Boss'}).filter({visible:true}).first().selectOption({label:'Boss'});
  await p.waitForTimeout(500); console.log('after set Boss:', await vis(p));
  await p.waitForTimeout(2500); console.log('+2.5s:', await vis(p));
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
