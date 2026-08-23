import { test, expect } from '@playwright/test';

/**
 * t1323 (1) — THE TIME CHIP AND LINE 1 DO NOT SHARE PIXELS.
 *
 * USER SCREENSHOT: the floating estimate pill sat ON the first line of code. Two controls owning the same pixels is
 * the defect; where the pill goes is the design call. Originally it stayed centred over the code, with the CODE
 * given a hand-synced inset (`--editor-chip-inset`) sized to the chip.
 *
 * t2155 (the editor-strip/editor-code refactor) — the MECHANISM changed: the chip now lives in `.editor-strip`, an
 * auto-height box in normal flow ABOVE `.editor-code` (no inset variable at all — the code area simply starts
 * where the strip ends, whatever height the strip's tallest child needs). On DESKTOP this still reads the same as
 * before (chip above the code). On PHONE, BACKLOG #13 (the same turn) reorders the WHOLE STRIP — chip included —
 * to the BOTTOM, so the code isn't pushed down by chrome sitting over its first line; the chip's own home moved
 * WITH the toolbar it now shares a row with, which is a deliberate, DIFFERENT design call from t1323's original
 * "centred over the code" — not a regression of the ORIGINAL defect this test was written to catch (the chip and
 * line 1 sharing pixels), which the geometry check below still enforces regardless of which side the chip is on.
 *
 * This asserts by GEOMETRY, not by a class name or a pixel constant: read both rects and require they do not
 * intersect. That is what makes it survive a font change, a theme change or a longer estimate string — the day the
 * chip grows past the strip and overlaps the code, this fails, which is exactly the day it should.
 */

const WIDTHS = [
    { w: 1400, name: 'desktop' },
    { w: 390, name: 'phone' },
];

const measure = async (page) => page.evaluate(() => {
    const chip = document.getElementById('time-estimate-chip');
    const line1 = document.querySelector('#editor-highlight .g-line');
    if (!chip || chip.hidden || !line1) return { chip: !!chip, shown: !!(chip && !chip.hidden), line1: !!line1 };
    const c = chip.getBoundingClientRect();
    const l = line1.getBoundingClientRect();
    const intersects = !(c.bottom <= l.top || c.top >= l.bottom || c.right <= l.left || c.left >= l.right);
    return {
        chip: true, shown: true, line1: true, intersects,
        chipRect: { top: Math.round(c.top), bottom: Math.round(c.bottom), left: Math.round(c.left), right: Math.round(c.right) },
        lineRect: { top: Math.round(l.top), bottom: Math.round(l.bottom), left: Math.round(l.left), right: Math.round(l.right) },
        gap: Math.round(l.top - c.bottom),
        text: chip.textContent.trim(),
    };
});

for (const { w, name } of WIDTHS) {
    test(`the chip and line 1 do not intersect — ${name} (${w}px)`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
        await page.evaluate(() => {
            const ed = document.getElementById('editor');
            // a program with a feed so the estimate has something to compute — a chip with no text proves nothing
            ed.value = 'G0 X0 Y0\nG1 X50 F300\nG1 Y50 F300\nM30';
            ed.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.waitForTimeout(1400);
        const r = await measure(page);
        // the assert is only meaningful if the chip is actually on screen — a hidden chip trivially never overlaps
        expect(r.shown, 'the estimate chip is visible (otherwise this assert is vacuous)').toBe(true);
        expect(r.text, 'and it carries an estimate').toMatch(/\d/);
        expect(r.line1, 'and line 1 is rendered in the highlight layer').toBe(true);
        expect(r.intersects, `the chip and line 1 share no pixels: ${JSON.stringify(r)}`).toBe(false);
        // t2155 — direction is now WIDTH-DEPENDENT by design (see the module header): desktop keeps the chip
        // above the code (t1323's original placement, unchanged), phone moves the whole strip below it
        // (BACKLOG #13). Assert the direction that's actually true for each width, not one fixed sign.
        if (name === 'desktop') {
            expect(r.gap, `desktop: line 1 starts below the chip with room to breathe: ${JSON.stringify(r)}`).toBeGreaterThanOrEqual(0);
        } else {
            expect(-r.gap, `phone: the chip starts below line 1 with room to breathe (BACKLOG #13's bottom strip): ${JSON.stringify(r)}`).toBeGreaterThanOrEqual(0);
        }
    });
}

test('#editor and #editor-highlight START AT THE SAME TOP — a lone layer would sit a line off', async ({ page }) => {
    // t2155 — REWRITTEN. Was: both layers read a shared `--editor-chip-inset` variable via `top`. That variable
    // is deleted now — the code area (`.editor-code`) is a real box that already starts in the right place, and
    // both layers are just `top:0` inside it (see `.editor-layer`'s base rule, styles.css). The property that
    // actually matters — the textarea and its highlight overlay must move TOGETHER, or every syntax glow and
    // error underline lands one line away from its code — still needs its own assertion; it just has a simpler
    // mechanism to check now (equal top, not equal to a shared variable).
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    const r = await page.evaluate(() => {
        const rect = (el) => el.getBoundingClientRect().top;
        return {
            code: rect(document.querySelector('.editor-code')),
            editor: rect(document.getElementById('editor')),
            highlight: rect(document.getElementById('editor-highlight')),
        };
    });
    expect(Math.abs(r.editor - r.code), `the textarea starts at .editor-code's own top: ${JSON.stringify(r)}`).toBeLessThan(1);
    expect(Math.abs(r.highlight - r.editor), `and so does the highlight overlay — they must move together: ${JSON.stringify(r)}`).toBeLessThan(1);
});
