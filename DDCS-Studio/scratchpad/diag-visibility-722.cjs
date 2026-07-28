const { chromium } = require('playwright');
const vis = (page, param) => page.evaluate((p) => { const f = document.querySelector(`#wiz_user_form [data-param="${p}"]`); if (!f) return 'absent'; const row = f.closest('[data-when],[data-when-all],label,.uop-row,.wiz-row,div'); return (row && row.offsetParent !== null) ? 'shown' : 'hidden'; }, param);
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1300, height: 980 } });
  await page.goto('http://localhost:3211'); await page.waitForFunction(() => window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show:true, x:200, y:150, z:25, datum:'nnp' }; s.preview = s.preview||{}; s.preview.autoLoop=false; });
  await page.evaluate(() => window.openWiz('user_drill_data')); await page.waitForSelector('#wiz_user_form', { state:'visible', timeout: 8000 }); await page.waitForTimeout(500);
  const setP = async (v) => { await page.evaluate((val) => { const f = document.querySelector('#wiz_user_form [data-param="pattern"]'); f.value = val; f.dispatchEvent(new Event('change', {bubbles:true})); f.dispatchEvent(new Event('input', {bubbles:true})); }, v); await page.waitForTimeout(300); };
  await setP('grid');   console.log('GRID  : cols', await vis(page,'cols'), '| dia', await vis(page,'dia'), '| spacing', await vis(page,'spacing'), '| w', await vis(page,'w'));
  await setP('circle'); console.log('CIRCLE: cols', await vis(page,'cols'), '| dia', await vis(page,'dia'), '| count', await vis(page,'count'), '| w', await vis(page,'w'));
  await setP('line');   console.log('LINE  : cols', await vis(page,'cols'), '| spacing', await vis(page,'spacing'), '| count', await vis(page,'count'), '| angle', await vis(page,'angle'));
  await setP('rect');   console.log('RECT  : cols', await vis(page,'cols'), '| w', await vis(page,'w'), '| nx', await vis(page,'nx'), '| dia', await vis(page,'dia'));
  await b.close();
})();
