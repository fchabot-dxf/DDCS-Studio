const { chromium } = require('@playwright/test');
const URL = 'https://ddcs-studio.pages.dev/';
const FIND_BOTH = `(() => { const lbl=[...document.querySelectorAll('#wizard label,#wizard span,#wizard div')].find(e=>(e.textContent||'').trim()==='Find Both Axes'&&e.children.length===0); let n=lbl,cb=null; for(let i=0;i<5&&n;i++){ n=n.parentElement; cb=n&&n.querySelector('input[type=checkbox]'); if(cb) break; } if(cb&&!cb.checked) cb.click(); })()`;
const truth = (p) => p.evaluate(() => {
  const m = document.getElementById('m_type');
  // visible Feature dropdown text: find a visible select whose options include Boss
  const visSel = [...document.querySelectorAll('#wizard select')].map(s=>({id:s.id, vis:s.getBoundingClientRect().width>0 && getComputedStyle(s).visibility!=='hidden' && getComputedStyle(s).display!=='none', val:s.value, opts:[...s.options].map(o=>o.text).join('/')}));
  return { m_value: m?m.value:'?', selects: visSel };
});
(async () => {
  const b = await chromium.launch({ headless: true }); const c = await b.newContext({ viewport:{width:1920,height:1080} }); const p = await c.newPage();
  p.on('dialog', d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(2500);
  await p.locator('button.wizard-btn').filter({hasText:'Probe'}).first().click(); await p.waitForTimeout(400);
  await p.locator('.toolbar-dropdown-content button').filter({hasText:'Middle'}).first().click(); await p.waitForTimeout(1500);
  await p.locator('#m_type').selectOption('boss',{force:true}); await p.waitForTimeout(500);
  await p.evaluate(FIND_BOTH); await p.waitForTimeout(500);
  await p.locator('#wizard .pp-stock').first().click(); await p.waitForTimeout(600);
  await p.locator('#se_shape').selectOption('boss',{force:true}); await p.waitForTimeout(400);
  await p.getByRole('button',{name:'Done',exact:true}).first().click().catch(()=>{}); await p.waitForTimeout(1000);
  console.log('after full boss setup:', JSON.stringify(await truth(p),null,1));
  await p.waitForTimeout(1500);
  console.log('+1.5s:', JSON.stringify(await truth(p),null,1));
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
