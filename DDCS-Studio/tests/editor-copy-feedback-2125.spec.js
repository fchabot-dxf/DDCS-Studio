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
    // t2129 (review) — a click + a SEPARATE evaluate() round trip to sample the colour ONCE races
    // headerPost.js's own 600ms class removal: under contention (workers:6) the round trip can occasionally
    // take long enough that the class is already gone by the time the single read happens, reading a correct
    // fix as a failure. waitForFunction POLLS instead of sampling once, so it can't lose that race.
    await page.waitForFunction(() => getComputedStyle(document.getElementById('editor-copy-btn')).color === 'rgb(34, 197, 94)', null, { timeout: 500 });

    await page.waitForFunction(
        (expected) => getComputedStyle(document.getElementById('editor-copy-btn')).color === expected,
        before,
        { timeout: 2000 },   // headerPost.js removes .copied after 600ms -- polled, not slept-then-sampled
    );
});
