const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1300, height: 980 } });
  const open = async (op, stock) => {
    await page.goto('http://localhost:3211'); await page.waitForFunction(() => window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });
    await page.evaluate((st) => { const s = window.ddcsGetSettings(); s.stock = st; s.preview = s.preview||{}; s.preview.autoLoop=false; s.preview.carve = true; }, stock);
    await page.evaluate((o) => window.openWiz(o), op); await page.waitForSelector('#wiz_user_form', { state:'visible', timeout: 8000 }); await page.waitForTimeout(900);
  };
  const setP = async (k,v) => { await page.evaluate(([k2,v2]) => { const f = document.querySelector(`#wiz_user_form [data-param="${k2}"]`); if(f){ f.value=v2; f.dispatchEvent(new Event('input',{bubbles:true})); f.dispatchEvent(new Event('change',{bubbles:true})); } }, [k,v]); await page.waitForTimeout(400); };
  // (4) — the note discloses the op's typed Ø
  await open('user_contour_data', { show:true, x:200, y:150, z:25, datum:'nnp' });
  await setP('toolDia', 12); await page.waitForTimeout(600);
  const note = await page.evaluate(() => { const n = document.querySelector('#wiz_user .pp-carve-note'); return n ? { txt: n.textContent, shown: n.offsetParent !== null } : null; });
  console.log('NOTE:', JSON.stringify(note));
  const bb = await page.locator('#wiz_user').boundingBox(); if (bb) await page.screenshot({ path: 'scratchpad/p2a-note-glyph-largestock.png', clip: bb });
  // (5) — small stock glyph
  await open('user_drill_data', { show:true, x:40, y:40, z:10, datum:'nnp' }); await page.waitForTimeout(600);
  const bb2 = await page.locator('#wiz_user').boundingBox(); if (bb2) await page.screenshot({ path: 'scratchpad/p2a-glyph-smallstock.png', clip: bb2 });
  await b.close();
})();
