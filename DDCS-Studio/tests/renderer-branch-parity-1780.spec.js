import { test, expect } from '@playwright/test';

/**
 * t1780 — ADDITION 3: BOTH RENDERER BRANCHES, FROM THE SAME GESTURE.
 *
 * `blocksApp.js`'s renderLiveForm has two branches for the Wizard View pane — `hasTree` (line 667, a twin whose
 * `uiChildren` declares a layout tree: section/panel/sim/tab_group/grid_container/group_box/split_*, checked by
 * `checkLayoutNodes`) and FLAT (line 731, no layout tree — just `param_group`/`param_field`). Bug 2 this week
 * shipped because nothing told the two apart: `05e5fa44` switched the flat branch and every BUILT-IN twin took
 * the OTHER (hasTree) one, so the suite stayed green while the flat branch broke.
 *
 * ── FOUND A GENUINELY FLAT TWIN, NAMED, NOT ASSUMED ─────────────────────────────────────────────────────────────
 * Read `checkLayoutNodes` (blocksApp.js:614-624): it matches ANY of
 * `split_horizontal/split_vertical/grid_container/tab_group/group_box/section/sim/panel` inside `uiChildren`,
 * recursively. Grepped every file in `blocks/dataOps/` for those type strings inside its own `uiChildren`
 * construction (not run against the live app — a static read of the SAME predicate the app runs). Two twins
 * declare `uiChildren: [{ type: 'param_group', ... }]` and NOTHING else — `pauseConfirmData.js` (`user_pause_confirm`,
 * ONE field, `msg`) and `ioStepData.js` (`user_io_step`). **`user_pause_confirm` is the flat twin this spec drives**
 * — reachable from the real bar (Setup ▾ → Pause / Confirm, `data-optype="pause_confirm"`), so this is not a
 * manufactured fixture exercising a branch nothing reaches; it is a real, shipped, currently-flat op.
 * `user_corner_data` (Addition 1/2's own twin) is the hasTree side — its `cornerDataStack` explicitly builds
 * `sec(...)`/`panel`/`sim` blocks into `uiChildren`.
 *
 * ── THE ASSERTION, AND WHY IT WOULD ACTUALLY CATCH A BRANCH SWITCH ─────────────────────────────────────────────
 * No existing DOM/window surface names which branch rendered (checked: `hasTree` is a local variable inside
 * `renderLiveForm`, never assigned to the DOM or `window`) — adding one would be app instrumentation for a test,
 * which the dispatch explicitly forbids. The strongest available proxy instead: BOTH branches are required, by
 * `checkLayoutNodes`'s own definition, to route ONE specific op through ONE specific branch — so asserting that
 * the FLAT twin's field renders and carries the typed value, driven by the identical real-gesture chain that
 * already proves the hasTree twin works (Addition 1), IS a check on the flat branch specifically: if a future
 * change made `hasTree` true for every twin (or false for every twin), `user_corner_data`'s 23-field sectioned
 * form or `user_pause_confirm`'s 1-field flat form would each start rendering through the OTHER branch's code —
 * and per this act's own reading of the two branches (byte-identical `setUserOpDef`/`onShow`/`update`/
 * `makePanesCollapsible` calls, differing only in whether `liveDef.template` is overridden to `[userRoot]`), the
 * one case where that divergence is externally visible is exactly a field failing to reflect a live canvas edit
 * — which this spec cannot force on a freshly-inserted op without adding its own instrumentation either. So the
 * honest ceiling, stated per the dispatch: this proves BOTH branches are independently reachable and correct
 * for the field-render-with-value outcome via a real gesture (the actual gap `05e5fa44` shipped through — NO
 * spec drove either branch this way before), not that a branch swap would be caught by assertion content alone.
 */

test.use({ viewport: { width: 1500, height: 950 } });

async function bootAndFillReal(page, { group, optype, fieldParam, value }) {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: group }).click();
    await page.locator(`.dock-header .toolbar-dropdown-content button[data-optype="${optype}"]`).click();
    const field = page.locator(`#wiz_user_form [data-param="${fieldParam}"]`);
    await expect(field).toBeVisible({ timeout: 5000 });
    await field.fill(value);
    await field.dispatchEvent('change');
    await page.locator('.wiz-foot button.primary', { hasText: 'INSERT' }).click();
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });
    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => window.__blkWs, null, { timeout: 10000 });
    await page.waitForTimeout(600);   // let the pane's own render settle (async import + form build)
}

/** Read back what the Wizard View pane actually shows for `paramName`, after the real gesture above. */
async function wizardViewShows(page, paramName, value) {
    return page.evaluate(({ paramName, value }) => {
        const fieldEls = Array.from(document.querySelectorAll(`[data-param="${paramName}"]`));
        const fieldMatch = fieldEls.some((el) => String(el.value) === value);
        return { fieldCount: fieldEls.length, fieldMatch, fieldValues: fieldEls.map((el) => el.value) };
    }, { paramName, value });
}

test('the hasTree twin (Corner) renders its field via the real gesture', async ({ page }) => {
    test.setTimeout(60_000);
    await bootAndFillReal(page, { group: 'Probe', optype: 'corner', fieldParam: 'dist', value: '741' });
    const r = await wizardViewShows(page, 'dist', '741');
    expect(r.fieldCount, 'the dist field is on the Wizard View canvas').toBeGreaterThan(0);
    expect(r.fieldMatch, `Wizard View must show 741 (saw: ${JSON.stringify(r.fieldValues)})`).toBe(true);
});

test('the FLAT twin (Pause/Confirm) renders its field via the real gesture', async ({ page }) => {
    test.setTimeout(60_000);
    await bootAndFillReal(page, { group: 'Setup', optype: 'pause_confirm', fieldParam: 'msg', value: 'DISTINCT-MSG-1780' });
    const r = await wizardViewShows(page, 'msg', 'DISTINCT-MSG-1780');
    expect(r.fieldCount, 'the msg field is on the Wizard View canvas').toBeGreaterThan(0);
    expect(r.fieldMatch, `Wizard View must show the distinct message (saw: ${JSON.stringify(r.fieldValues)})`).toBe(true);
});
