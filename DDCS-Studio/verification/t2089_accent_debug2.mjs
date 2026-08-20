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
    // find every rule that matches this element and mentions outline
    const sheets = [...document.styleSheets];
    const matching = [];
    for (const sheet of sheets) {
        let rules;
        try { rules = [...sheet.cssRules]; } catch (e) { continue; }
        for (const rule of rules) {
            if (!rule.selectorText) continue;
            try {
                if (el.matches(rule.selectorText.replace(/:focus-visible/g, ''))) {
                    if (rule.style.outline || rule.style.outlineColor || rule.style.outlineStyle) {
                        matching.push({ selector: rule.selectorText, outline: rule.style.outline, outlineColor: rule.style.outlineColor });
                    }
                }
            } catch (e) { /* invalid selector for matches(), skip */ }
        }
    }
    return {
        outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle, outlineColor: s.outlineColor, outlineOffset: s.outlineOffset,
        matchingRules: matching,
    };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
