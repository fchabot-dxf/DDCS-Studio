const { chromium } = require('@playwright/test');
const path = require('path'); const OUT = path.join(__dirname,'explore');
const URL = 'https://ddcs-studio.pages.dev/';
(async () => {
  const b = await chromium.launch({ headless: true, args:['--disable-gpu'] }); const c = await b.newContext({ viewport:{width:1920,height:1080} }); const p = await c.newPage();
  p.on('dialog', d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(2500);
  await p.locator('button.wizard-btn').filter({hasText:'Mill'}).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({hasText:'Pocket'}).first().click(); await p.waitForTimeout(1800);
  await p.locator('#wizard button.primary').filter({hasText:'INSERT'}).first().click(); await p.waitForTimeout(1500);
  await p.locator('button.tab').filter({hasText:'BLOCKS'}).filter({visible:true}).first().click();
  await p.locator('.blocklyDraggable').first().waitFor({state:'visible',timeout:15000}).catch(()=>{});
  await p.waitForTimeout(2000);
  // STOP the auto-running sim to calm the page
  await p.locator('.pp-run').filter({visible:true}).first().click().catch(e=>console.log('stop err',e.message.split('\n')[0]));
  await p.waitForTimeout(1200);
  const readStep = ()=>p.evaluate(()=>{const t=[...document.querySelectorAll('text')].find(x=>{const r=x.getBoundingClientRect(); return Math.abs(r.x+r.width/2-424)<45 && Math.abs(r.y+r.height/2-571)<28;}); return t?t.textContent.trim():'?';});
  console.log('before:', await readStep());
  await p.mouse.click(424,571); await p.waitForTimeout(700);
  console.log('input present:', await p.locator('.blocklyHtmlInput').count());
  await p.keyboard.press('Control+A'); await p.keyboard.type('8', {delay:60}); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
  console.log('after:', await readStep());
  await p.screenshot({path:path.join(OUT,'be3.png')});
  await b.close(); console.log('DONE');
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
