import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('ddcs_theme', 'normal'); } catch (_) { } });
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);

async function openWizard() {
    await page.locator('.dock-header .header-center .toolbar-dropdown > button.toolbar-btn', { hasText: 'Probe' }).click();
    const entry = page.locator('.dock-header .header-center .toolbar-dropdown-content button[data-optype="corner"]');
    await entry.waitFor({ state: 'visible', timeout: 5000 });
    await entry.click();
    await page.waitForSelector('.wiz-box', { timeout: 5000 });
    await page.waitForTimeout(300);
}

// 1) element info: is it a real focusable button now?
await openWizard();
const info = await page.evaluate(() => {
    const el = document.querySelector('.wiz-close');
    return { tag: el.tagName, tabIndex: el.tabIndex, type: el.type };
});
console.log('wiz-close element:', JSON.stringify(info));

// 2) click still closes it
await page.locator('.wiz-close').click();
await page.waitForTimeout(300);
const closedAfterClick = await page.evaluate(() => !document.querySelector('.overlay.active'));
console.log('closed after click:', closedAfterClick);

// 3) keyboard focus + Enter closes it
await openWizard();
await page.locator('.wiz-close').focus();
const focusVisible = await page.evaluate(() => document.querySelector('.wiz-close').matches(':focus-visible'));
const outline = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.wiz-close')); return s.outlineWidth + ' ' + s.outlineStyle + ' ' + s.outlineColor; });
console.log('matches(:focus-visible) after .focus():', focusVisible, 'outline:', outline);
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
const closedAfterEnter = await page.evaluate(() => !document.querySelector('.overlay.active'));
console.log('closed after Enter key:', closedAfterEnter);

await browser.close();
