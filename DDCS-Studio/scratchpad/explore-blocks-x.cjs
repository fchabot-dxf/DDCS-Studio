const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => { console.log('DIALOG:', d.type(), JSON.stringify(d.message()).slice(0, 120)); d.accept('My Pocket').catch(() => d.accept().catch(() => {})); });
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);

  // insert a Pocket program → Blocks
  await p.locator('button.wizard-btn').filter({ hasText: 'Mill' }).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Pocket' }).first().click(); await p.waitForTimeout(1800);
  await p.locator('#wizard button.primary').filter({ hasText: 'INSERT' }).first().click(); await p.waitForTimeout(1500);
  await p.locator('button.tab').filter({ hasText: 'BLOCKS' }).filter({ visible: true }).first().click();
  await p.locator('.blocklyDraggable').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(2500);
  await p.screenshot({ path: path.join(OUT, 'bx-1-blocks.png') });

  // editable number fields
  const fields = await p.evaluate(() => [...document.querySelectorAll('.blocklyEditableText')].map(g => {
    const t = g.querySelector('.blocklyText'); const r = g.getBoundingClientRect();
    return { txt: (t?.textContent || '').trim(), cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2), w: Math.round(r.width) };
  }).filter(f => f.txt && f.cx > 0 && f.cx < 1560 && f.cy > 120));
  console.log('EDITABLE FIELDS:', JSON.stringify(fields.slice(0, 40)));

  // projected gcode + preview containers
  const info = await p.evaluate(() => {
    const byText = (needle) => [...document.querySelectorAll('*')].find(e => (e.childElementCount === 0 || e.className?.toString?.().length) && (e.textContent || '').trim().toUpperCase().startsWith(needle));
    const proj = [...document.querySelectorAll('[class*="proj"],[class*="gcode"],[class*="pp-code"],pre,[class*="code"]')].map(e => ({ cls: (typeof e.className === 'string' ? e.className : '').slice(0, 40), len: (e.textContent || '').length, r: e.getBoundingClientRect() })).filter(o => o.r.width > 200 && o.len > 40).map(o => ({ cls: o.cls, len: o.len, x: Math.round(o.r.x), y: Math.round(o.r.y), w: Math.round(o.r.width) }));
    const canv = [...document.querySelectorAll('canvas')].map(c => { const r = c.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(c => c.w > 50);
    const savebtns = [...document.querySelectorAll('button')].filter(b => /save wizard|custom wizard|define custom/i.test(b.textContent || '')).map(b => ({ t: (b.textContent || '').trim().slice(0, 30), cls: (typeof b.className === 'string' ? b.className : '').slice(0, 30), id: b.id, r: b.getBoundingClientRect() })).map(o => ({ t: o.t, cls: o.cls, id: o.id, x: Math.round(o.r.x), y: Math.round(o.r.y) }));
    return { proj, canv, savebtns };
  });
  console.log('PROJECTED/CODE PANELS:', JSON.stringify(info.proj));
  console.log('CANVASES:', JSON.stringify(info.canv));
  console.log('SAVE/CUSTOM WIZARD BUTTONS:', JSON.stringify(info.savebtns));

  // capture projected gcode text (first 6 lines) before edit
  const gc = () => p.evaluate(() => { const e = [...document.querySelectorAll('*')].filter(x => /^G90|^G0 |^G1 /m.test((x.textContent || '')) && x.childElementCount < 40).sort((a, b) => (a.textContent.length - b.textContent.length))[0]; return e ? (e.textContent || '').replace(/\s+/g, ' ').slice(0, 140) : '(none)'; });
  console.log('GCODE before:', await gc());

  // EDIT a numeric field
  const numF = fields.find(f => /^\d+(\.\d+)?$/.test(f.txt) && +f.txt >= 10);
  if (numF) {
    console.log('editing field', JSON.stringify(numF), '-> 140');
    await p.mouse.click(numF.cx, numF.cy); await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, 'bx-2-fieldopen.png') });
    await p.keyboard.press('Control+A'); await p.keyboard.type('140'); await p.keyboard.press('Enter');
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(OUT, 'bx-3-afteredit.png') });
    console.log('GCODE after :', await gc());
  } else console.log('no numeric field found to edit');

  // ZOOM the preview via wheel
  if (info.canv.length) {
    const c = info.canv.sort((a, b) => b.w - a.w)[0];
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    await p.mouse.move(cx, cy);
    for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(120); }
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, 'bx-4-zoom.png') });
    console.log('zoomed preview canvas at', cx, cy);
  }

  // SAVE / CUSTOM WIZARD flow
  if (info.savebtns.length) {
    const b = info.savebtns[0];
    console.log('clicking save/custom wizard:', b.t);
    await p.mouse.click(b.x + 20, b.y + 10); await p.waitForTimeout(1200);
    await p.screenshot({ path: path.join(OUT, 'bx-5-savewizard.png') });
    const after = await p.evaluate(() => ({ inputs: [...document.querySelectorAll('input:not([type=hidden])')].filter(i => i.getBoundingClientRect().width > 0).map(i => ({ ph: i.placeholder, val: i.value, cls: (typeof i.className === 'string' ? i.className : '').slice(0, 30) })), dialogs: [...document.querySelectorAll('[class*="modal"],[class*="dialog"],[class*="overlay"]')].filter(e => e.getBoundingClientRect().width > 300).map(e => (typeof e.className === 'string' ? e.className : '').slice(0, 40)), buttons: [...document.querySelectorAll('button')].filter(x => x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().y > 100).map(x => (x.textContent || '').trim().slice(0, 24)).filter(Boolean).slice(0, 30) }));
    console.log('AFTER SAVE-CLICK:', JSON.stringify(after, null, 1));
  }

  await browser.close();
  console.log('DONE bx');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
