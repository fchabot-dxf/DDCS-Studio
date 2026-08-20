import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('ddcs_theme', 'normal'); } catch (_) { } });
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);

async function findMatchingOutlineRules(selector) {
    return page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return { found: false };
        const sheets = [...document.styleSheets];
        const matching = [];
        for (const sheet of sheets) {
            let rules;
            try { rules = [...sheet.cssRules]; } catch (e) { continue; }
            for (const rule of rules) {
                if (!rule.selectorText) continue;
                try {
                    if (el.matches(rule.selectorText.replace(/:focus-visible/g, '').replace(/:hover/g, '').replace(/:active/g, ''))) {
                        if (rule.style.outline || rule.style.outlineColor || rule.style.outlineStyle) {
                            matching.push({ selector: rule.selectorText, outline: rule.style.outline || (rule.style.outlineStyle + ' ' + rule.style.outlineColor) });
                        }
                    }
                } catch (e) { /* skip */ }
            }
        }
        return { found: true, matching };
    }, selector);
}

// library
await page.evaluate(() => window.openLibrary && window.openLibrary());
await page.waitForTimeout(300);
console.log('library-x:', JSON.stringify(await findMatchingOutlineRules('.library-x')));
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// workspace manager
await page.evaluate(() => window.openWorkspaceManager && window.openWorkspaceManager('open'));
await page.waitForTimeout(300);
console.log('wsm-x:', JSON.stringify(await findMatchingOutlineRules('.wsm-x')));
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// setup sheet
await page.evaluate(() => window.openSetupSheet && window.openSetupSheet());
await page.waitForTimeout(300);
console.log('setup-sheet-btn-close:', JSON.stringify(await findMatchingOutlineRules('.setup-sheet-btn-close')));
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// help (inject directly since openHelp isn't globally attached)
await page.evaluate(() => {
    const ov = document.createElement('div'); ov.className = 'help-overlay';
    ov.innerHTML = '<div class="help-modal"><button type="button" class="help-close">x</button></div>';
    document.body.appendChild(ov);
});
console.log('help-close:', JSON.stringify(await findMatchingOutlineRules('.help-close')));

// wiz-close
await page.locator('.dock-header .header-center .toolbar-dropdown > button.toolbar-btn', { hasText: 'Probe' }).click();
const entry = page.locator('.dock-header .header-center .toolbar-dropdown-content button[data-optype="corner"]');
await entry.waitFor({ state: 'visible', timeout: 5000 });
await entry.click();
await page.waitForSelector('.wiz-box', { timeout: 5000 });
console.log('wiz-close:', JSON.stringify(await findMatchingOutlineRules('.wiz-close')));

await browser.close();
