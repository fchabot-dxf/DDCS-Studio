// t2087 (P5a) — before/after computed-style gate across all 5 themes for the shared modal base.
// Real-flow triggers where a simple global function exists (wizard, library, workspace manager, help,
// settings, setup sheet); direct-injection reads (add the real class to a throwaway element, measure,
// remove) for state-heavy modals that need an actual unsaved workspace / cloud connection / first-save
// flow to reach naturally (proj-savemodal, cloud-modal, wss-ask, ddcs-busy-overlay, saved-pop) -- each
// clearly labeled in the output as "injected" vs "real-flow".
import { chromium } from '@playwright/test';
const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];
const BASE = 'http://localhost:3211';

const browser = await chromium.launch();
const out = {};
for (const theme of THEMES) {
    out[theme] = {};
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) { } }, theme);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
    await page.waitForTimeout(400);

    // inject the styleOf function into page context first, before any usage
    await page.evaluate(() => {
        window.styleOfInline = (el) => {
            if (!el) return 'MISSING';
            const s = getComputedStyle(el);
            const bg = s.backgroundImage !== 'none' ? `img:${s.backgroundImage.slice(0, 80)}` : s.backgroundColor;
            return { bg, border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`, radius: s.borderRadius, shadow: s.boxShadow, z: s.zIndex };
        };
    });

    // --- REAL-FLOW: wizard overlay (the most common modal) ---
    try {
        await page.locator('.dock-header .header-center .toolbar-dropdown > button.toolbar-btn', { hasText: 'Probe' }).click();
        const entry = page.locator('.dock-header .header-center .toolbar-dropdown-content button[data-optype="corner"]');
        await entry.waitFor({ state: 'visible', timeout: 5000 });
        await entry.click();
        await page.waitForSelector('.wiz-box', { timeout: 5000 });
        await page.waitForTimeout(300);
        out[theme].wizardOverlay = await page.evaluate(() => window.styleOfInline(document.querySelector('.overlay.active')));
        out[theme].wizBox = await page.evaluate(() => window.styleOfInline(document.querySelector('.wiz-box')));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
    } catch (e) { out[theme].wizardOverlay = `ERROR: ${e.message}`; }

    // --- REAL-FLOW: settings ---
    try {
        await page.evaluate(() => window.openSettings && window.openSettings());
        await page.waitForTimeout(400);
        out[theme].settingsOverlay = await page.evaluate(() => window.styleOfInline(document.querySelector('.settings-overlay.active, .overlay.settings-overlay')));
        out[theme].settingsModal = await page.evaluate(() => window.styleOfInline(document.querySelector('.settings-modal')));
        await page.evaluate(() => { const x = document.querySelector('.settings-modal [class*="close"], .settings-head button'); if (x) x.click(); });
        await page.waitForTimeout(200);
    } catch (e) { out[theme].settingsOverlay = `ERROR: ${e.message}`; }

    // --- REAL-FLOW: library ---
    try {
        await page.evaluate(() => window.openLibrary && window.openLibrary());
        await page.waitForTimeout(400);
        out[theme].libraryOverlay = await page.evaluate(() => window.styleOfInline(document.querySelector('.library-overlay')));
        out[theme].libraryModal = await page.evaluate(() => window.styleOfInline(document.querySelector('.library-modal')));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
    } catch (e) { out[theme].libraryOverlay = `ERROR: ${e.message}`; }

    // --- REAL-FLOW: workspace manager ---
    try {
        await page.evaluate(() => window.openWorkspaceManager && window.openWorkspaceManager('open'));
        await page.waitForTimeout(400);
        out[theme].wsmOverlay = await page.evaluate(() => window.styleOfInline(document.querySelector('.wsm-overlay')));
        out[theme].wsmModal = await page.evaluate(() => window.styleOfInline(document.querySelector('.wsm-modal')));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
    } catch (e) { out[theme].wsmOverlay = `ERROR: ${e.message}`; }

    // --- window.openHelp isn't attached at this point (wired only via the quick-menu click handler,
    // not a global seam like openSettings/openLibrary/openWorkspaceManager/openSetupSheet) -- moved to
    // the direct-injection group below; the real click path is covered separately by screenshots. ---

    // --- REAL-FLOW: setup sheet ---
    try {
        await page.evaluate(() => window.openSetupSheet && window.openSetupSheet());
        await page.waitForTimeout(400);
        out[theme].setupSheetOverlay = await page.evaluate(() => window.styleOfInline(document.querySelector('.setup-sheet-overlay')));
        out[theme].setupSheetModal = await page.evaluate(() => window.styleOfInline(document.querySelector('.setup-sheet-modal')));
        out[theme].setupSheetChrome = await page.evaluate(() => window.styleOfInline(document.querySelector('.setup-sheet-chrome')));
        out[theme].setupSheetPage = await page.evaluate(() => window.styleOfInline(document.querySelector('.setup-sheet-page')));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
    } catch (e) { out[theme].setupSheetOverlay = `ERROR: ${e.message}`; }

    // --- DIRECT-INJECTION: state-heavy modals (proj-save, cloud, wss-ask, busy, saved-pop) ---
    out[theme].injected = await page.evaluate(() => {
        const styleOf = window.styleOfInline;
        const mk = (cls, tag = 'div') => { const el = document.createElement(tag); el.className = cls; document.body.appendChild(el); return el; };
        const rm = (el) => el.remove();

        const results = {};

        let e1 = mk('proj-savemodal'); results.projSaveModal = styleOf(e1); rm(e1);
        let e2 = mk('cloud-modal'); results.cloudModal = styleOf(e2); rm(e2);
        let e3 = mk('wss-ask'); results.wssAsk = styleOf(e3); rm(e3);
        let e4 = mk('ddcs-busy-overlay'); results.busyOverlay = styleOf(e4); rm(e4);
        let e5 = mk('saved-pop'); results.savedPop = styleOf(e5); rm(e5);
        let e11 = mk('help-overlay'); results.helpOverlay = styleOf(e11); rm(e11);

        // nested cards need their scrim parent for correct cascade of body-level tokens (all inherit fine
        // via document.body regardless of parent chain here, since --scrim/--modal-* are body-level tokens)
        let e6 = mk('proj-savepanel'); results.projSavePanel = styleOf(e6); rm(e6);
        let e7 = mk('cloud-modal-panel'); results.cloudModalPanel = styleOf(e7); rm(e7);
        let e8 = mk('wss-box'); results.wssBox = styleOf(e8); rm(e8);
        let e9 = mk('ddcs-busy-card'); results.busyCard = styleOf(e9); rm(e9);
        let e10 = mk('saved-pop-card'); results.savedPopCard = styleOf(e10); rm(e10);
        let e12 = mk('help-modal'); results.helpModal = styleOf(e12); rm(e12);

        return results;
    });

    // --- comm-dialog + setup-sheet-page: confirm UNCHANGED (exempt zones) ---
    out[theme].exemptCheck = await page.evaluate(() => {
        const el = document.createElement('div');
        el.className = 'comm-dialog';
        document.body.appendChild(el);
        const s = getComputedStyle(el);
        const r = { commDialogBg: s.backgroundColor };
        el.remove();
        return r;
    });

    await page.close();
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
