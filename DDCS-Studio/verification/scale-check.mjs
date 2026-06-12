import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 850 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:8799', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const out = [];
await page.locator('#scaleBtn').click();
await page.waitForTimeout(200);
out.push('popover opens: ' + (await page.locator('#scale-pop').isVisible()));
const zoomBefore = await page.evaluate(() => document.body.style.zoom);
// drag: set value + fire input (no change yet) — zoom must NOT move
await page.locator('#scaleSlider').evaluate((s) => { s.value = '180'; s.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(150);
out.push('readout live: ' + (await page.locator('#scaleVal').textContent()));
out.push('zoom unchanged during drag: ' + ((await page.evaluate(() => document.body.style.zoom)) === zoomBefore));
// release: fire change — zoom applies
await page.locator('#scaleSlider').evaluate((s) => s.dispatchEvent(new Event('change', { bubbles: true })));
await page.waitForTimeout(150);
out.push('zoom applied on release: ' + (await page.evaluate(() => document.body.style.zoom)));
out.push('data-scale bucket: ' + (await page.evaluate(() => document.body.dataset.scale)));
out.push('header label: ' + (await page.locator('#scaleBtn .op-label').textContent()));
out.push('persisted: ' + (await page.evaluate(() => localStorage.getItem('ddcs_scale_preference'))));
// AUTO restores
await page.locator('#scaleAutoBtn').click();
await page.waitForTimeout(150);
out.push('AUTO label: ' + (await page.locator('#scaleBtn .op-label').textContent()));
out.push('AUTO data-scale: ' + (await page.evaluate(() => document.body.dataset.scale)));
// outside click closes
await page.locator('#editor').click({ force: true });
await page.waitForTimeout(150);
out.push('outside click closes: ' + ((await page.locator('#scale-pop').count()) === 0));
await page.locator('#scaleBtn').click(); await page.waitForTimeout(150);
await page.locator('.app-header').screenshot({ path: 'verification/scale-pop.png' });
console.log(out.join('\n'));
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
await browser.close();
