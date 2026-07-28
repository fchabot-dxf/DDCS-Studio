const { chromium } = require('@playwright/test');
const path = require('path'); const OUT = path.join(__dirname,'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const gc = (p)=>p.locator('.gcode').first().innerText().then(t=>t.replace(/\s+/g,' ').slice(0,90)).catch(()=>'?');
(async () => {
  const b = await chromium.launch({ headless: true }); const c = await b.newContext({ viewport:{width:1920,height:1080} }); const p = await c.newPage();
  p.on('dialog', d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(2500);
  await p.locator('button.wizard-btn').filter({hasText:'Mill'}).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({hasText:'Pocket'}).first().click(); await p.waitForTimeout(1800);
  await p.locator('#wizard button.primary').filter({hasText:'INSERT'}).first().click(); await p.waitForTimeout(1500);
  await p.locator('button.tab').filter({hasText:'BLOCKS'}).filter({visible:true}).first().click();
  await p.locator('.blocklyDraggable').first().waitFor({state:'visible',timeout:15000}).catch(()=>{});
  await p.waitForTimeout(2500);
  // what editable field types exist?
  const info = await p.evaluate(()=>({
    editableText: document.querySelectorAll('.blocklyEditableText').length,
    fieldNumber: document.querySelectorAll('.blocklyFieldNumber').length,
    htmlInputs: document.querySelectorAll('.blk-ws input, svg foreignObject input, .blocklyWorkspace input').length,
    dropdowns: document.querySelectorAll('.blocklyDropdownText, [class*="Dropdown"]').length,
    // find SVG text nodes equal to a stepdown-ish number
    stepFields: [...document.querySelectorAll('text')].filter(t=>/^(4|1\.5|80|40|60)$/.test((t.textContent||'').trim())).map(t=>{const r=t.getBoundingClientRect(); return {v:t.textContent.trim(), cls:(typeof t.parentElement?.getAttribute('class')==='string'?t.parentElement.getAttribute('class'):'')?.slice(0,24), x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};}).filter(f=>f.x>200&&f.x<1500).slice(0,12)
  }));
  console.log('field info:', JSON.stringify(info,null,1));
  console.log('gcode before:', await gc(p));
  // try clicking a "4" field (step down)
  const f = (info.stepFields||[]).find(x=>x.v==='4') || (info.stepFields||[])[0];
  if (f) {
    console.log('clicking field', JSON.stringify(f));
    await p.mouse.click(f.x, f.y); await p.waitForTimeout(600);
    await p.screenshot({path:path.join(OUT,'be-click.png')});
    const editor = await p.evaluate(()=>({htmlInput:document.querySelectorAll('.blocklyHtmlInput').length, widget:document.querySelectorAll('.blocklyWidgetDiv input, .blocklyWidgetDiv').length, dropdown:document.querySelectorAll('.blocklyDropDownDiv').length}));
    console.log('after click editors:', JSON.stringify(editor));
    // if input appeared, type
    await p.keyboard.press('Control+A').catch(()=>{}); await p.keyboard.type('6'); await p.keyboard.press('Enter'); await p.waitForTimeout(1200);
    console.log('gcode after:', await gc(p));
    await p.screenshot({path:path.join(OUT,'be-after.png')});
  }
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
