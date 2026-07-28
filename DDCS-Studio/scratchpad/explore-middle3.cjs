const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const FIND_BOTH = `(() => { const lbl=[...document.querySelectorAll('#wizard label,#wizard span,#wizard div')].find(e=>(e.textContent||'').trim()==='Find Both Axes'&&e.children.length===0); let n=lbl,cb=null; for(let i=0;i<5&&n;i++){ n=n.parentElement; cb=n&&n.querySelector('input[type=checkbox]'); if(cb) break; } if(cb&&!cb.checked) cb.click(); })()`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.locator('button.wizard-btn').filter({ hasText: 'Probe' }).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Middle' }).first().click(); await p.waitForTimeout(1600);

  // set boss + dual to reveal cross-over fields, then dump ALL number inputs with row labels
  await p.evaluate(FIND_BOTH); await p.waitForTimeout(500);
  await p.locator('#m_type').selectOption('boss', { force: true }).catch(() => {}); await p.waitForTimeout(800);
  const mains = await p.evaluate(() => [...document.querySelectorAll('#wizard input[type=number]')].map(i => { const r = i.getBoundingClientRect(); if (r.width === 0 || r.y < 100 || r.y > 990) return null; let lbl = ''; let n = i; for (let k = 0; k < 4 && n; k++) { n = n.parentElement; const t = (n?.querySelector('label,span,div')?.textContent || n?.firstChild?.textContent || '').trim(); if (t && t.length < 30) { lbl = t; break; } } return { id: i.id, val: i.value, lbl: (i.closest('div')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 26), y: Math.round(r.y) }; }).filter(Boolean));
  console.log('=== BOSS+DUAL number fields (look for Cross-Over) ===');
  mains.forEach(f => console.log(`[y${f.y}] #${f.id || '-'} "${f.lbl}" = ${f.val}`));

  // stock editor Shape select + dims
  await p.locator('#wizard .pp-stock').first().click(); await p.waitForTimeout(900);
  const stock = await p.evaluate(() => ({
    selects: [...document.querySelectorAll('.stock-editor-pop select, [class*=stock] select')].map(s => ({ id: s.id, val: s.value, opts: [...s.options].map(o => ({ v: o.value, t: o.text })) })),
    nums: [...document.querySelectorAll('.stock-editor-pop input, [class*=stock] input')].filter(i => i.type === 'number' || i.type === 'text').map(i => ({ id: i.id, val: i.value }))
  }));
  console.log('\n=== STOCK EDITOR ===');
  console.log(JSON.stringify(stock, null, 1));
  await browser.close();
  console.log('DONE m3');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
