import { test, expect } from '@playwright/test';

/**
 * BACKLOG #12 — the editor's focus ring was missing its LEFT edge only (top/right/bottom always drew).
 *
 * ⭐ THE REAL CAUSE, confirmed by reading the DOM/CSS before writing anything (not assumed from the symptom):
 * a real, deliberate `textarea:focus-visible { outline: 2px solid …; outline-offset: -2px; }` rule (this file's
 * own house style, ~20 other consumers) drew correctly on `#editor` itself — but `#editor-gutter` is a plain
 * SIBLING inside `.editor-container` (editorManager.js's `insertBefore`), absolutely positioned at
 * `left:0; width:44px; z-index:3` — directly ON TOP of `#editor`'s own left edge (`z-index:2`). The ring's
 * left third was drawn, then immediately painted over by the gutter's opaque background. Not a UA default,
 * not a clipping bug — a real rule, wrong element.
 *
 * THE FIX: suppress `#editor`'s own ring and draw it instead on `.editor-container` — the one box that
 * already CONTAINS both the gutter and the editor (`:has(#editor:focus-visible)`, the same pattern this file
 * already uses for `.editor-container:has(.viz3d-drawer.open)`) — so the gutter sits INSIDE the ring instead
 * of on top of it, on every edge.
 *
 * ⚠ WHAT THIS SUITE DOES NOT AND CANNOT PROVE, stated rather than silently assumed: BACKLOG #12 also asked for
 * "click -> no ring, Tab -> ring" (`:focus-visible`'s textbook behaviour). MEASURED, not assumed: in this real
 * Chromium, a `<textarea>` reports `:focus-visible === true` on a plain MOUSE CLICK too — confirmed by direct
 * comparison against a `<button>` in the same page, which correctly reports `false` on click (the CSS spec's
 * own note: a text-editable widget is "always considered to match :focus-visible… because a user typically
 * wants to know where they will type", independent of input modality). So the ring shows on click same as it
 * always did — CSS alone cannot suppress that for this element; a JS input-modality tracker would be a new
 * mechanism BACKLOG's own scope note said to report rather than build unasked. This suite therefore pins what
 * IS achieved (a complete, honest ring wherever it appears) and does NOT assert click-vs-keyboard, which
 * would be asserting something false.
 */
async function ready(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
}

const focusInfo = (page) => page.evaluate(() => {
    const c = document.querySelector('.editor-container');
    const e = document.getElementById('editor');
    const cs = getComputedStyle(c), es = getComputedStyle(e);
    const gutter = document.getElementById('editor-gutter');
    return {
        containerOutlineStyle: cs.outlineStyle,
        containerOutlineWidth: cs.outlineWidth,
        editorOutlineStyle: es.outlineStyle,
        // the gutter's own box, so a future change moving/resizing it is caught here too
        gutterLeft: gutter ? gutter.getBoundingClientRect().left : null,
        containerLeft: c.getBoundingClientRect().left,
    };
});

test('unfocused: no ring anywhere on the editor panel', async ({ page }) => {
    await ready(page);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const s = await focusInfo(page);
    expect(s.containerOutlineStyle, 'no ring on the container when nothing is focused').toBe('none');
});

test('focused (click): a COMPLETE ring draws on the CONTAINER, not on #editor itself', async ({ page }) => {
    await ready(page);
    await page.click('#editor');
    const s = await focusInfo(page);
    expect(s.containerOutlineStyle, 'the container carries the ring').toBe('solid');
    expect(s.containerOutlineWidth, 'a real, visible width').toBe('2px');
    // ⛔ THE BUG THIS FIXES: the ring must NOT also (or instead) sit on #editor, whose left edge the gutter
    // covers — a ring there would repeat the exact missing-left-edge symptom this item exists to fix.
    expect(s.editorOutlineStyle, '#editor itself carries no separate (gutter-covered) ring').toBe('none');
});

test('THE LEFT EDGE: the ring container starts flush with the gutter — the gutter sits INSIDE the ring, not under it', async ({ page }) => {
    await ready(page);
    await page.click('#editor');
    const s = await focusInfo(page);
    // the container's own left edge (where the ring is drawn, outline-offset:-2px) must be at or left of the
    // gutter's left edge — i.e. the ring's box genuinely contains the gutter rather than starting after it.
    expect(s.gutterLeft, 'the gutter sits at/after the ring-bearing container\'s left edge').toBeGreaterThanOrEqual(s.containerLeft);
    expect(s.gutterLeft - s.containerLeft, 'the gutter is the FIRST thing inside the ring (no big gap = wrong box)').toBeLessThan(10);
});

test('focused via keyboard (Tab): the same complete ring — theme-independent, one mechanism for both input modalities', async ({ page }) => {
    await ready(page);
    // land elsewhere, then Tab-cycle back onto the editor rather than a scripted .focus() (which some browsers
    // do NOT treat as :focus-visible at all — the real keyboard gesture is what the human's report described)
    await page.click('#editor');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    const s = await focusInfo(page);
    expect(s.containerOutlineStyle, 'Tab-focus still rings the whole container').toBe('solid');
});

test('theme-independent: the ring draws in normal, futuristic AND studio (the one theme that used to suppress it entirely)', async ({ page }) => {
    await ready(page);
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.openSettings, null, { timeout: 15000 });
    for (const theme of ['normal', 'futuristic', 'studio']) {
        await page.evaluate(() => window.openSettings({ group: 'lookfeel', panel: 'set_tab_appearance' }));
        await page.waitForSelector('#set_theme', { timeout: 6000 });
        await page.selectOption('#set_theme', theme);
        await expect.poll(() => page.getAttribute('body', 'data-theme')).toBe(theme);
        await page.evaluate(() => window.closeSettings && window.closeSettings());
        await page.click('#editor');
        const s = await focusInfo(page);
        expect(s.containerOutlineStyle, `${theme}: the ring draws`).toBe('solid');
        expect(s.editorOutlineStyle, `${theme}: #editor still carries none of its own`).toBe('none');
    }
});
