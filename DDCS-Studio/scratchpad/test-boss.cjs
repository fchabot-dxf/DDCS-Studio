const { chromium } = require('@playwright/test');
const path = require('path');
const OUT = path.join(__dirname, 'explore');
const URL = 'https://ddcs-studio.pages.dev/';
const FIND_BOTH = `(() => {
  const lbl=[...document.querySelectorAll('#wizard label,#wizard span,#wizard div')].find(e=>(e.textContent||'').trim()==='Find Both Axes'&&e.children.length===0);
  if(!lbl) return 'no label';
  let n=lbl,cb=null;
  for(let i=0;i<5&&n;i++){ n=n.parentElement; cb=n&&n.querySelector('input[type=checkbox]'); if(cb) break; }
  if(cb&&!cb.checked) cb.click();
  return cb?('toggled -> checked='+cb.checked):'no checkbox found';
})()`;
const lines = (p) => p.evaluate(() => { const e = [...document.querySelectorAll('#wizard *')].find(x => /Middle \(data\)|\d+ lines/.test(x.textContent || '') && x.childElementCount < 4); return e ? (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) : '?'; });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.locator('button.wizard-btn').filter({ hasText: 'Probe' }).first().click(); await p.waitForTimeout(500);
  await p.locator('.toolbar-dropdown-content button').filter({ hasText: 'Middle' }).first().click(); await p.waitForTimeout(1600);
  console.log('default (pocket/single):', await lines(p));

  // Feature -> Boss (native select is hidden; set via id + change event)
  console.log('feature:', await p.evaluate(`(() => { const s=document.getElementById('m_type'); if(s){ s.value='boss'; s.dispatchEvent(new Event('change',{bubbles:true})); } return s?('feature='+s.value):'no m_type'; })()`));
  await p.waitForTimeout(800);
  console.log('after Boss:', await lines(p));
  // Find Both Axes -> on
  console.log('find-both:', await p.evaluate(FIND_BOTH));
  await p.waitForTimeout(1200);
  console.log('after dual:', await lines(p));
  await p.screenshot({ path: path.join(OUT, 'boss-dual.png') });
  await browser.close();
  console.log('DONE test-boss');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
