const { chromium } = require('playwright');
(async () => {
    const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1300, height: 980 } });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; });
    await page.evaluate(() => window.openWiz('user_text_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 }); await page.waitForTimeout(600);
    for (const [k, v] of [['stockAttach', 'cc'], ['pathDatum', 'cc']]) await page.evaluate(([k2, v2]) => { const f = document.querySelector(`#wiz_user_form [data-param="${k2}"]`); if (f) { f.value = v2; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); } }, [k, v]);
    await page.waitForTimeout(600);
    const out = await page.evaluate(() => {
        const st = document.querySelector('#wiz_user .fc-stock').getBoundingClientRect();
        const sx = st.width / 200, sy = st.height / 150, left = st.left, bottom = st.bottom;
        const feats = [...document.querySelectorAll('#wiz_user .fc-path, #wiz_user .fc-guide')];
        let u = null; for (const p of feats) { const r = p.getBoundingClientRect(); if (!r.width && !r.height) continue; u = u ? { left: Math.min(u.left, r.left), right: Math.max(u.right, r.right), top: Math.min(u.top, r.top), bottom: Math.max(u.bottom, r.bottom) } : { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }
        const fcCx = u ? ((u.left + u.right) / 2 - left) / sx : null, fcCy = u ? (bottom - (u.top + u.bottom) / 2) / sy : null;
        const code = document.querySelector('#wiz_user_code').textContent || ''; let mnX = 1e9, mxX = -1e9, mnY = 1e9, mxY = -1e9;
        for (const ln of code.split('\n')) { const mx = ln.match(/X(-?\d+\.?\d*)/), my = ln.match(/Y(-?\d+\.?\d*)/); if (mx) { mnX = Math.min(mnX, +mx[1]); mxX = Math.max(mxX, +mx[1]); } if (my) { mnY = Math.min(mnY, +my[1]); mxY = Math.max(mxY, +my[1]); } }
        return { fcCx, fcCy, trCx: (mnX + mxX) / 2, trCy: (mnY + mxY) / 2, nfeat: feats.length };
    });
    console.log('text feats=' + out.nfeat, `fc(${(out.fcCx||0).toFixed(1)},${(out.fcCy||0).toFixed(1)})`, `trace(${out.trCx.toFixed(1)},${out.trCy.toFixed(1)})`, `Δ=(${Math.abs(out.fcCx-out.trCx).toFixed(2)},${Math.abs(out.fcCy-out.trCy).toFixed(2)})`);
    await b.close();
})();
