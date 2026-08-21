import { test, expect } from '@playwright/test';

/**
 * t2125 (amendment 5, folded in as a cheap unrelated fix) — headerPost.js's Copy-program button ALREADY
 * toggled a `.copied` class for 600ms on click, but the only CSS rule for it was `.editor-copy-float.copied`
 * (styles.css) — a class from a former FLOATING variant of the button that the toolbar-integrated button
 * (#editor-copy-btn.toolbar-btn) never carried, so the selector never matched and nothing visible happened.
 * Fixed with an id-scoped rule. This spec drives the real click and reads the real computed color.
 */
test.use({ viewport: { width: 1280, height: 900 } });

test('clicking the editor Copy button visibly flashes green, then reverts', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('http://localhost:3211', { timeout: 30000 });
    await page.waitForFunction(() => window.ddcsStudio && document.getElementById('editor-copy-btn'), null, { timeout: 30000 });
    await page.waitForSelector('#ddcs-boot-loader', { state: 'hidden', timeout: 30000 }).catch(() => {});   // boot overlay can still cover the button briefly

    const before = await page.evaluate(() => getComputedStyle(document.getElementById('editor-copy-btn')).color);

    // a REAL Playwright click (not el.click()) — document.execCommand('copy') needs trusted user activation,
    // and a programmatic .click() doesn't carry it, which would fail before ever reaching the classList line.
    await page.click('#editor-copy-btn');
    const flashed = await page.evaluate(() => getComputedStyle(document.getElementById('editor-copy-btn')).color);
    expect(flashed, 'the button must visibly change color on click (was previously a dead no-op)').not.toBe(before);
    expect(flashed).toBe('rgb(34, 197, 94)');   // #22c55e

    await page.waitForTimeout(700);   // headerPost.js removes .copied after 600ms
    const after = await page.evaluate(() => getComputedStyle(document.getElementById('editor-copy-btn')).color);
    expect(after, 'the flash must revert').toBe(before);
});
