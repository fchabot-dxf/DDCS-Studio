const { chromium } = require('@playwright/test');
const URL = 'https://ddcs-studio.pages.dev/';
const FIND_BOTH = `(() => { const lbl=[...document.querySelectorAll('#wizard label,#wizard span,#wizard div')].find(e=>(e.textContent||'').trim()==='Find Both Axes'&&e.children.length===0); let n=lbl,cb=null; for(let i=0;i<5&&n;i++){ n=n.parentElement; cb=n&&n.querySelector('input[type=checkbox]'); if(cb) break; } if(cb&&!cb.checked) cb.click(); })()`;
const CROSSOVER = `(() => { ['Diag Travel','X Cross-Over','Y Cross-Over'].forEach(name=>{ const lbl=[...document.querySelectorAll('#wizard label,#wizard span,#wizard div')].find(e=>(e.textContent||'').trim()===name && e.children.length===0); if(!lbl) return; let n=lbl,inp=null; for(let k=0;k<3&&n;k++){ n=n.parentElement; inp=n&&n.querySelector('input[type=number]'); if(inp) break; } if(inp){ inp.value='120'; inp.dispatchEvent(new Event('input',{bubbles:true})); inp.dispatchEvent(new Event('change',{bubbles:true})); } }); })()`;
const ft = (p) => p.evaluate(() => { const s = document.getElementById('m_type'); return s ? s.value : '?'; });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.locator('button.wizard-btn').filter({ hasText: 'Probe' }).first().click(); await p.waitForTimeout(400);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Middle' }).first().click(); await p.waitForTimeout(1500);

  // ORDER A: m_type FIRST, then find_both, then crossover
  console.log('--- Order A: boss → dual → crossover ---');
  await p.locator('#m_type').selectOption('boss', { force: true }); await p.waitForTimeout(400); console.log(' after boss:', await ft(p));
  await p.evaluate(FIND_BOTH); await p.waitForTimeout(600); console.log(' after find_both:', await ft(p));
  await p.evaluate(CROSSOVER); await p.waitForTimeout(600); console.log(' after crossover:', await ft(p));
  await p.waitForTimeout(1500); console.log(' +1.5s:', await ft(p));
  // re-assert boss at the very end
  await p.locator('#m_type').selectOption('boss', { force: true }); await p.waitForTimeout(300); console.log(' re-set boss:', await ft(p));
  await p.waitForTimeout(2000); console.log(' +2s after re-set:', await ft(p));
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
