import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
await page.goto('http://127.0.0.1:8799', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
console.log('LED in tab, green: ' + (await page.locator('.hdr-tabs .tab[data-app="gateway"] #gateway-led.led-ok').count() === 1));
await page.locator('.hdr-tabs').screenshot({ path: 'verification/led-tab.png' });
await browser.close();
