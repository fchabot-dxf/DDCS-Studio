const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const FIND_BOTH = `(() => { const lbl=[...document.querySelectorAll('#wizard label,#wizard span,#wizard div')].find(e=>(e.textContent||'').trim()==='Find Both Axes'&&e.children.length===0); let n=lbl,cb=null; for(let i=0;i<5&&n;i++){ n=n.parentElement; cb=n&&n.querySelector('input[type=checkbox]'); if(cb) break; } if(cb&&!cb.checked) cb.click(); })()`;
const CROSSOVER = `(() => { let s=[]; ['Diag Travel','X Cross-Over','Y Cross-Over'].forEach(name=>{ const lbl=[...document.querySelectorAll('#wizard label,#wizard span,#wizard div')].find(e=>(e.textContent||'').trim()===name && e.children.length===0); if(!lbl) return; let n=lbl,inp=null; for(let k=0;k<3&&n;k++){ n=n.parentElement; inp=n&&n.querySelector('input[type=number]'); if(inp) break; } if(inp){ inp.value='120'; inp.dispatchEvent(new Event('input',{bubbles:true})); inp.dispatchEvent(new Event('change',{bubbles:true})); s.push(name); } }); return 'set: '+s.join(','); })()`;
const info = (p) => p.evaluate(() => { const ft = document.getElementById('m_type'); const disp = ft ? ft.options[ft.selectedIndex]?.text : '?'; const ln = [...document.querySelectorAll('#wizard *')].find(x => /\d+ lines/.test(x.textContent || '') && x.childElementCount < 4); return `feature(val=${ft ? ft.value : '?'}, shown=${disp}) | ${ln ? ln.textContent.replace(/\s+/g, ' ').trim().slice(0, 22) : '?'}`; });

async function openMiddle(p) {
  await p.locator('button.wizard-btn').filter({ hasText: 'Probe' }).first().click(); await p.waitForTimeout(400);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Middle' }).first().click(); await p.waitForTimeout(1500);
}
async function setStock(p, shape) {
  await p.locator('#wizard .pp-stock').first().click(); await p.waitForTimeout(700);
  await p.locator('#se_shape').selectOption(shape, { force: true }).catch(e => console.log(' shape err', e.message.split('\n')[0]));
  await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'Done', exact: true }).first().click().catch(e => console.log(' done err', e.message.split('\n')[0]));
  await p.waitForTimeout(700);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);

  // POCKET (single) — stock shape pocket
  await openMiddle(p);
  await setStock(p, 'pocket');
  console.log('POCKET:', await info(p));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(OUT, 'final-pocket.png') });
  await p.locator('#wizard button').filter({ hasText: 'CANCEL' }).first().click().catch(() => {}); await p.waitForTimeout(700);

  // BOSS (dual) — stock shape boss + feature boss + crossover
  await openMiddle(p);
  await p.evaluate(FIND_BOTH); await p.waitForTimeout(400);
  await setStock(p, 'boss');
  console.log('  crossover:', await p.evaluate(CROSSOVER)); await p.waitForTimeout(500);
  await p.locator('#m_type').selectOption('boss', { force: true }).catch(() => {}); await p.waitForTimeout(800); // Feature=Boss DEAD LAST
  console.log('BOSS:', await info(p));
  await p.screenshot({ path: path.join(OUT, 'final-boss.png') });

  await browser.close();
  console.log('DONE test-stock');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
