const { chromium } = require('playwright');
(async () => {
    const b = await chromium.launch();
    const p = await b.newPage({ viewport: { width: 700, height: 420 } });
    const abs = require('path').resolve('scratchpad/adv-contour-diag.png').split('\\').join('/');
    await p.goto('file:///' + abs);
    await p.evaluate(() => {
        const img = document.querySelector('img');
        img.style.position = 'absolute'; img.style.imageRendering = 'pixelated';
        img.style.transformOrigin = '0 0'; img.style.transform = 'scale(4)';
        img.style.left = (-905 * 4 + 40) + 'px'; img.style.top = (-520 * 4 + 40) + 'px';
        document.body.style.overflow = 'hidden'; document.body.style.background = '#000';
    });
    await p.screenshot({ path: 'scratchpad/adv-contour-tr-zoom.png' });
    await p.evaluate(() => {
        const img = document.querySelector('img');
        img.style.left = (-680 * 4 + 40) + 'px'; img.style.top = (-660 * 4 + 40) + 'px';
    });
    await p.screenshot({ path: 'scratchpad/adv-contour-bl-zoom.png' });
    await b.close();
})();
