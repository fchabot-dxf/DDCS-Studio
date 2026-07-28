/* t718: per-twin placement parity — the placed previewGeometry bbox CENTRE should coincide with the emit toolpath centre. */
const { chromium } = require('playwright');
const TWINS = [
    { op: 'user_contour_data', cfg: { w: 180, h: 120, stockAttach: 'cc', pathDatum: 'cc' } },
    { op: 'user_pocket_data', cfg: { w: 160, h: 100, stockAttach: 'cc', pathDatum: 'cc' } },
    { op: 'user_surfacing_data', cfg: { w: 150, h: 100, stockAttach: 'cc', pathDatum: 'cc' } },
    { op: 'user_drill_data', cfg: { stockAttach: 'cc', pathDatum: 'cc' } },
    { op: 'user_bore_data', cfg: { stockAttach: 'cc', pathDatum: 'cc' } },
    { op: 'user_slot_data', cfg: { ax: 20, ay: 20, bx: 80, by: 40, originX: 40, originY: 30 } },
];
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1300, height: 980 } });
    for (const { op, cfg } of TWINS) {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });
        await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; });
        await page.evaluate((t) => window.openWiz(t), op);
        await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
        await page.waitForTimeout(500);
        for (const [k, v] of Object.entries(cfg)) await page.evaluate(([k2, v2]) => { const f = document.querySelector(`#wiz_user_form [data-param="${k2}"]`); if (f) { f.value = v2; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); } }, [k, v]);
        await page.waitForTimeout(600);
        const out = await page.evaluate(() => {
            const st = document.querySelector('#wiz_user .fc-stock').getBoundingClientRect();
            const scaleX = st.width / 200, scaleY = st.height / 150, left = st.left, bottom = st.bottom;
            const feats = [...document.querySelectorAll('#wiz_user .fc-path, #wiz_user .fc-guide')];
            let u = null; for (const p of feats) { const r = p.getBoundingClientRect(); if (!r.width && !r.height) continue; u = u ? { left: Math.min(u.left, r.left), right: Math.max(u.right, r.right), top: Math.min(u.top, r.top), bottom: Math.max(u.bottom, r.bottom) } : { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }
            const fcCx = u ? ((u.left + u.right) / 2 - left) / scaleX : null, fcCy = u ? (bottom - (u.top + u.bottom) / 2) / scaleY : null;
            const code = document.querySelector('#wiz_user_code').textContent || '';
            let mnX = 1e9, mxX = -1e9, mnY = 1e9, mxY = -1e9;
            for (const ln of code.split('\n')) { const mx = ln.match(/X(-?\d+\.?\d*)/), my = ln.match(/Y(-?\d+\.?\d*)/); if (mx) { mnX = Math.min(mnX, +mx[1]); mxX = Math.max(mxX, +mx[1]); } if (my) { mnY = Math.min(mnY, +my[1]); mxY = Math.max(mxY, +my[1]); } }
            const trCx = mxX > -1e9 ? (mnX + mxX) / 2 : null, trCy = mxX > -1e9 ? (mnY + mxY) / 2 : null;
            return { fcCx, fcCy, trCx, trCy, nfeat: feats.length };
        });
        const dx = (out.fcCx != null && out.trCx != null) ? Math.abs(out.fcCx - out.trCx) : NaN;
        const dy = (out.fcCy != null && out.trCy != null) ? Math.abs(out.fcCy - out.trCy) : NaN;
        console.log(op.padEnd(22), `feats=${out.nfeat}`, `fc(${(out.fcCx||0).toFixed(1)},${(out.fcCy||0).toFixed(1)})`, `trace(${(out.trCx||0).toFixed(1)},${(out.trCy||0).toFixed(1)})`, `Δcentre=(${dx.toFixed(2)},${dy.toFixed(2)})`);
    }
    await browser.close();
})();
