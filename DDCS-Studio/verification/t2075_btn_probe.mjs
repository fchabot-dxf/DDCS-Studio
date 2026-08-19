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
    const info = await page.evaluate(() => {
        const val = (sel, prop, state) => {
            const el = document.querySelector(sel);
            if (!el) return `MISSING:${sel}`;
            if (state === 'hover') el.matches(':hover');   // no-op, real hover needs pointer; use class probe below instead
            const s = getComputedStyle(el);
            const v = s[prop];
            return v;
        };
        const bgOf = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return `MISSING:${sel}`;
            const s = getComputedStyle(el);
            return s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 70)}` : s.backgroundColor;
        };
        // pick a GENERIC toolbar-btn: enabled, visible, and carrying no semantic-color class
        // of its own (.hdr-clear is a fixed danger-red icon button, not general material —
        // confirmed via styles.css:4795; .settings-io only sets cursor, so it's plain material).
        const SEMANTIC_CLASS = /hdr-clear|editor-copy-float|editor-file-float|primary|success|danger|warn/;
        const btn = [...document.querySelectorAll('.toolbar-btn')].find((b) =>
            b.offsetParent !== null && !b.disabled && !SEMANTIC_CLASS.test(b.className));
        return {
            selector: btn ? (btn.className || btn.tagName) : 'NONE FOUND',
            bg: btn ? (getComputedStyle(btn).backgroundImage !== 'none' ? `img:${getComputedStyle(btn).backgroundImage.slice(0, 70)}` : getComputedStyle(btn).backgroundColor) : null,
            color: btn ? getComputedStyle(btn).color : null,
            borderColor: btn ? getComputedStyle(btn).borderColor : null,
            borderWidth: btn ? getComputedStyle(btn).borderWidth : null,
            borderRadius: btn ? getComputedStyle(btn).borderRadius : null,
            textShadow: btn ? getComputedStyle(btn).textShadow : null,
            boxShadow: btn ? getComputedStyle(btn).boxShadow : null,
        };
    });
    // hover state via a real pointer move (same generic-button filter as the resting probe)
    const btnLocator = page.locator('.toolbar-btn:not([disabled]):not(.hdr-clear):not(.editor-copy-float):not(.editor-file-float)').first();
    let hoverInfo = null;
    try {
        await btnLocator.hover({ timeout: 3000 });
        await page.waitForTimeout(150);
        hoverInfo = await page.evaluate(() => {
            const btn = document.querySelector('.toolbar-btn:hover');
            if (!btn) return 'NOT HOVERED';
            const s = getComputedStyle(btn);
            return {
                bg: s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 70)}` : s.backgroundColor,
                color: s.color, borderColor: s.borderColor, boxShadow: s.boxShadow, filter: s.filter,
            };
        });
    } catch (e) { hoverInfo = `ERROR: ${e.message}`; }
    out[theme] = { resting: info, hover: hoverInfo };
    await page.close();
}
await browser.close();
fs.writeFileSync(`C:/Users/danse/AppData/Local/Temp/t2075_btn_${TAG}.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
