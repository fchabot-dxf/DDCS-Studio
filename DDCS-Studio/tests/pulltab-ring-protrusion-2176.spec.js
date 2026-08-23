import { test, expect } from '@playwright/test';

/**
 * t2176 amendment 4A — "the preview button seem to not extend onto ring but it does a little bit." The 3D
 * pull-tab (`.viz3d-handle`) sat 4px taller than the toolbar row it shares a bottom edge with at the
 * phone+portrait intersection, so its own top edge crossed 4px into `.editor-code::before`'s ring box. Fixed
 * structurally (clamped to the SAME height as the toolbar's own buttons — `--editor-toolbar-handle-h`) rather
 * than by z-index arbitration, per the human's explicit steer away from the folder-tab-straddle option amendment
 * 3 first offered. The desktop right-edge case (t2153 amendment 6) is untouched — its own spec,
 * editor-focus-ring-2151.spec.js, re-verified green after this change.
 */
test.use({ viewport: { width: 390, height: 800 } });

test('the pull-tab does not protrude above the toolbar row it shares a bottom edge with', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    await page.evaluate(() => {
        const ed = document.getElementById('editor');
        ed.value = '( line 1 )\n( line 2 )\n( line 3 )';
        ed.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
        const handle = document.querySelector('.viz3d-handle').getBoundingClientRect();
        const toolbar = document.querySelector('.editor-toolbar').getBoundingClientRect();
        const codeBottom = document.querySelector('.editor-code').getBoundingClientRect().bottom;
        return { handleTop: handle.top, toolbarTop: toolbar.top, codeBottom };
    });
    expect(r.handleTop, 'the handle\'s own top no longer sits above the toolbar\'s top').toBeGreaterThanOrEqual(r.toolbarTop);
    // THE TEST THAT MATTERS: the handle must not enter the ring's own box (which ends where .editor-code ends) —
    // a same-row check alone wouldn't catch a handle that's merely adjacent-but-still-crossing at a boundary pixel.
    expect(r.handleTop, 'the handle stays OUTSIDE the ring\'s own box (at/below where .editor-code ends)').toBeGreaterThanOrEqual(r.codeBottom);
});
