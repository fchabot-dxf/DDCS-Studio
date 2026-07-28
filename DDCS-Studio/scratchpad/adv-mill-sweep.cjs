/* Advisor method-2 sweep: open each new mill twin, capture the 2D layout pane (default placement). */
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1300, height: 980 }, deviceScaleFactor: 2 });
    for (const op of ['user_drill_data', 'user_bore_data', 'user_pocket_data', 'user_surfacing_data']) {
        await page.goto('http://localhost:5599');
        await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });
        await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; });
        await page.evaluate((t) => window.openWiz(t), op);
        await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
        await page.waitForTimeout(900);
        const svg = await page.evaluate(() => {
            const els = document.querySelectorAll('#wiz_user svg');
            const el = els[els.length - 1];
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
        await page.screenshot({ clip: svg, path: `scratchpad/adv-sweep-${op}.png` });
    }
    await browser.close();
    console.log('done');
})();
