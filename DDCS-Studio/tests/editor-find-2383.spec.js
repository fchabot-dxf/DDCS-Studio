import { test, expect } from '@playwright/test';

/**
 * t2383 — THE EDITOR FIND BAR. The editor is a plain TEXTAREA, so the browser's own Ctrl+F can never see its
 * content — this gives the editor its own: Ctrl+F or the strip-chrome chip (#editor-find-btn — owner-ruled
 * placement, AMENDMENT 2: the top-left chip cluster beside the duration chip/pre-flight badge, NOT the
 * insert/undo/redo toolbar amendment 1 first asked for) opens a small bar, live match count (n of m), Enter/
 * Shift+Enter or the ▲/▼ buttons cycle matches, Esc closes, each match scrolls into view and is SELECTED in
 * the real textarea (native setSelectionRange — driven here, not read off a mock). Case-insensitive by
 * default. SEARCH ONLY — no replace UI exists to test, deliberately (a separate feature).
 *
 * Every SEARCHED string here lives inside a `( … )` comment, deliberately: the app's own live G-code
 * reprojection normalizes modal words it recognizes (e.g. a repeated, unchanged F-word collapses to one
 * explicit occurrence) — live-caught while writing this spec (a naive seed with "F600" on two consecutive
 * lines settled to ONE occurrence after reprojection, not two — correct G-code behavior, not a bug in this
 * feature). Comment text is inert to that pipeline, so the match counts below are ground truth.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

const SEED = ['G90', 'G0 X0 Y0', '( GAMMA marker one )', 'G1 X10 F600', '( GAMMA marker two )', 'G0 Z5', '( DELTA )'].join('\n');

const seed = async (page) => {
    await page.evaluate((text) => {
        const ed = document.getElementById('editor');
        ed.value = text;
        ed.dispatchEvent(new Event('input'));
    }, SEED);
    await page.waitForTimeout(300);   // let the live reprojection settle before the test reads/searches the text
};

const barVisible = (page) => page.evaluate(() => !document.getElementById('editor-findbar').classList.contains('hidden'));
const countText = (page) => page.evaluate(() => document.getElementById('editor-find-count').textContent);
const selection = (page) => page.evaluate(() => {
    const ed = document.getElementById('editor');
    return { start: ed.selectionStart, end: ed.selectionEnd, text: ed.value.slice(ed.selectionStart, ed.selectionEnd) };
});

test('Ctrl+F opens the bar; typing a query shows a live match count and selects the first match', async ({ page }) => {
    await boot(page);
    await seed(page);
    await page.locator('#editor').click();
    await page.keyboard.press('Control+f');
    expect(await barVisible(page)).toBe(true);
    await expect(page.locator('#editor-find-input')).toBeFocused();

    await page.locator('#editor-find-input').fill('DELTA');
    expect(await countText(page)).toBe('1/1');
    const sel = await selection(page);
    expect(sel.text.toLowerCase()).toBe('delta');
});

test('a query with multiple hits counts them all, case-insensitively, and Enter/Shift+Enter cycle', async ({ page }) => {
    await boot(page);
    await seed(page);
    await page.locator('#editor').click();
    await page.keyboard.press('Control+f');
    await page.locator('#editor-find-input').fill('gamma');   // lowercase — matches both GAMMA comments case-insensitively
    expect(await countText(page)).toBe('1/2');

    await page.locator('#editor-find-input').press('Enter');
    expect(await countText(page)).toBe('2/2');
    const secondSel = await selection(page);

    await page.locator('#editor-find-input').press('Enter');   // wraps back to 1/2
    expect(await countText(page)).toBe('1/2');

    await page.locator('#editor-find-input').press('Shift+Enter');   // back to 2/2
    expect(await countText(page)).toBe('2/2');
    const wrapped = await selection(page);
    expect(wrapped.start).toBe(secondSel.start);
});

test('the ▲/▼ buttons cycle matches the same way as Enter/Shift+Enter', async ({ page }) => {
    await boot(page);
    await seed(page);
    await page.locator('#editor').click();
    await page.keyboard.press('Control+f');
    await page.locator('#editor-find-input').fill('GAMMA');
    expect(await countText(page)).toBe('1/2');
    await page.locator('#editor-find-next').click();
    expect(await countText(page)).toBe('2/2');
    await page.locator('#editor-find-prev').click();
    expect(await countText(page)).toBe('1/2');
});

test('no match shows 0/0 and flags the input, without throwing', async ({ page }) => {
    await boot(page);
    await seed(page);
    await page.locator('#editor').click();
    await page.keyboard.press('Control+f');
    await page.locator('#editor-find-input').fill('zzz_not_present_zzz');
    expect(await countText(page)).toBe('0/0');
    await expect(page.locator('#editor-find-input')).toHaveClass(/no-match/);
});

test('Esc closes the bar; the strip-chrome chip re-opens it', async ({ page }) => {
    await boot(page);
    await seed(page);
    await page.locator('#editor').click();
    await page.keyboard.press('Control+f');
    expect(await barVisible(page)).toBe(true);
    await page.locator('#editor-find-input').press('Escape');
    expect(await barVisible(page)).toBe(false);

    await page.locator('#editor-find-btn').click();
    expect(await barVisible(page)).toBe(true);
    await page.locator('#editor-find-btn').click();   // toggles closed again
    expect(await barVisible(page)).toBe(false);
});

test('Ctrl+F is scoped to the editor pane — it does not hijack the shortcut while typing in an unrelated field', async ({ page }) => {
    await boot(page);
    await seed(page);
    // an unrelated real input on the page (a wizard-style text field) — focus it, then press Ctrl+F.
    const probe = await page.evaluate(() => {
        const i = document.createElement('input');
        i.type = 'text';
        i.id = '__t2383_probe_input';
        document.body.appendChild(i);
        i.focus();
        return true;
    });
    expect(probe).toBe(true);
    await page.keyboard.press('Control+f');
    expect(await barVisible(page)).toBe(false);   // the find bar must NOT have opened
    await page.evaluate(() => document.getElementById('__t2383_probe_input')?.remove());
});
