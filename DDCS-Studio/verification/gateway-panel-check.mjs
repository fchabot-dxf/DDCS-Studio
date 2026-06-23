// Ad-hoc verification: gateway-served Studio — LED lights, GATEWAY tab un-greys, panel mounts,
// STUDIO tab switches back. Run with the gateway up on 8799:
//   node verification/gateway-panel-check.mjs [http://127.0.0.1:8799]
import { chromium } from '@playwright/test';

const BASE = process.argv[2] || 'http://127.0.0.1:8799';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const results = [];
const check = (name, ok) => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };

await page.goto(BASE, { waitUntil: 'networkidle' });
const gwTab = page.locator('.hdr-tabs .tab[data-app="gateway"]');
const studioTab = page.locator('.hdr-tabs .tab[data-app="studio"]');

await page.waitForTimeout(1500); // first gatewayStatus tick
check('LED visible', await page.locator('#gateway-led').isVisible());
check('GATEWAY tab not greyed', !(await gwTab.evaluate((n) => n.classList.contains('unavailable'))));

await gwTab.click();
await page.waitForTimeout(800);
check('panel visible', await page.locator('#gateway-app').isVisible());
check('app-shell hidden', !(await page.locator('.app-shell').isVisible()));
check('sub-tabs rendered (5)', (await page.locator('#gateway-app .tabs .tab').count()) === 5);
check('Queue view mounted', (await page.locator('#gateway-app .section-label').first().textContent()) === 'Tracker');

await page.locator('#gateway-app .tabs .tab', { hasText: 'Setup' }).click();
await page.waitForTimeout(600);
check('Setup view mounts', (await page.locator('#gateway-app .section-label').first().textContent()) === 'Connection');

await studioTab.click();
await page.waitForTimeout(300);
check('back to Studio', (await page.locator('.app-shell').isVisible()) && !(await page.locator('#gateway-app').isVisible()));

console.log(results.join('\n'));
if (errors.length) console.log('\nPAGE ERRORS:\n' + errors.join('\n'));
await browser.close();
process.exit(results.some((r) => r.startsWith('FAIL')) || errors.length ? 1 : 0);
