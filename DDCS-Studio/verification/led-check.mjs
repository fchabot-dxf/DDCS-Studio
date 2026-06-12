import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
await page.goto('http://127.0.0.1:8799', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const cls = await page.locator('#gateway-led').getAttribute('class');
console.log('bridged LED class: ' + cls + '  (green: ' + cls.includes('led-ok') + ')');
await page.locator('.brand').screenshot({ path: 'verification/led-on.png' });
await browser.close();
