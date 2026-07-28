/* Page-coord rects for stock/guide/path rings + 4x corner clips, to see if any layer doubles. */
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1300, height: 980 }, deviceScaleFactor: 3 });
    await page.goto('http://localhost:5599');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; });
    await page.evaluate(() => window.openWiz('user_contour_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(700);
    for (const [k, v] of [['w', 180], ['h', 120], ['originX', 10], ['originY', 15]]) {
        await page.evaluate(([k2, v2]) => {
            const f = document.querySelector(`#wiz_user_form [data-param="${k2}"]`);
            if (f) { f.value = v2; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); }
        }, [k, v]);
    }
    await page.waitForTimeout(600);

    const rects = await page.evaluate(() => {
        const grab = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), r: +r.right.toFixed(1), b: +r.bottom.toFixed(1) }; };
        return { stock: grab('#wiz_user .fc-stock'), guide: grab('#wiz_user .fc-guide'), path: grab('#wiz_user .fc-path') };
    });
    console.log(JSON.stringify(rects));
    const p = rects.path;
    await page.screenshot({ clip: { x: p.r - 45, y: p.y - 25, width: 70, height: 60 }, path: 'scratchpad/adv-ct-tr.png' });
    await page.screenshot({ clip: { x: p.x - 25, y: p.b - 35, width: 70, height: 60 }, path: 'scratchpad/adv-ct-bl.png' });
    await browser.close();
})();
