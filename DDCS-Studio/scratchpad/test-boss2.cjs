const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const FIND_BOTH = `(() => { const lbl=[...document.querySelectorAll('#wizard label,#wizard span,#wizard div')].find(e=>(e.textContent||'').trim()==='Find Both Axes'&&e.children.length===0); let n=lbl,cb=null; for(let i=0;i<5&&n;i++){ n=n.parentElement; cb=n&&n.querySelector('input[type=checkbox]'); if(cb) break; } if(cb&&!cb.checked) cb.click(); return cb?('dual='+cb.checked):'no cb'; })()`;
const featVal = (p) => p.evaluate(() => { const s = document.getElementById('m_type'); const sel = s ? s.options[s.selectedIndex]?.text : '?'; const ln = [...document.querySelectorAll('#wizard *')].find(x => /\d+ lines/.test(x.textContent || '') && x.childElementCount < 4); return `feature=${sel} | ${ln ? ln.textContent.replace(/\s+/g, ' ').trim().slice(0, 30) : '?'}`; });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.locator('button.wizard-btn').filter({ hasText: 'Probe' }).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Middle' }).first().click(); await p.waitForTimeout(1600);

  console.log('dual toggle:', await p.evaluate(FIND_BOTH)); await p.waitForTimeout(700);
  console.log('after dual:', await featVal(p));
  // now set Boss LAST, with force (native select is hidden)
  await p.locator('#m_type').selectOption('boss', { force: true, timeout: 5000 }).catch(e => console.log('selopt err', e.message.split('\n')[0]));
  await p.waitForTimeout(1000);
  console.log('after boss(force):', await featVal(p));
  await p.screenshot({ path: path.join(OUT, 'boss-dual2.png') });
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
