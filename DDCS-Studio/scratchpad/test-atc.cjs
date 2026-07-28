const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';
(async () => {
  const b = await chromium.launch({ headless: true }); const c = await b.newContext({ viewport:{width:1920,height:1080} }); const p = await c.newPage();
  p.on('dialog', d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(2500);
  await p.mouse.click(960,600); await p.waitForTimeout(200);
  await p.locator('button.wizard-btn').filter({hasText:'ATC'}).first().click(); await p.waitForTimeout(600);
  const items = await p.locator('.toolbar-dropdown-content button').filter({visible:true}).allInnerTexts().catch(()=>[]);
  console.log('ATC menu items:', JSON.stringify(items));
  await p.screenshot({ path: path.join(OUT,'atc-menu.png') });
  // open the first ATC wizard
  const first = items.find(t=>t.trim());
  await p.locator('.toolbar-dropdown-content button').filter({hasText: first.trim().replace(/^[^A-Za-z0-9]+/,'').slice(0,6)}).first().click().catch(e=>console.log('open err',e.message.split('\n')[0]));
  await p.waitForTimeout(2000);
  console.log('wizard active:', await p.locator('#wizard.active, #wizard.overlay.active').count(), 'canvas:', await p.locator('#wizard canvas').count());
  await p.screenshot({ path: path.join(OUT,'atc-wizard.png') });
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
