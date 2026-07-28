/* Diagnose the contour 2D "doubled top-right edges": dump every fc-* ring's bbox in the
 * contour twin's FeatureCanvas, so we can see which rings exist and whether any pair is a
 * shifted copy (placed vs unplaced) instead of concentric. */
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1300, height: 980 } });
    await page.goto('http://localhost:5599');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; });
    await page.evaluate(() => window.openWiz('user_contour_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(700);

    // make it resemble the user's shot: boundary close to stock size
    for (const [k, v] of [['w', 180], ['h', 120], ['originX', 10], ['originY', 15]]) {
        await page.evaluate(([k, v]) => {
            const f = document.querySelector(`#wiz_user_form [data-param="${k}"]`);
            if (f) { f.value = v; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); }
        }, [k, v]);
    }
    await page.waitForTimeout(600);

    const rings = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('#wiz_user svg *').forEach((el) => {
            const cls = el.getAttribute('class') || '';
            if (/fc-grid|fc-axis/.test(cls)) return;
            let pts = null;
            if (el.tagName === 'polyline' || el.tagName === 'polygon') {
                pts = (el.getAttribute('points') || '').trim().split(/\s+/).map((s) => s.split(',').map(Number));
            } else if (el.tagName === 'path') {
                const d = el.getAttribute('d') || '';
                pts = [...d.matchAll(/(-?\d+\.?\d*)[ ,](-?\d+\.?\d*)/g)].map((m) => [Number(m[1]), Number(m[2])]);
            } else if (el.tagName === 'rect') {
                const x = +el.getAttribute('x'), y = +el.getAttribute('y'), w = +el.getAttribute('width'), h = +el.getAttribute('height');
                pts = [[x, y], [x + w, y + h]];
            } else if (el.tagName === 'line') {
                pts = [[+el.getAttribute('x1'), +el.getAttribute('y1')], [+el.getAttribute('x2'), +el.getAttribute('y2')]];
            }
            if (!pts || !pts.length) { out.push({ tag: el.tagName, cls, note: 'no pts' }); return; }
            const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
            out.push({ tag: el.tagName, cls, n: pts.length, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v * 10) / 10) });
        });
        return out;
    });
    console.log(JSON.stringify(rings, null, 1));
    const b = await page.locator('#wiz_user').boundingBox();
    await page.screenshot({ clip: b, path: process.env.SHOT || 'contour-diag.png' });
    await browser.close();
})();
