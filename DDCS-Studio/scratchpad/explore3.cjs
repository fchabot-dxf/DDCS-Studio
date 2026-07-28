const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(3000);

  // Open Pocket wizard
  await p.mouse.click(960, 500); await p.waitForTimeout(200);
  await p.locator('button.wizard-btn', { hasText: 'Mill' }).first().click();
  await p.waitForTimeout(400);
  await p.locator('.toolbar-dropdown-content button', { hasText: 'Pocket' }).first().click();
  await p.waitForTimeout(2000);

  // Header buttons of the wizard
  const hdr = await p.evaluate(() => {
    const w = document.querySelector('#wizard'); if (!w) return 'no #wizard';
    return [...w.querySelectorAll('button')].slice(0, 40).map(b => ({
      t: (b.innerText || b.title || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 24),
      id: b.id || '', c: (typeof b.className === 'string' ? b.className : '').slice(0, 32),
      x: Math.round(b.getBoundingClientRect().x), y: Math.round(b.getBoundingClientRect().y)
    })).filter(b => b.y < 90 || b.y > 960);
  });
  console.log('=== WIZARD HEADER/FOOTER BUTTONS ==='); console.log(JSON.stringify(hdr, null, 2));

  // Field inputs (id / value / nearby label)
  const fields = await p.evaluate(() => {
    const rows = [];
    document.querySelectorAll('#wizard input, #wizard select').forEach(inp => {
      const r = inp.getBoundingClientRect(); if (r.width === 0) return;
      // nearest label text = previous sibling / parent row text
      let lbl = '';
      const row = inp.closest('[class*="row"],[class*="field"],div,label'); if (row) lbl = (row.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 22);
      rows.push({ tag: inp.tagName.toLowerCase(), id: inp.id || '', name: inp.name || '', val: (inp.value || '').slice(0, 14), lbl, x: Math.round(r.x), y: Math.round(r.y) });
    });
    return rows.slice(0, 30);
  });
  console.log('\n=== WIZARD FIELDS ==='); console.log(JSON.stringify(fields, null, 2));

  // Close via CANCEL
  await p.locator('#wizard button', { hasText: 'CANCEL' }).first().click().catch(e => console.log('cancel failed', e.message));
  await p.waitForTimeout(800);
  console.log('wizard still open after CANCEL?', await p.locator('#wizard.overlay.active, #wizard.active').count());

  // Profiles: controller chip on MACROS
  await p.locator('button.tab', { hasText: 'MACROS' }).first().click();
  await p.waitForTimeout(1200);
  const chip = p.locator('#macros_ctrl_chip').first();
  console.log('\nchip present?', await chip.count());
  await chip.click().catch(e => console.log('chip click failed', e.message));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(OUT, 'profiles.png') });
  const prof = await p.evaluate(() => [...document.querySelectorAll('button,li,option,[class*=profile],[class*=controller],[class*=modal] *')]
    .map(e => ({ t: (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40), c: (typeof e.className === 'string' ? e.className : '').slice(0, 26), x: Math.round(e.getBoundingClientRect().x), y: Math.round(e.getBoundingClientRect().y), w: Math.round(e.getBoundingClientRect().width) }))
    .filter(e => e.t && e.w > 40 && e.y > 80 && e.y < 950));
  const seen = new Set();
  console.log('\n=== PROFILE / CONTROLLER PICKER ==='); console.log(JSON.stringify(prof.filter(o => { const k = o.t + o.y; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 30), null, 2));

  await browser.close();
  console.log('\nDONE explore3');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
