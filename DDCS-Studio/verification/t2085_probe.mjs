// t2085 (P4e) — before/after computed-style gate across all 5 themes for: MENU AND POPOVER, FORM FIELD,
// TAB STATE, MICRO-TYPOGRAPHY. Usage: node verification/t2085_probe.mjs > out.json
import { chromium } from '@playwright/test';
const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];
const BASE = 'http://localhost:3211';

const cs = (el, prop) => el ? getComputedStyle(el)[prop] : 'MISSING';
const bg = (el) => {
    if (!el) return 'MISSING';
    const s = getComputedStyle(el);
    return s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 120)}` : s.backgroundColor;
};

const browser = await chromium.launch();
const out = {};
for (const theme of THEMES) {
    out[theme] = {};

    // --- Page 1: main view -- tabs, tray dropdown, quick-menu popover ---
    {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) { } }, theme);
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
        await page.waitForTimeout(400);

        out[theme].tabs = await page.evaluate(() => {
            const active = document.querySelector('.app-header .tab.active');
            const inactive = [...document.querySelectorAll('.app-header .tab')].find(t => !t.classList.contains('active'));
            const s = (el) => el ? getComputedStyle(el) : null;
            const a = s(active), i = s(inactive);
            return {
                activeInk: a ? a.color : 'MISSING',
                activeShadow: a ? a.boxShadow : 'MISSING',
                inactiveInk: i ? i.color : 'MISSING',
            };
        });

        // toolbar dropdown tray (Probe)
        await page.locator('.dock-header .header-center .toolbar-dropdown > button.toolbar-btn', { hasText: 'Probe' }).click();
        await page.waitForTimeout(300);
        out[theme].menu = await page.evaluate(() => {
            const tray = document.querySelector('.toolbar-dropdown.active .toolbar-dropdown-content');
            const item = document.querySelector('.toolbar-dropdown.active .toolbar-dropdown-content button');
            const trigger = document.querySelector('.toolbar-dropdown.active > button.toolbar-btn');
            const s = (el) => el ? getComputedStyle(el) : null;
            const trayS = s(tray), itemS = s(item), trigS = s(trigger);
            const bgOf = (cs) => cs ? (cs.backgroundImage !== 'none' ? `img:${cs.backgroundImage.slice(0, 100)}` : cs.backgroundColor) : 'MISSING';
            return {
                trayFace: bgOf(trayS),
                trayRadius: trayS ? trayS.borderRadius : 'MISSING',
                trayShadow: trayS ? trayS.boxShadow : 'MISSING',
                itemInk: itemS ? itemS.color : 'MISSING',
                triggerFace: bgOf(trigS),
                triggerInk: trigS ? trigS.color : 'MISSING',
            };
        });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);

        // header quick-menu popover
        await page.locator('#hdrPostBtn').click();
        await page.waitForTimeout(300);
        out[theme].popover = await page.evaluate(() => {
            const menu = document.getElementById('hdrPostMenu');
            const sep = document.querySelector('.hdr-quick-sep');
            const s = (el) => el ? getComputedStyle(el) : null;
            const mS = s(menu);
            return {
                glass: mS ? (mS.backgroundImage !== 'none' ? `img:${mS.backgroundImage.slice(0, 100)}` : mS.backgroundColor) : 'MISSING',
                blur: mS ? mS.backdropFilter : 'MISSING',
                edge: mS ? mS.borderColor : 'MISSING',
                sepColor: sep ? getComputedStyle(sep).backgroundColor : 'MISSING',
            };
        });

        // button label typography (a toolbar button with a .btn-tx span)
        out[theme].btnLabel = await page.evaluate(() => {
            const tx = document.querySelector('.toolbar-btn .btn-tx');
            const s = tx ? getComputedStyle(tx) : null;
            return { transform: s ? s.textTransform : 'MISSING', tracking: s ? s.letterSpacing : 'MISSING' };
        });

        await page.close();
    }

    // --- Page 2: settings tab (for settings-main-tab.active glow) ---
    {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) { } }, theme);
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
        await page.evaluate(() => window.showApp && window.showApp('gateway'));
        await page.waitForTimeout(500);
        out[theme].settingsTab = await page.evaluate(() => {
            const active = document.querySelector('.settings-tabs .settings-main-tab.active');
            const s = active ? getComputedStyle(active) : null;
            return { shadow: s ? s.boxShadow : 'MISSING' };
        });
        await page.close();
    }

    // --- Page 3: wizard field (form-field group) + label/hint typography ---
    {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) { } }, theme);
        await page.goto(BASE, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
        await page.waitForTimeout(400);
        await page.locator('.dock-header .header-center .toolbar-dropdown > button.toolbar-btn', { hasText: 'Probe' }).click();
        const entry = page.locator('.dock-header .header-center .toolbar-dropdown-content button[data-optype="corner"]');
        await entry.waitFor({ state: 'visible', timeout: 5000 });
        await entry.click();
        await page.waitForSelector('.wiz-box', { timeout: 5000 });
        await page.waitForTimeout(400);
        out[theme].field = await page.evaluate(() => {
            const input = document.querySelector('.wiz-body input, .wiz-body select');
            const label = document.querySelector('.wiz-box .label');
            const hint = document.querySelector('.wiz-box .hint');
            const bgOf = (el) => {
                if (!el) return 'MISSING';
                const s = getComputedStyle(el);
                return s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 100)}` : s.backgroundColor;
            };
            const styleOf = (el) => {
                if (!el) return 'MISSING';
                const s = getComputedStyle(el);
                return { border: s.borderWidth + ' ' + s.borderStyle + ' ' + s.borderColor, radius: s.borderRadius, ink: s.color, face: bgOf(el) };
            };
            const labelS = label ? getComputedStyle(label) : null;
            const hintS = hint ? getComputedStyle(hint) : null;
            return {
                input: styleOf(input),
                label: labelS ? { size: labelS.fontSize, weight: labelS.fontWeight, tracking: labelS.letterSpacing, transform: labelS.textTransform, ink: labelS.color } : 'MISSING',
                hint: hintS ? { size: hintS.fontSize, style: hintS.fontStyle, ink: hintS.color } : 'MISSING',
            };
        });
        // focus + placeholder -- :visible, since .wiz-body holds every op's fields at once, only one op's tab shown
        const visibleInput = page.locator('.wiz-body input:visible').first();
        if (await visibleInput.count()) {
            await visibleInput.click();
            await page.waitForTimeout(150);
            out[theme].fieldFocus = await page.evaluate(() => {
                const el = document.activeElement;
                if (!el || !el.matches('.wiz-body input')) return `NOT-FOCUSED (activeElement=${el ? el.tagName : 'none'})`;
                const s = getComputedStyle(el);
                return { outline: s.outlineWidth + ' ' + s.outlineStyle + ' ' + s.outlineColor };
            });
        } else {
            out[theme].fieldFocus = 'NO-VISIBLE-INPUT';
        }
        await page.close();
    }
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
