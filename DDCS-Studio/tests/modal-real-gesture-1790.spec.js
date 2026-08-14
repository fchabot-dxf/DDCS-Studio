import { test, expect } from '@playwright/test';
import { openWizardViaBar, fillField, clickInsert } from './support/barGesture.js';
import { assertContainerHasDrawing } from './support/drawingCheck.js';

/**
 * t1790 — ADDITION 7: GUARD THE MODAL.
 *
 * All six prior additions (t1776–t1786) guard the Blocks-tab PANE (`#blk_wiz_user` / `#blk_userViz3dContainer` /
 * `#blk_userVizContainer`). NONE of them guard the MODAL (`#wiz_user` / `.wiz-box` / `#userViz3dContainer` /
 * `#userVizContainer`) — a real, separate surface that shares a renderer AND, since t1764, shares CSS selectors
 * with the pane. That gap is why a real version of "the 2D preview is missing from every wizard in the modal"
 * (t1788 — turned out to be a VS Code Live Preview module-cache artifact, not a real bug, but the modal itself
 * was genuinely unguarded while that was being sorted out) would have shipped green through this whole series.
 * **THIS SPEC IS NOT A DUPLICATE OF t1776/t1782 — it targets a DIFFERENT rendering surface (the modal) that
 * happens to share a renderer with the pane those specs already cover. Do not trim it as redundant.**
 *
 * REUSE, not a second copy: the real bar-click gesture (`openWizardViaBar`/`fillField`/`clickInsert`) and the
 * pixel-sampling technique (`assertContainerHasDrawing`) were extracted out of `primary-route-real-gesture-
 * 1776.spec.js` into `tests/support/barGesture.js` / `tests/support/drawingCheck.js` at this same act, so this
 * file and t1776 both import the SAME implementation rather than each carrying their own.
 *
 * Covers corner (hasTree, panel `form3d+2d` — both visual containers exist) and Pause/Confirm (the flat twin
 * from Addition 3, panel `form` — a DELIBERATE design choice with no motion to preview, so it correctly has NO
 * 3D/2D containers at all). The drawing check only runs where a twin actually declares a visual panel; for the
 * panel-less flat twin this spec asserts the form + the modal surface paint instead, not a drawing that was
 * never supposed to exist — asserting canvases against an op that never claims one would be the same
 * element-existence-shaped mistake this whole series exists to retire, just inverted.
 */

test.use({ viewport: { width: 1500, height: 950 } });

test('the modal: corner (hasTree, form3d+2d) — form value, both visual containers exist and are drawn, surface painted', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    await openWizardViaBar(page, { group: 'Probe', optype: 'corner' });
    const DISTINCTIVE = '741';
    await fillField(page, { formSelector: '#wiz_user_form', param: 'dist', value: DISTINCTIVE });

    // The form itself shows the typed value (no Insert yet — this act is about the MODAL's own rendering,
    // not the round trip through the program model).
    const fieldValue = await page.locator('#wiz_user_form [data-param="dist"]').inputValue();
    expect(fieldValue, 'the modal form must show the typed value').toBe(DISTINCTIVE);

    // Both visual containers exist and are meaningfully sized (the exact incoherent-measurement shape t1788's
    // own investigation had to rule out first: a 0×0 wrapper around a correctly-sized child is not "exists").
    const geometry = await page.evaluate(() => {
        const box3d = document.getElementById('userViz3dBox');
        const cont3d = document.getElementById('userViz3dContainer');
        const cont2d = document.getElementById('userVizContainer');
        const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; };
        return { box3d: r(box3d), cont3d: r(cont3d), cont2d: r(cont2d) };
    });
    expect(geometry.box3d && geometry.box3d.w > 50 && geometry.box3d.h > 50, `3D box must be meaningfully sized (got ${JSON.stringify(geometry.box3d)})`).toBe(true);
    expect(geometry.cont2d && geometry.cont2d.w > 50 && geometry.cont2d.h > 50, `2D container must be meaningfully sized (got ${JSON.stringify(geometry.cont2d)})`).toBe(true);

    // Both actually contain a DRAWING, not just a canvas element (Addition 4's technique, reused).
    await assertContainerHasDrawing(page, '#userViz3dContainer', 'modal 3D visual host');
    await assertContainerHasDrawing(page, '#userVizContainer', 'modal 2D visual host');

    // The modal's own surface (.wiz-box) is painted — the same family of check as Addition 5, on the surface
    // those t1764/t1766 CSS rules were ORIGINALLY written for (`.wiz-box, #blk_wiz_user { ... }` — .wiz-box is
    // the modal's, #blk_wiz_user the pane's; the pane borrowed the modal's rule, not the other way round).
    const painted = await page.evaluate(() => {
        const el = document.querySelector('.wiz-box');
        const cs = getComputedStyle(el);
        return cs.backgroundImage !== 'none' || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'rgb(0, 0, 0)');
    });
    expect(painted, 'the modal surface (.wiz-box) must be painted, not raw page background').toBe(true);

    await clickInsert(page);   // leave no dangling modal for the next test
});

test('the modal: Pause/Confirm (the flat twin, panel `form`) — form value shows, surface painted, correctly NO visual containers', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    await openWizardViaBar(page, { group: 'Setup', optype: 'pause_confirm' });
    const DISTINCTIVE = 'DISTINCT-MODAL-MSG-1790';
    await fillField(page, { formSelector: '#wiz_user_form', param: 'msg', value: DISTINCTIVE });

    const fieldValue = await page.locator('#wiz_user_form [data-param="msg"]').inputValue();
    expect(fieldValue, 'the modal form must show the typed value').toBe(DISTINCTIVE);

    const painted = await page.evaluate(() => {
        const el = document.querySelector('.wiz-box');
        const cs = getComputedStyle(el);
        return cs.backgroundImage !== 'none' || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'rgb(0, 0, 0)');
    });
    expect(painted, 'the modal surface (.wiz-box) must be painted, not raw page background').toBe(true);

    // This twin declares panel:'form' (no motion to preview) — correctly NO visual containers, not a bug.
    const has3dBox = await page.evaluate(() => !!document.getElementById('userViz3dBox') && getComputedStyle(document.getElementById('userViz3dBox')).display !== 'none');
    expect(has3dBox, "Pause/Confirm declares panel:'form' — the 3D box must stay hidden, not appear empty").toBe(false);

    await clickInsert(page);
});
