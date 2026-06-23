import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:8799', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('.hdr-tabs .tab[data-app="gateway"]').click();
await page.waitForTimeout(500);
await page.locator('#gateway-app .tabs .tab', { hasText: 'Submit' }).click();
await page.waitForTimeout(400);

const probe = () => page.evaluate(() => {
    const theme = document.body.dataset.theme;
    const cs = (sel, prop) => { const n = document.querySelector(sel); return n ? getComputedStyle(n)[prop] : null; };
    return {
        theme,
        subtabBg: cs('#gateway-app .tabs .tab.on', 'backgroundColor'),
        primaryBg: cs('#gateway-app button.primary', 'backgroundImage') !== 'none'
            ? 'gradient' : cs('#gateway-app button.primary', 'backgroundColor'),
        dropColor: cs('#gateway-app .drop', 'color'),
        panelText: cs('#gateway-app .muted', 'color'),
    };
});

const seen = [];
for (let i = 0; i < 5; i++) {
    seen.push(await probe());
    await page.evaluate(() => window.toggleStyle());
    await page.waitForTimeout(350);
}
for (const s of seen) console.log(`${s.theme.padEnd(12)} subtab=${s.subtabBg}  primary=${s.primaryBg}  drop=${s.dropColor}`);
const distinct = new Set(seen.map((s) => s.subtabBg + s.primaryBg));
console.log('themes re-skin the panel: ' + (distinct.size >= 3));
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
await browser.close();
