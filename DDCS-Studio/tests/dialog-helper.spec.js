import { test, expect } from '@playwright/test';

/** t684 d — the in-app dialog helper behaves (confirm true/false, prompt value/null, Esc cancels) AND the app boots
 *  clean after the confirm/prompt/alert sweep (an `await` left in a non-async fn would be a module syntax error). */
test('the app boots clean after the dialog sweep (no module syntax errors)', async ({ page }) => {
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message)));
    page.on('console', (m) => { if (m.type() === 'error' && /import|SyntaxError|await is only valid/i.test(m.text())) errs.push('CONSOLE: ' + m.text()); });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
    await page.waitForTimeout(400);
    expect(errs, 'no boot/module errors from the sweep').toEqual([]);
});

test('dlgConfirm / dlgPrompt / dlgNotice behave (OK/Cancel/Esc/Enter)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    // CONFIRM → OK resolves true
    await page.evaluate(async () => { const { dlgConfirm } = await import('/ui/dialog.js'); window.__c = dlgConfirm('proceed?'); });
    await page.locator('.app-dialog button').last().click();   // OK is the last (primary) button
    expect(await page.evaluate(() => window.__c)).toBe(true);
    // CONFIRM → Cancel resolves false
    await page.evaluate(async () => { const { dlgConfirm } = await import('/ui/dialog.js'); window.__c2 = dlgConfirm('proceed?'); });
    await page.locator('.app-dialog button').first().click();   // Cancel is the first button
    expect(await page.evaluate(() => window.__c2)).toBe(false);
    // CONFIRM → Esc resolves false
    await page.evaluate(async () => { const { dlgConfirm } = await import('/ui/dialog.js'); window.__c3 = dlgConfirm('proceed?'); });
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => window.__c3)).toBe(false);
    // PROMPT → type + Enter returns the text
    await page.evaluate(async () => { const { dlgPrompt } = await import('/ui/dialog.js'); window.__p = dlgPrompt('name?', 'seed'); });
    await page.locator('.app-dialog input').fill('hello');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.__p)).toBe('hello');
    // PROMPT → Esc returns null
    await page.evaluate(async () => { const { dlgPrompt } = await import('/ui/dialog.js'); window.__p2 = dlgPrompt('name?'); });
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => window.__p2)).toBe(null);
    // NOTICE → dismiss resolves (and closes)
    await page.evaluate(async () => { const { dlgNotice } = await import('/ui/dialog.js'); window.__n = dlgNotice('done'); });
    await page.locator('.app-dialog button').last().click();
    await page.evaluate(() => window.__n);
    expect(await page.locator('.app-dialog').count()).toBe(0);   // no dialog left open
});
