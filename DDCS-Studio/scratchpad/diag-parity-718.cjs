/* t718 diagnostic: does the placed previewGeometry (fc-path) coincide with the emit toolpath, for attach=cc/pathDatum=cc? */
const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1300, height: 980 } });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; });
    await page.evaluate(() => window.openWiz('user_contour_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(600);
    for (const [k, v] of [['w', 180], ['h', 120], ['originX', 0], ['originY', 0], ['stockAttach', 'cc'], ['pathDatum', 'cc']]) {
        await page.evaluate(([k2, v2]) => { const f = document.querySelector(`#wiz_user_form [data-param="${k2}"]`); if (f) { f.value = v2; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); } }, [k, v]);
    }
    await page.waitForTimeout(700);

    const out = await page.evaluate(() => {
        // calibration from the stock rect (world 0..200 x 0..150, datum nnp → ox=0,oy=0)
        const st = document.querySelector('#wiz_user .fc-stock').getBoundingClientRect();
        const scaleX = st.width / 200, scaleY = st.height / 150, left = st.left, bottom = st.bottom;
        const toWorld = (r) => ({ minX: (r.left - left) / scaleX, maxX: (r.right - left) / scaleX, minY: (bottom - r.bottom) / scaleY, maxY: (bottom - r.top) / scaleY });
        // union all fc-path (the offset toolpath) screen rects → world
        const paths = [...document.querySelectorAll('#wiz_user .fc-path')];
        let u = null; for (const p of paths) { const r = p.getBoundingClientRect(); u = u ? { left: Math.min(u.left, r.left), right: Math.max(u.right, r.right), top: Math.min(u.top, r.top), bottom: Math.max(u.bottom, r.bottom) } : { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }
        const fcWorld = u ? toWorld(u) : null;
        // emit toolpath bbox from the gcode text
        const code = document.querySelector('#wiz_user_code').textContent || '';
        let mnX = 1e9, mxX = -1e9, mnY = 1e9, mxY = -1e9;
        for (const ln of code.split('\n')) { const mx = ln.match(/X(-?\d+\.?\d*)/), my = ln.match(/Y(-?\d+\.?\d*)/); if (mx) { const x = +mx[1]; mnX = Math.min(mnX, x); mxX = Math.max(mxX, x); } if (my) { const y = +my[1]; mnY = Math.min(mnY, y); mxY = Math.max(mxY, y); } }
        const traceWorld = mxX > -1e9 ? { minX: mnX, maxX: mxX, minY: mnY, maxY: mxY } : null;
        return { fcWorld, traceWorld, stockScreen: { w: st.width, h: st.height } };
    });
    console.log('fc-path world bbox :', JSON.stringify(out.fcWorld));
    console.log('emit trace  bbox  :', JSON.stringify(out.traceWorld));
    if (out.fcWorld && out.traceWorld) {
        const d = ['minX', 'maxX', 'minY', 'maxY'].map((k) => Math.abs(out.fcWorld[k] - out.traceWorld[k]));
        console.log('abs diffs (mm)    :', d.map((x) => x.toFixed(2)).join(', '), '| max', Math.max(...d).toFixed(2));
    }
    await browser.close();
})();
