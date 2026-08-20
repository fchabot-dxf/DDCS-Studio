import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
await page.addInitScript(() => { try { localStorage.setItem('ddcs_theme', 'normal'); } catch (_) { } });
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);

// confirm the tab click still always opens (no gate)
await page.evaluate(() => window.showApp && window.showApp('gateway'));
await page.waitForTimeout(600);

const info = await page.evaluate(() => {
    const card = document.querySelector('.gateway-dl-pop');
    const btn = card ? card.querySelector('.dl-btn') : null;
    const note = card ? card.querySelector('.dl-note') : null;
    const gatewayAppHidden = document.getElementById('gateway-app')?.classList.contains('hidden');
    return {
        cardExists: !!card,
        cardTag: card ? card.tagName : null,
        cardPosition: card ? getComputedStyle(card).position : null,
        btnHref: btn ? btn.href : null,
        btnText: btn ? btn.textContent : null,
        noteText: note ? note.textContent : null,
        gatewayTabOpened: gatewayAppHidden === false,
    };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
