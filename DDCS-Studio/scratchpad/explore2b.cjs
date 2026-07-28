const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';

const bigCanvas = (p) => p.evaluate(() => { let b = null; document.querySelectorAll('canvas').forEach(cv => { const r = cv.getBoundingClientRect(); if (r.width > 60 && r.height > 60 && getComputedStyle(cv).display !== 'none' && (!b || r.width * r.height > b.a)) b = { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), a: r.width * r.height }; }); return b; });
const gcode = (p) => p.locator('.gcode').first().innerText().then(t => t.replace(/\s+/g, ' ').slice(0, 120)).catch(() => '(none)');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => { console.log('DIALOG', d.type(), JSON.stringify(d.message()).slice(0, 100)); d.accept('My Pocket').catch(() => d.accept().catch(() => {})); });
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);

  // PART 1 — mill zoom (biggest canvas) + run
  await p.locator('button.wizard-btn').filter({ hasText: 'Mill' }).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Pocket' }).first().click(); await p.waitForTimeout(1800);
  let c = await bigCanvas(p); console.log('mill big canvas:', JSON.stringify(c));
  await p.locator('#wizard .pp-run').first().click().catch(() => {});
  await p.waitForTimeout(500);
  if (c) { await p.mouse.move(c.x, c.y); for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(110); } }
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(OUT, 'x2-mill-zoomrun.png') });
  await p.locator('#wizard button').filter({ hasText: 'CANCEL' }).first().click().catch(() => {}); await p.waitForTimeout(600);

  // PART 2 — insert, blocks, edit a dropdown, see gcode change
  await p.locator('button.wizard-btn').filter({ hasText: 'Mill' }).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Pocket' }).first().click(); await p.waitForTimeout(1800);
  await p.locator('#wizard button.primary').filter({ hasText: 'INSERT' }).first().click(); await p.waitForTimeout(1500);
  await p.locator('button.tab').filter({ hasText: 'BLOCKS' }).filter({ visible: true }).first().click();
  await p.locator('.blocklyDraggable').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(2000);
  console.log('gcode BEFORE:', await gcode(p));
  // find a dropdown field by its value text ('concentric' or 'rect')
  const dd = await p.evaluate(() => { for (const val of ['concentric', 'rect', 'bothways']) { const el = [...document.querySelectorAll('text, .blocklyText, .blocklyDropdownText')].find(e => (e.textContent || '').trim() === val); if (el) { const r = el.getBoundingClientRect(); return { val, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; } } return null; });
  console.log('dropdown field:', JSON.stringify(dd));
  if (dd) {
    await p.mouse.click(dd.x, dd.y); await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(OUT, 'x2-blk-ddopen.png') });
    const opts = await p.evaluate(() => [...document.querySelectorAll('.blocklyMenuItem, .blocklyDropDownDiv [role=menuitem], .blocklyDropDownDiv .blocklyMenuItemContent')].map(e => (e.textContent || '').trim()).filter(Boolean));
    console.log('dropdown options:', JSON.stringify(opts));
    // click an option different from current
    const target = opts.find(o => o && o.toLowerCase() !== dd.val);
    if (target) { await p.locator('.blocklyMenuItem, .blocklyDropDownDiv [role=menuitem]').filter({ hasText: target }).first().click().catch(async () => { await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); }); }
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(OUT, 'x2-blk-ddafter.png') });
    console.log('picked:', target, ' gcode AFTER:', await gcode(p));
  }

  // PART 3 — save wizard
  console.log('save btn:', await p.locator('.blk-dev-savebtn').count());
  await p.locator('.blk-dev-savebtn').first().click().catch(e => console.log('save click err', e.message));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(OUT, 'x2-savewizard.png') });
  const st = await p.evaluate(() => ({ inputs: [...document.querySelectorAll('input:not([type=hidden]),textarea')].filter(i => i.getBoundingClientRect().width > 0 && i.getBoundingClientRect().y > 60).map(i => ({ ph: i.placeholder, val: (i.value || '').slice(0, 20) })), modal: [...document.querySelectorAll('[class*="modal"],[class*="dialog"],[class*="overlay"],[class*="sheet"]')].filter(e => e.getBoundingClientRect().width > 300 && getComputedStyle(e).display !== 'none').map(e => (typeof e.className === 'string' ? e.className : '').slice(0, 40)), buttons: [...document.querySelectorAll('button')].filter(b => b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().y > 80).map(b => (b.textContent || '').trim().slice(0, 22)).filter(Boolean).slice(0, 24) }));
  console.log('SAVE STATE:', JSON.stringify(st, null, 1));

  await browser.close();
  console.log('DONE x2');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
