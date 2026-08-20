import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('ddcs_theme', 'normal'); } catch (_) { } });
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);
await page.evaluate(() => window.openSettings && window.openSettings());
await page.waitForTimeout(400);
const btn = page.locator('.settings-close').first();
await btn.focus();
await page.keyboard.press('Tab');
await page.keyboard.press('Shift+Tab');
const info = await page.evaluate(() => {
    const el = document.querySelector('.settings-close');
    const s = getComputedStyle(el);
    const bodyAccent = getComputedStyle(document.body).getPropertyValue('--accent');
    return {
        matchesFocusVisible: el.matches(':focus-visible'),
        outline: s.outlineWidth + ' ' + s.outlineStyle + ' ' + s.outlineColor,
        bodyAccent,
        elColor: s.color,
        activeElement: document.activeElement === el,
    };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
