// t2083 (P4d) — computed-style probe covering every consumer touched by the public bevel-ramp tokenization.
// Since this whole turn is studio-scoped (the private ramp only ever existed in studio), only studio should
// show ANY diff; the other 4 themes should be byte-identical (nothing about their own rules changed).
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const TAG = process.argv[2] || 'before';
const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];
const out = {};

function style(el, props) {
    if (!el) return 'MISSING';
    const s = getComputedStyle(el);
    const o = {};
    for (const p of props) {
        if (p === 'background') o[p] = s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 90)}` : s.backgroundColor;
        else o[p] = s[p];
    }
    return o;
}

const browser = await chromium.launch();
for (const theme of THEMES) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) { } }, theme);
    await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
    await page.waitForTimeout(400);

    const themeOut = {};

    // expand the dock, open a dropdown, load a variable list
    await page.locator('#controller-dock .header-handle').click();
    await page.waitForTimeout(400);

    themeOut.controllerDock = await page.evaluate((props) => {
        const el = document.getElementById('controller-dock');
        const s = getComputedStyle(el);
        const o = {};
        for (const p of props) o[p] = p === 'background' ? (s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 90)}` : s.backgroundColor) : s[p];
        return o;
    }, ['background', 'borderTop', 'borderRadius']);

    themeOut.headerHandle = await page.evaluate((props) => {
        const el = document.querySelector('#controller-dock .header-handle');
        const s = getComputedStyle(el);
        const o = {};
        for (const p of props) o[p] = p === 'background' ? (s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 90)}` : s.backgroundColor) : s[p];
        return o;
    }, ['background', 'borderTop', 'borderBottom']);

    themeOut.chevron = await page.evaluate(() => {
        const el = document.querySelector('#controller-dock .chevron');
        return el ? getComputedStyle(el).color : 'MISSING';
    });

    themeOut.topDockHeader = await page.evaluate((props) => {
        const el = document.querySelector('.dock-header.top-dock-header');
        const s = getComputedStyle(el);
        const o = {};
        for (const p of props) o[p] = p === 'background' ? (s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 90)}` : s.backgroundColor) : s[p];
        return o;
    }, ['background', 'borderTop', 'borderBottom']);

    themeOut.dockBody = await page.evaluate((props) => {
        const el = document.querySelector('.dock-body');
        const s = getComputedStyle(el);
        const o = {};
        for (const p of props) o[p] = p === 'background' ? (s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 90)}` : s.backgroundColor) : s[p];
        return o;
    }, ['background', 'borderLeft', 'borderRight', 'borderBottom']);

    // deck section heading
    themeOut.deckHeading = await page.evaluate(() => {
        const el = document.querySelector('.group-header, .section-label');
        return el ? getComputedStyle(el).borderBottom : 'MISSING';
    });

    // viz3d drawer/handle
    themeOut.viz3dDrawer = await page.evaluate(() => {
        const el = document.querySelector('.viz3d-drawer');
        return el ? getComputedStyle(el).borderLeft : 'MISSING';
    });
    themeOut.viz3dHandle = await page.evaluate((props) => {
        const el = document.querySelector('.viz3d-handle');
        if (!el) return 'MISSING';
        const s = getComputedStyle(el);
        const o = {};
        for (const p of props) o[p] = p === 'background' ? (s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 90)}` : s.backgroundColor) : s[p];
        return o;
    }, ['background', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft']);

    // open the Probe dropdown (menu material) to check trigger + tray
    try {
        await page.locator('.dock-header .header-center .toolbar-dropdown > button.toolbar-btn', { hasText: 'Probe' }).click();
        await page.waitForTimeout(300);
        themeOut.dropdownTrigger = await page.evaluate((props) => {
            const el = document.querySelector('.dock-header .header-center .toolbar-dropdown.active > button.toolbar-btn');
            if (!el) return 'MISSING';
            const s = getComputedStyle(el);
            const o = {};
            for (const p of props) o[p] = p === 'background' ? (s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 90)}` : s.backgroundColor) : s[p];
            return o;
        }, ['background', 'borderRadius']);
        themeOut.dropdownTray = await page.evaluate((props) => {
            const el = document.querySelector('.toolbar-dropdown-content');
            if (!el) return 'MISSING';
            const s = getComputedStyle(el);
            const o = {};
            for (const p of props) o[p] = p === 'background' ? (s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 90)}` : s.backgroundColor) : s[p];
            return o;
        }, ['background']);
        themeOut.dropdownItem = await page.evaluate((props) => {
            const el = document.querySelector('.toolbar-dropdown-content button');
            if (!el) return 'MISSING';
            const s = getComputedStyle(el);
            const o = {};
            for (const p of props) o[p] = p === 'background' ? (s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 90)}` : s.backgroundColor) : s[p];
            return o;
        }, ['background']);
        await page.keyboard.press('Escape');
    } catch (e) { themeOut.dropdown = `ERROR: ${e.message}`; }

    // wizard: open corner probe, check wiz-body input's sunken well + viz-container
    try {
        const entry = page.locator('.dock-header .header-center .toolbar-dropdown-content button[data-optype="corner"]');
        await page.locator('.dock-header .header-center .toolbar-dropdown > button.toolbar-btn', { hasText: 'Probe' }).click();
        await entry.waitFor({ state: 'visible', timeout: 5000 });
        await entry.click();
        await page.waitForSelector('.wiz-box', { timeout: 5000 });
        await page.waitForTimeout(400);
        themeOut.wizFieldInput = await page.evaluate((props) => {
            const el = document.querySelector('.wiz-body input, .wiz-body select');
            if (!el) return 'MISSING';
            const s = getComputedStyle(el);
            const o = {};
            for (const p of props) o[p] = p === 'background' ? (s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 90)}` : s.backgroundColor) : s[p];
            return o;
        }, ['background']);
        themeOut.vizContainer = await page.evaluate((props) => {
            const el = document.querySelector('.viz-container');
            if (!el) return 'MISSING';
            const s = getComputedStyle(el);
            const o = {};
            for (const p of props) o[p] = p === 'background' ? (s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 90)}` : s.backgroundColor) : s[p];
            return o;
        }, ['background']);
    } catch (e) { themeOut.wizard = `ERROR: ${e.message}`; }

    out[theme] = themeOut;
    await page.close();
}
await browser.close();
fs.writeFileSync(`C:/Users/danse/AppData/Local/Temp/t2083_ramp_${TAG}.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
