import { test, expect } from '@playwright/test';

/**
 * t1323 (1) — THE TIME CHIP AND LINE 1 DO NOT SHARE PIXELS.
 *
 * USER SCREENSHOT: the floating estimate pill sat ON the first line of code. Two controls owning the same pixels is
 * the defect; where the pill goes is the design call. It STAYS where it is — centred over the code — because that is
 * what it describes, and the editor's chrome is its four corners (Transform, Make, file, copy), not a toolbar with a
 * free slot. So the CODE gets an inset instead, sized to the chip that is actually rendered.
 *
 * This asserts by GEOMETRY, not by a class name or a pixel constant: read both rects and require they do not
 * intersect. That is what makes it survive a font change, a theme change or a longer estimate string — the day the
 * chip grows past the inset, this fails, which is exactly the day it should.
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
        // direction matters too: line 1 must sit BELOW the chip, not be pushed off the far side of it
        expect(r.gap, `line 1 starts below the chip with room to breathe: ${JSON.stringify(r)}`).toBeGreaterThanOrEqual(0);
    });
}

test('the inset is DECLARED once and both editor layers take it — a lone layer would sit a line off', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    const r = await page.evaluate(() => {
        const box = document.querySelector('.editor-container');
        const pad = (el) => parseFloat(getComputedStyle(el).paddingTop);
        return {
            declared: getComputedStyle(box).getPropertyValue('--editor-chip-inset').trim(),
            editor: pad(document.getElementById('editor')),
            highlight: pad(document.getElementById('editor-highlight')),
        };
    });
    expect(r.declared, 'the inset is one declared value on the container').toBeTruthy();
    // THE COUPLING THAT MATTERS: the textarea and its highlight overlay are two stacked layers showing the SAME text.
    // If only one takes the inset, every syntax glow and every error underline lands one line away from its code.
    expect(r.editor, 'the textarea takes the declared inset').toBe(parseFloat(r.declared));
    expect(r.highlight, 'and so does the highlight overlay — they must move together').toBe(r.editor);
});
