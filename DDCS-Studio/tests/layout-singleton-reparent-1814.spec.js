import { test, expect } from '@playwright/test';
import { openWizardViaBar, fillField } from './support/barGesture.js';
import { stopLiveSim, dismissToasts } from './support/simControls.js';

/**
 * t1814 found `panelTypes.js`'s `_layout` was a MODULE-LEVEL SINGLETON `FeatureCanvas` instance, shared by every
 * caller of `renderLayout2D` regardless of which surface (the modal or the Blocks pane) is rendering. Traced at
 * t1806/t1810 and reproduced live by hand: opening the "Open as modal" preview (`#blkOpenModal`,
 * `blocksApp.js`'s `openLiveAsModal`) re-mounted this ONE `FeatureCanvas` into the MODAL's own container
 * (`_mount`'s own `container.innerHTML = ''` + a fresh SVG/listener set). Closing that preview did NOT
 * re-render the pane, so the pane's own SVG — still visually present, its OWN event listeners still attached —
 * was left orphaned relative to the singleton's CURRENT internal state (`this.spec`, `this.active`, `this._tf`,
 * all now the MODAL's). A drag on the pane's still-visible handle fired real pointer events, but `_hit(x,y)`
 * tested them against `this.spec.handles` — now the MODAL's handles, at different coordinates — found no match,
 * and fell into the PAN branch instead of the DRAG branch, so `onDrag`/the field write-back never fired. No
 * error, no visual sign — the handle simply stopped responding.
 *
 * t1816 fixed it: `renderLayout2D` now caches its `FeatureCanvas` per CONTAINER (`container.__layout`) instead
 * of one shared module-level `_layout`, so the modal and the pane each own an independent instance that can no
 * longer reparent one another's DOM.
 *
 * This test asserts the OUTCOME a user cares about — did the dragged value actually change — not an internal
 * predicate like `_hit`'s return or which branch ran. A test asserting the internal mechanism would still pass
 * if a future change broke this the same way through a different code path (this codebase has already been
 * bitten once by a green test asserting the wrong property — see the project's own standing guidance on this).
 */

test.use({ viewport: { width: 1500, height: 950 } });

test('a pane handle keeps responding to drags after "Open as modal" renders+closes (no _layout reparent regression)', async ({ page }) => {
    test.setTimeout(60_000);
    // t1816 — FIXED: `renderLayout2D` now caches its FeatureCanvas per CONTAINER (`container.__layout`, matching
    // atcSetupCanvas.js's own precedent) instead of one shared module-level `_layout` singleton, so the modal's
    // and the pane's own render each own an independent instance and can no longer reparent one another's DOM.
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    // The pane live: a real Insert -> Blocks tab.
    await openWizardViaBar(page, { group: 'Probe', optype: 'corner' });
    await fillField(page, { formSelector: '#wiz_user_form', param: 'dist', value: '741' });
    await page.locator('.wiz-foot button.primary', { hasText: 'INSERT' }).click();
    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await stopLiveSim(page, '#blk_userViz3dBox');
    await page.waitForTimeout(600);
    await dismissToasts(page);

    const before = await page.evaluate(() => { const f = document.querySelector('#blk_wiz_user_form [data-param="cross1_x"]'); return f ? f.value : 'NO-FIELD'; });

    // The modal ALSO live, via the exact trigger t1806 traced — no tab switch, the pane stays the visible tab.
    const openModalBtn = page.locator('#blkOpenModal');
    await expect(openModalBtn).toBeVisible();
    await openModalBtn.click();
    await page.waitForTimeout(500);

    // Close the preview modal — real close button, still no tab switch away from Blocks.
    const closeBtn = page.locator('.wiz-box .wiz-close, .wiz-foot button:has-text("Cancel"), .wiz-foot button.secondary').first();
    if (await closeBtn.count()) await closeBtn.click(); else await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // The pane's own handle is still visually there. Drag it — a real gesture, same as any other user drag.
    const handle = page.locator('#blk_wiz_user svg [data-hid="reposition_pos"]');
    await expect(handle, 'the handle itself is still rendered after the modal preview closes').toHaveCount(1);
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const after = await page.evaluate(() => { const f = document.querySelector('#blk_wiz_user_form [data-param="cross1_x"]'); return f ? f.value : 'NO-FIELD'; });

    // THE OUTCOME: did the drag actually change the value? (Not: did a particular internal branch run.)
    expect(after, 'the drag must still write a real value after the modal preview has rendered+closed').not.toBe(before);
});
