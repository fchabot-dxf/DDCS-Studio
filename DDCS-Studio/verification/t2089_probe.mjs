// t2089 (P5b) — before/after computed-style gate: deck-header/section-label merge, proj-savefoot/cloud-
// modal-foot merge (incl. the modal-foot-edge gap fix), gateway-app settings-tabs/wsm-cur-actions merge,
// the real .wizard/.wizard.active deletion, and wiz-close's button conversion.
import { chromium } from '@playwright/test';
const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];
const BASE = 'http://localhost:3211';

const styleOf = (el, props) => {
    if (!el) return 'MISSING';
    const s = getComputedStyle(el);
    const out = {};
    for (const p of props) out[p] = s[p];
    return out;
};

const browser = await chromium.launch();
const out = {};
for (const theme of THEMES) {
    out[theme] = {};
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) { } }, theme);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
    await page.waitForTimeout(400);

    await page.evaluate(() => {
        window.styleOfInline = (el, props) => {
            if (!el) return 'MISSING';
            const s = getComputedStyle(el);
            const out = {};
            for (const p of props) out[p] = s[p];
            return out;
        };
    });

    // deck-header / section-label -- find any real instance in the dock (deck-header) and a wizard body (section-label)
    try {
        await page.locator('#controller-dock .header-handle').click();
        await page.waitForTimeout(300);
        out[theme].deckHeader = await page.evaluate(() => window.styleOfInline(document.querySelector('.deck-header'), ['padding', 'fontSize', 'letterSpacing', 'color', 'backgroundColor', 'borderTopWidth', 'marginTop']));
    } catch (e) { out[theme].deckHeader = `ERROR: ${e.message}`; }

    try {
        await page.locator('.dock-header .header-center .toolbar-dropdown > button.toolbar-btn', { hasText: 'Probe' }).click();
        const entry = page.locator('.dock-header .header-center .toolbar-dropdown-content button[data-optype="corner"]');
        await entry.waitFor({ state: 'visible', timeout: 5000 });
        await entry.click();
        await page.waitForSelector('.wiz-box', { timeout: 5000 });
        await page.waitForTimeout(300);
        out[theme].sectionLabel = await page.evaluate(() => window.styleOfInline(document.querySelector('.section-label'), ['padding', 'fontSize', 'letterSpacing', 'color', 'backgroundColor', 'borderTopWidth', 'marginTop']));
        out[theme].wizCloseTag = await page.evaluate(() => { const el = document.querySelector('.wiz-close'); return el ? el.tagName : 'MISSING'; });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
    } catch (e) { out[theme].sectionLabel = `ERROR: ${e.message}`; }

    // proj-savefoot / cloud-modal-foot -- direct injection (state-heavy triggers, same approach as t2087)
    out[theme].feet = await page.evaluate(() => {
        const styleOf = window.styleOfInline;
        const mk = (cls) => { const el = document.createElement('div'); el.className = cls; document.body.appendChild(el); return el; };
        const rm = (el) => el.remove();
        const props = ['display', 'alignItems', 'gap', 'padding', 'borderTopWidth', 'borderTopColor'];
        let e1 = mk('proj-savefoot'); const projSavefoot = styleOf(e1, props); rm(e1);
        let e2 = mk('cloud-modal-foot'); const cloudModalFoot = styleOf(e2, props); rm(e2);
        return { projSavefoot, cloudModalFoot };
    });

    // gateway-app settings-tabs / wsm-cur-actions
    try {
        await page.evaluate(() => window.showApp && window.showApp('gateway'));
        await page.waitForTimeout(400);
        out[theme].gatewaySettingsTabs = await page.evaluate(() => window.styleOfInline(document.querySelector('.gateway-app .settings-tabs'), ['display', 'gap', 'flexWrap']));
    } catch (e) { out[theme].gatewaySettingsTabs = `ERROR: ${e.message}`; }

    out[theme].wsmCurActions = await page.evaluate(() => {
        const el = document.createElement('div'); el.className = 'wsm-cur-actions'; document.body.appendChild(el);
        const r = window.styleOfInline(el, ['display', 'gap', 'flexWrap']);
        el.remove();
        return r;
    });

    // .wizard class truly dead -- re-confirm zero elements match it anywhere on the page
    out[theme].wizardClassCount = await page.evaluate(() => document.querySelectorAll('.wizard').length);

    await page.close();
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
