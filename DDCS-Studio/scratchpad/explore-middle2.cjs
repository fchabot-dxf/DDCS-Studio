const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const FIND_BOTH = `(() => { const lbl=[...document.querySelectorAll('#wizard label,#wizard span,#wizard div')].find(e=>(e.textContent||'').trim()==='Find Both Axes'&&e.children.length===0); let n=lbl,cb=null; for(let i=0;i<5&&n;i++){ n=n.parentElement; cb=n&&n.querySelector('input[type=checkbox]'); if(cb) break; } if(cb&&!cb.checked) cb.click(); return cb?'toggled':'no'; })()`;

const dumpFields = (p) => p.evaluate(() => {
  const out = [];
  document.querySelectorAll('#wizard input, #wizard select, #wizard [role=switch], #wizard button.seg-btn').forEach(el => {
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.top < 100 || r.top > 990) return;
    const row = el.closest('[class*="row"],[class*="field"],label,div');
    const lbl = row ? (row.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 26) : '';
    out.push({ id: el.id || '', tag: el.tagName.toLowerCase(), type: el.type || '', val: (el.value || '').slice(0, 12), checked: el.checked, lbl, y: Math.round(r.y) });
  });
  return out;
});

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.locator('button.wizard-btn').filter({ hasText: 'Probe' }).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Middle' }).first().click(); await p.waitForTimeout(1600);

  console.log('=== POCKET (default) FIELDS ===');
  (await dumpFields(p)).forEach(f => console.log(`[y${f.y}] ${f.tag}${f.type ? ':' + f.type : ''} #${f.id} "${f.lbl}" = ${f.val}${f.checked !== undefined ? ' checked=' + f.checked : ''}`));

  // stock button
  console.log('\n=== STOCK BUTTON ? ===');
  console.log(await p.evaluate(() => [...document.querySelectorAll('#wizard button, #wizard .pp-stock')].filter(b => /stock/i.test((b.title || '') + (b.className || ''))).map(b => ({ t: (b.title || b.textContent || '').slice(0, 40), c: (typeof b.className === 'string' ? b.className : '').slice(0, 30) }))));
  await p.locator('#wizard .pp-stock').first().click().catch(e => console.log('stock click', e.message));
  await p.waitForTimeout(1000);
  await p.screenshot({ path: path.join(OUT, 'm2-stock.png') });
  console.log('after stock click — dialogs/inputs:', await p.evaluate(() => ({ modals: [...document.querySelectorAll('[class*=modal],[class*=dialog],[class*=stock]')].filter(e => e.getBoundingClientRect().width > 250).map(e => (typeof e.className === 'string' ? e.className : '').slice(0, 30)).slice(0, 6), inputs: [...document.querySelectorAll('input')].filter(i => i.getBoundingClientRect().width > 0 && i.getBoundingClientRect().y > 100).map(i => ({ id: i.id, ph: i.placeholder, val: (i.value || '').slice(0, 10) })).slice(0, 20) })));
  await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(400);

  // dual + boss to reveal cross-over fields
  await p.evaluate(FIND_BOTH); await p.waitForTimeout(500);
  await p.locator('#m_type').selectOption('boss', { force: true }).catch(() => {}); await p.waitForTimeout(800);
  console.log('\n=== BOSS + DUAL FIELDS (cross-over should appear) ===');
  (await dumpFields(p)).forEach(f => console.log(`[y${f.y}] ${f.tag}${f.type ? ':' + f.type : ''} #${f.id} "${f.lbl}" = ${f.val}`));
  await p.screenshot({ path: path.join(OUT, 'm2-boss-dual.png') });

  await browser.close();
  console.log('DONE m2');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
