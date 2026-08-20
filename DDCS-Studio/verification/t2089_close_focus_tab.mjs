import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('ddcs_theme', 'normal'); } catch (_) { } });
await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
await page.waitForTimeout(400);

await page.evaluate(() => window.openSettings && window.openSettings());
await page.waitForTimeout(400);
// Focus the close button directly, then simulate the LAST step of a real keyboard tab (dispatch a real
// keydown before .focus() approximates what focus-visible's heuristic looks for better than bare .focus())
const btn = page.locator('.settings-close').first();
await btn.evaluate((el) => el.parentElement.focus ? null : null); // no-op, just ensure element exists
await page.keyboard.press('Tab'); // move focus somewhere via real keyboard first, seeds focus-visible heuristic
// Now Tab repeatedly toward the close button isn't reliable without knowing tab order; instead directly
// focus it via element.focus() called from a REAL keydown-driven context by using Playwright's focus() which
// Chromium treats as script-focus (not always :focus-visible) -- so instead check via matches(':focus-visible')
// after a keyboard Tab press landed on it, using keyboard navigation from the button itself.
await btn.focus();
await page.keyboard.press('Tab');
await page.keyboard.press('Shift+Tab'); // tab away and back via real keyboard events
const matches = await btn.evaluate((el) => el.matches(':focus-visible'));
const outline = await btn.evaluate((el) => { const s = getComputedStyle(el); return s.outlineWidth + ' ' + s.outlineStyle + ' ' + s.outlineColor; });
console.log('settings-close matches(:focus-visible) after keyboard Tab:', matches, 'outline:', outline);
await browser.close();
