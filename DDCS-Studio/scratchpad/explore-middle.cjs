const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.locator('button.wizard-btn').filter({ hasText: 'Probe' }).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Middle' }).first().click(); await p.waitForTimeout(1800);
  await p.screenshot({ path: path.join(OUT, 'middle-1.png') });

  // form fields with labels
  const fields = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('#wizard input, #wizard select').forEach(inp => {
      const r = inp.getBoundingClientRect(); if (r.width === 0) return;
      const row = inp.closest('[class*="row"],[class*="field"],div,label'); const lbl = row ? (row.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30) : '';
      const opts = inp.tagName === 'SELECT' ? [...inp.options].map(o => o.text).slice(0, 8) : null;
      out.push({ tag: inp.tagName.toLowerCase(), val: (inp.value || '').slice(0, 16), lbl, opts, y: Math.round(r.y) });
    });
    return out.slice(0, 40);
  });
  console.log('=== MIDDLE FORM FIELDS ===');
  fields.forEach(f => console.log(`[y${f.y}] ${f.tag} "${f.lbl}" = ${f.val}${f.opts ? '  opts:' + JSON.stringify(f.opts) : ''}`));

  // toggle-style buttons (Manual/Auto, Single/Dual, Pocket/Boss ...)
  const toggles = await p.evaluate(() => [...document.querySelectorAll('#wizard button')].map(b => ({ t: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24), c: (typeof b.className === 'string' ? b.className : '').slice(0, 26), y: Math.round(b.getBoundingClientRect().y), on: /active|on|selected/.test(b.className) })).filter(b => b.t && b.y > 100 && b.y < 980 && !/pp-|toolbar-btn jog/.test(b.c)).slice(0, 30));
  console.log('\n=== MIDDLE TOGGLE BUTTONS ===');
  toggles.forEach(t => console.log(`[y${t.y}]${t.on ? '*' : ' '} "${t.t}"  .${t.c}`));

  console.log('\nlines:', await p.evaluate(() => { const e = [...document.querySelectorAll('#wizard *')].find(x => /\d+ lines/.test(x.textContent || '') && x.childElementCount < 3); return e ? e.textContent.trim() : '?'; }));
  await browser.close();
  console.log('DONE middle');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
