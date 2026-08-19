// t2081 — MOBILE. Geometry-based verification at 360x690 across all 5 themes, per the dispatch's own
// verification-trap warning: a passing Playwright tap proves nothing (scrollIntoViewIfNeeded + programmatic
// scrollTop succeed even where overflow:hidden blocks real finger scrolling). Measures, never taps-to-prove.
// Usage: node verification/t2081_mobile_geometry_probe.mjs before   (or "after")
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const TAG = process.argv[2] || 'before';
const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];
const VIEWPORT = { width: 360, height: 690 };

function reachability(page, sel) {
    return page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return { found: false };
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const inViewport = r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
        const atPoint = document.elementFromPoint(cx, cy);
        const hit = atPoint === el || (atPoint && el.contains(atPoint));
        return {
            found: true,
            rect: { top: Math.round(r.top), left: Math.round(r.left), bottom: Math.round(r.bottom), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) },
            inViewport,
            elementFromPointHit: hit,
            elementFromPointTag: atPoint ? (atPoint.id ? `#${atPoint.id}` : atPoint.className) : null,
        };
    }, sel);
}

function containerOverflow(page, sel) {
    return page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return { found: false };
        const cs = getComputedStyle(el);
        return {
            found: true,
            clientHeight: el.clientHeight, scrollHeight: el.scrollHeight,
            clientWidth: el.clientWidth, scrollWidth: el.scrollWidth,
            overflowY: cs.overflowY, overflowX: cs.overflowX,
            vClipped: el.scrollHeight > el.clientHeight,
            hClipped: el.scrollWidth > el.clientWidth,
        };
    }, sel);
}

const browser = await chromium.launch();
const out = {};
for (const theme of THEMES) {
    const page = await browser.newPage({ viewport: VIEWPORT, hasTouch: true, isMobile: true });
    await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) { } }, theme);
    await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
    await page.waitForTimeout(400);

    const themeOut = {};

    // --- Part 1/2: expand the deck, land on a text-entry tab (editor keys always show), measure the panel ---
    const handle = page.locator('#controller-dock .header-handle');
    await handle.click();
    await page.waitForTimeout(500);
    themeOut.dockBody = await containerOverflow(page, '.dock-body');
    themeOut.deckTabPanel = await containerOverflow(page, '.dock-body .deck-tab-panel');
    themeOut.enterKey = await reachability(page, '.editor-keys-row .toolbar-btn[data-ddcs-role="enter"]');

    // switch to the VARIABLES deck tab (a real element inside the same expanded dock) — measure it too
    try {
        const varsTab = page.locator('.dock-body .deck-tab[data-deck-tab="variables"]');
        if (await varsTab.count()) {
            await varsTab.click();
            await page.waitForTimeout(300);
            themeOut.variablesTab = await reachability(page, '.dock-body .deck-tab[data-deck-tab="variables"]');
        } else {
            themeOut.variablesTab = { found: false, note: 'no [data-deck-tab="variables"] element' };
        }
    } catch (e) { themeOut.variablesTab = { error: e.message }; }

    themeOut.documentScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    themeOut.documentClientWidth = await page.evaluate(() => document.documentElement.clientWidth);

    // --- Part 3: btn-clear position after a RUNTIME theme switch (cycle through all 5, landing back on this one) ---
    // simulates a real runtime switch (not a fresh page load) by toggling data-theme via the app's own mechanism
    await page.evaluate((t) => {
        const order = ['studio', 'normal', 'steampunk', 'futuristic', 'organic'];
        const other = order.find((x) => x !== t) || order[0];
        const tm = window.ddcsStudio && window.ddcsStudio.themeManager;
        try { tm && tm.applyTheme && tm.applyTheme(other); } catch (_) { }
        try { tm && tm.applyTheme && tm.applyTheme(t); } catch (_) { }
    }, theme);
    await page.waitForTimeout(150);   // deliberately SHORT — the bug is a timing race right after the switch
    themeOut.btnClearAfterRuntimeSwitch = await reachability(page, '#btn-clear');
    await page.waitForTimeout(400);   // past the fix's own 250ms re-verify — the settled, self-corrected state
    themeOut.btnClearSettled = await reachability(page, '#btn-clear');

    out[theme] = themeOut;
    await page.close();
}
await browser.close();
fs.writeFileSync(`C:/Users/danse/AppData/Local/Temp/t2081_mobile_${TAG}.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
