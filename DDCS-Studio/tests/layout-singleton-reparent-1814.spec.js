import { test, expect } from '@playwright/test';
import { openWizardViaBar, fillField } from './support/barGesture.js';
import { stopLiveSim, dismissToasts } from './support/simControls.js';

/**
 * t1814 — `panelTypes.js`'s `_layout` is a MODULE-LEVEL SINGLETON `FeatureCanvas` instance, shared by every
 * caller of `renderLayout2D` regardless of which surface (the modal or the Blocks pane) is rendering. Traced at
 * t1806/t1810 and reproduced live by hand: opening the "Open as modal" preview (`#blkOpenModal`,
 * `blocksApp.js`'s `openLiveAsModal`) re-mounts this ONE `FeatureCanvas` into the MODAL's own container
 * (`_mount`'s own `container.innerHTML = ''` + a fresh SVG/listener set). Closing that preview does NOT
 * re-render the pane, so the pane's own SVG — still visually present, its OWN event listeners still attached —
 * is now orphaned relative to the singleton's CURRENT internal state (`this.spec`, `this.active`, `this._tf`,
 * all now the MODAL's). A drag on the pane's still-visible handle fires real pointer events, but `_hit(x,y)`
 * tests them against `this.spec.handles` — now the MODAL's handles, at different coordinates — finds no match,
 * and falls into the PAN branch instead of the DRAG branch, so `onDrag`/the field write-back never fires. No
 * error, no visual sign — the handle simply stops responding.
 *
 * This test asserts the OUTCOME a user cares about — did the dragged value actually change — not an internal
 * predicate like `_hit`'s return or which branch ran. A test asserting the internal mechanism would still pass
 * if a future change broke this the same way through a different code path (this codebase has already been
 * bitten once by a green test asserting the wrong property — see the project's own standing guidance on this).
 */

test.use({ viewport: { width: 1500, height: 950 } });

test('a pane handle keeps responding to drags after "Open as modal" renders+closes (no _layout reparent regression)', async ({ page }) => {
    test.setTimeout(60_000);
    // t1814 — REAL, CONFIRMED FINDING, NOT FIXED HERE. `_layout` shares one stateful FeatureCanvas instance
    // across both surfaces; reparenting it (via "Open as modal") orphans the other surface's own DOM relative
    // to the singleton's current state, and the drag silently stops responding (traced: _hit() tests against
    // the wrong spec, falls into pan instead of drag). Capture-at-call-time (the t1804/t1806/_formHost pattern)
    // does not fit this bug shape — there is no "read too late," the mount is always synchronous and correct
    // for its OWN call; the problem is ONE mutable object standing in for what should be N independent ones.
    // The honest fix is giving each surface its own FeatureCanvas instead of sharing one that reparents — a
    // bigger, structural call reserved for the advisor, not made here. `test.fail()` keeps this TRACKED and
    // visible (an "x" in the list) rather than silently red or silently deleted; remove this line once the
    // real fix lands and this test goes green on its own terms — see WORK-LOG t1814.
    test.fail(true, '_layout (panelTypes.js) is a shared FeatureCanvas singleton that reparents across surfaces — see WORK-LOG t1814, not fixed (structural call reserved for the advisor)');
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
