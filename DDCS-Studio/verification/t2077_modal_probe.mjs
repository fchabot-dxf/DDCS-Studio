import { chromium } from '@playwright/test';
import fs from 'node:fs';

const TAG = process.argv[2] || 'before';
const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];
const out = {};

const browser = await chromium.launch();
for (const theme of THEMES) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) { } }, theme);
    await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
    await page.waitForTimeout(300);

    await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Probe' }).click();
    const entry = page.locator('.dock-header .toolbar-dropdown-content button[data-optype="corner"]');
    await entry.waitFor({ state: 'visible', timeout: 5000 });
    await entry.click();
    await page.waitForSelector('.wiz-box', { timeout: 5000 });
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
        const bgOf = (el) => {
            const s = getComputedStyle(el);
            return s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 90)}` : s.backgroundColor;
        };
        const box = document.querySelector('.wiz-box');
        const head = document.querySelector('.wiz-head');
        const foot = document.querySelector('.wiz-foot');
        const close = document.querySelector('.wiz-head .wiz-close');
        const overlay = box ? box.closest('.overlay') : null;
        return {
            box: box ? {
                bg: bgOf(box), borderColor: getComputedStyle(box).borderColor, borderWidth: getComputedStyle(box).borderWidth,
                borderRadius: getComputedStyle(box).borderRadius, boxShadow: getComputedStyle(box).boxShadow,
            } : null,
            head: head ? { bg: bgOf(head), color: getComputedStyle(head).color, borderRadius: getComputedStyle(head).borderRadius } : null,
            foot: foot ? { borderTop: getComputedStyle(foot).borderTop } : null,
            close: close ? {
                bg: bgOf(close), borderColor: getComputedStyle(close).borderColor, borderWidth: getComputedStyle(close).borderWidth,
                borderRadius: getComputedStyle(close).borderRadius, boxShadow: getComputedStyle(close).boxShadow,
                textShadow: getComputedStyle(close).textShadow,
            } : null,
            overlay: overlay ? { bg: getComputedStyle(overlay).backgroundColor } : null,
        };
    });
    out[theme] = info;
    await page.close();
}
await browser.close();
fs.writeFileSync(`C:/Users/danse/AppData/Local/Temp/t2077_modal_${TAG}.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
