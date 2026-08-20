import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('ddcs_theme', 'normal'); } catch (_) { } });
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);

async function checkFocus(triggerFn, selector, label) {
    await page.evaluate(triggerFn);
    await page.waitForTimeout(300);
    const el = page.locator(selector).first();
    if (!(await el.count())) { console.log(`${label}: NOT FOUND`); return; }
    await el.focus();
    const outline = await el.evaluate((e) => { const s = getComputedStyle(e); return { tag: e.tagName, outline: s.outlineWidth + ' ' + s.outlineStyle + ' ' + s.outlineColor }; });
    console.log(`${label}:`, JSON.stringify(outline));
}

await checkFocus(() => window.openSettings && window.openSettings(), '.settings-close', 'settings-close');
await checkFocus(() => window.openLibrary && window.openLibrary(), '.library-x', 'library-x');
await checkFocus(() => window.openWorkspaceManager && window.openWorkspaceManager('open'), '.wsm-x', 'wsm-x');
await checkFocus(() => window.openSetupSheet && window.openSetupSheet(), '.setup-sheet-btn-close', 'setup-sheet-btn-close');
// help: inject directly since openHelp isn't globally attached
await page.evaluate(() => {
    const ov = document.createElement('div'); ov.className = 'help-overlay';
    ov.innerHTML = '<div class="help-modal"><button type="button" class="help-close">x</button></div>';
    document.body.appendChild(ov);
});
await checkFocus(() => {}, '.help-close', 'help-close');
// wiz-close via the real wizard open flow
await page.locator('.dock-header .header-center .toolbar-dropdown > button.toolbar-btn', { hasText: 'Probe' }).click();
const entry = page.locator('.dock-header .header-center .toolbar-dropdown-content button[data-optype="corner"]');
await entry.waitFor({ state: 'visible', timeout: 5000 });
await entry.click();
await page.waitForSelector('.wiz-box', { timeout: 5000 });
const wizCloseInfo = await page.evaluate(() => {
    const el = document.querySelector('.wiz-close');
    return el ? { tag: el.tagName, tabIndex: el.tabIndex, hasTabindexAttr: el.hasAttribute('tabindex') } : null;
});
console.log('wiz-close element info:', JSON.stringify(wizCloseInfo));

await browser.close();
