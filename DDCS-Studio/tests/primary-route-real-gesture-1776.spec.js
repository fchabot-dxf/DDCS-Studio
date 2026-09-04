import { test, expect } from '@playwright/test';
import { openWizardViaBar, fillField, clickInsert, clickBlocksTab } from './support/barGesture.js';
import { assertContainerHasDrawing } from './support/drawingCheck.js';

/**
 * t1776 — THE PRIMARY ROUTE, END TO END, ALL REAL CLICKS.
 *
 * The audit found: 0 specs click a bar entry, 1 clicks INSERT, 0 click the Blocks tab, and the file NAMED
 * pane-visual-host-real-gesture-1762 (despite its name) drives none of them — it calls the JS functions
 * (openWiz/insertWiz) directly, never the DOM the user actually clicks. This is the first real one: click a
 * command-bar entry through its group dropdown, fill a distinctive value into the real form field, click the
 * real INSERT button, click the real BLOCKS tab, and assert the Wizard View shows that exact value. No
 * window.openWiz, no insertWiz, no showApp anywhere in this file.
 *
 * ── t1782 ADDITION 4 — A VISUAL HOST MUST CONTAIN A DRAWING, NOT A CANVAS ──────────────────────────────────────
 * The audit: 83 specs reference a canvas, only 10 read pixels; the *-in-place family (16 files, NOT touched this
 * act — named for a later slice) asserts `canvas ? 1 : 0`, which is why an EMPTY visual host (bug 3) shipped
 * green — a `<canvas>` element existing proves nothing was drawn on it. Extended the same real chain above: once
 * on the Blocks tab, sample BOTH the 3D and 2D visual containers for genuinely non-uniform pixels (see
 * `support/drawingCheck.js` for the technique + its own non-vacuity proof).
 *
 * ── t1790 ADDITION 7 — THE GESTURE CHAIN + PIXEL CHECK NOW LIVE IN tests/support/ ────────────────────────────────
 * Extracted `openWizardViaBar`/`fillField`/`clickInsert`/`clickBlocksTab` into `support/barGesture.js` and
 * `assertContainerHasDrawing`/`sampleCanvas` into `support/drawingCheck.js` so the modal-coverage spec
 * (`modal-real-gesture-1790.spec.js`) could reuse them instead of a second copy — that spec guards the MODAL,
 * a genuinely different surface from this one (the Blocks-tab pane), not a duplicate of this file.
 */

test.use({ viewport: { width: 1500, height: 950 } });

test('the primary route: bar entry -> fill -> Insert -> Blocks tab -> the Wizard View shows the value', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    // 1) CLICK a command-bar entry.
    await openWizardViaBar(page, { group: 'Probe', optype: 'corner' });

    // 2) FILL a distinctive value into a real form field (the wizard opened as the shared modal — corner's
    // panel is form3d+2d, which wizItemOnclick routes through openWiz, landing on the SAME #wiz_user_form /
    // .wiz-foot as every other bar-opened wizard).
    const DISTINCTIVE = '777';
    await fillField(page, { formSelector: '#wiz_user_form', param: 'dist', value: DISTINCTIVE });

    // 3) CLICK the real INSERT button (index.html:1156).
    await clickInsert(page);

    // 4) CLICK the real BLOCKS tab (index.html:136).
    await clickBlocksTab(page);

    // 5) ASSERT the Wizard View shows THAT value — either as the live re-derived form field, or in the
    // rendered G-code preview (both are legitimate "the Wizard View shows it" surfaces; check both, report
    // which actually carries it rather than assuming).
    await page.waitForTimeout(600);   // let the pane's own render settle (async import + form build)
    const found = await page.evaluate((val) => {
        const fieldEls = Array.from(document.querySelectorAll('[data-param="dist"]'));
        const fieldMatch = fieldEls.some((el) => String(el.value) === val);
        const codeEls = Array.from(document.querySelectorAll('pre[id^="wiz_"][id$="_code"], #blk_wiz_user pre'));
        const codeText = codeEls.map((el) => el.textContent || '').join('\n');
        const codeMatch = codeText.includes(`#1=${val}`);
        return { fieldMatch, codeMatch, fieldCount: fieldEls.length, codeSnippetAround: codeText.split('\n').find((l) => /#1=/.test(l)) || null };
    }, DISTINCTIVE);

    expect(found.fieldMatch || found.codeMatch, `the Wizard View must show ${DISTINCTIVE} somewhere (field=${found.fieldMatch}, code=${found.codeMatch}, fields seen=${found.fieldCount}, code line=${found.codeSnippetAround})`).toBe(true);

    // 6) t1782 ADDITION 4 — the visual host must contain a DRAWING, not just a <canvas> element.
    // t2631 — corner is now tree-rendered (formWidgets.js's own nsId), so its real pane ids carry a `_tree`
    // suffix (modal-real-gesture-1790.spec.js's own note: a `#a, #b` selector list is unsafe here — the dead
    // classic-shell node sits earlier in document order — so `_tree` directly, not a combined selector).
    await assertContainerHasDrawing(page, '#blk_userViz3dContainer_tree', '3D visual host');
    await assertContainerHasDrawing(page, '#blk_userVizContainer_tree', '2D visual host');
});
