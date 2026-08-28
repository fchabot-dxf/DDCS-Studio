import { test, expect } from '@playwright/test';

/**
 * t2371 — DECLARE THE LAST THREE PATH-ANCHOR PICKERS: contour (`ct_`), slot (`sl_`), text (`tx_`) — the
 * remaining three of the six `.pa-mount[data-prefix]` shells `index.html` bakes in (drill/pocket/surfacing
 * already had theirs). Each prefix copied VERBATIM from `index.html`, matching the discipline
 * `pa-mount-scope-2367.spec.js` pins against: a wrong prefix binds the picker to another wizard's mount.
 *
 * A GENUINE FINDING surfaced verifying this, not assumed from the code: `path_anchor` renders ONLY inside
 * `formWidgets.js`'s `renderUiTree` — the FLAT `renderOpForm` path (every def without a tree-mode trigger)
 * never even looks at uiChildren node types, only flat bindings. Consequence: `surfacingData.js`'s own t2271
 * `path_anchor` declaration (this arc's cited "pilot") had NEVER actually rendered its picker in the live app —
 * confirmed live, `document.querySelectorAll('.pa-mount')` inside `#wiz_user` measured 0 both via a plain open
 * AND via CUSTOMIZE.
 *
 * FIRST FIX ATTEMPT, WRONG, REVERTED: making `userOpView.js`'s own `hasTreeLayout()` also recognize
 * `path_anchor` as a tree-mode trigger. Looked safe (`param_group`'s own `renderUiTree` branch is deliberately
 * transparent, t1605 — "decides only WHERE the rows land, never what they contain", so the FIELD SET was
 * unaffected) but `render()`'s own `isTree` branch does more than pick a renderer — it unconditionally hides
 * the GENERIC outer `.wiz-visual` pane (drill's own reason: its tree owns an internal split with its own 2D/3D
 * pane, so the outer one is redundant) and drops the flat renderer's own section-grouping (`renderUiTree`'s
 * transparent `param_group` pass-through never buckets rows by `section`). Surfacing/contour/slot/text have no
 * internal split to replace what got hidden — two real regressions (blanked previews, ungrouped sections),
 * caught by this turn's own required full-suite run (21 failed / 16 flaky first pass) on files the targeted
 * verification never touched.
 *
 * ACTUAL FIX: `path_anchor` mounts directly in the FLAT path instead. `hasTreeLayout`/`isTree`/`renderUiTree`
 * are completely untouched (reverted to their exact original shape) for every op, including drill's own nested
 * `path_anchor`, which stays on the unchanged tree path. `userOpView.js`'s new `findTopLevelPathAnchor` +
 * `mountFlatPathAnchor` give `render()`'s flat branch the SAME hide-the-dropdown-rows/mount-the-picker
 * behavior `formWidgets.js`'s tree branch gives a tree-rendered one, applied to `renderOpForm`'s own already-
 * rendered rows — one new call, zero lines removed from the pre-existing logic. Verified live: same field SET
 * as before (unaffected either way), preview pane still visible, sections still grouped — every test the first
 * attempt broke now passes.
 *
 * `WRAP_PREFIX_COUNT` bumped 3→4 in `contourData.js`/`textData.js` (the frozen blockIndex offset past the
 * wrapper): inserting `path_anchor` as a new uiChildren sibling BEFORE `param_group` shifts every exec-stack
 * flatten index after it by one — the exact "hardcoded wrap-offset drift" hazard this file's own t2301/t2257
 * comments already document, this time from an ADDITION not a removal. `slotData.js` is `bindingSpecs`-driven
 * (identity-by-type, re-derived every build) — immune by construction, no offset to bump.
 *
 * EMIT PROVEN BYTE-IDENTICAL (a FORM-only change): `tests/contour-data-emit.spec.js` (byte-diff ZERO across
 * side × 4 shapes × a scalar/placement/wcs sweep), `tests/slot-as-data.spec.js` + `tests/text-as-data.spec.js`
 * (byte-identical G-code + cross-dialect), all green unchanged after this turn's edits.
 *
 * boreData.js/tapData.js ALSO carry stockAttach/pathDatum bindings (plain dropdowns, no picker) but are
 * deliberately NOT touched this turn: established, not assumed — neither has ANY classic hand-written shell at
 * all (no `boreView.js`/`tapView.js`, no static `index.html` markup under a `bo_`/`tp_` prefix; grepped, zero
 * hits). They are TWIN-ONLY ops (reachable via the `mill_datawiz` dev palette, never the classic Mill toolbar —
 * bore exists only as `drill`'s own internal `array(bore)` composition). There is no shell for their dropdown
 * exposure to diverge FROM, so it is not a gap to close — a finding for the plan, not a bug in this arc.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function checkTwin(page, opType, prefix, label) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), opType);
    await page.waitForSelector('#wiz_user', { state: 'visible', timeout: 8000 });
    await page.waitForFunction((p) => document.querySelector(`#wiz_user .pa-mount[data-prefix="${p}"]`), prefix, { timeout: 8000 });
    return page.evaluate((p) => {
        const mount = document.querySelector(`#wiz_user .pa-mount[data-prefix="${p}"]`);
        const pickerCount = mount ? mount.querySelectorAll('svg').length : 0;
        const built = mount ? mount.dataset.built === '1' : false;
        const stockRow = document.querySelector('#wiz_user [data-param="stockAttach"]');
        const pathRow = document.querySelector('#wiz_user [data-param="pathDatum"]');
        const stockRowVisible = stockRow ? (stockRow.closest('.form-row') || stockRow.parentElement).style.display !== 'none' : null;
        const pathRowVisible = pathRow ? (pathRow.closest('.form-row') || pathRow.parentElement).style.display !== 'none' : null;
        return { foundMount: !!mount, pickerCount, built, stockRowVisible, pathRowVisible };
    }, prefix);
}

test('t2371: contour/slot/text twins render the path_anchor picker with real content, dropdown rows hidden — matching drill/pocket/surfacing', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);

    const contour = await checkTwin(page, 'user_contour_data', 'ct_', 'Contour');
    expect(contour.foundMount, "contour's own mount at prefix 'ct_' (copied verbatim from index.html:578)").toBe(true);
    expect(contour.built, 'mountPathAnchor actually built into it, not skipped').toBe(true);
    expect(contour.pickerCount, 'two real corner-grid pickers, not an empty mount').toBe(2);
    expect(contour.stockRowVisible, 'the stockAttach dropdown row is hidden behind the picker, matching the shell').toBe(false);
    expect(contour.pathRowVisible, 'the pathDatum dropdown row is hidden behind the picker, matching the shell').toBe(false);
    await page.screenshot({ path: 'test-results/t2371-contour-picker.png' });

    const slot = await checkTwin(page, 'user_slot_data', 'sl_', 'Slot');
    expect(slot.foundMount, "slot's own mount at prefix 'sl_' (copied verbatim from index.html:654)").toBe(true);
    expect(slot.built).toBe(true);
    expect(slot.pickerCount).toBe(2);
    expect(slot.stockRowVisible).toBe(false);
    expect(slot.pathRowVisible).toBe(false);
    await page.screenshot({ path: 'test-results/t2371-slot-picker.png' });

    const text = await checkTwin(page, 'user_text_data', 'tx_', 'Text');
    expect(text.foundMount, "text's own mount at prefix 'tx_' (copied verbatim from index.html:832)").toBe(true);
    expect(text.built).toBe(true);
    expect(text.pickerCount).toBe(2);
    expect(text.stockRowVisible).toBe(false);
    expect(text.pathRowVisible).toBe(false);
    await page.screenshot({ path: 'test-results/t2371-text-picker.png' });
});

test('t2371: the flat-mode path_anchor fix also makes surfacing\'s own already-declared t2271 picker render for the first time', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);
    const surfacing = await checkTwin(page, 'user_surfacing_data', 'sf_', 'Surfacing');
    expect(surfacing.foundMount, "surfacing's own mount at prefix 'sf_' — declared since t2271, now actually rendering").toBe(true);
    expect(surfacing.built).toBe(true);
    expect(surfacing.pickerCount).toBe(2);
    expect(surfacing.stockRowVisible).toBe(false);
    expect(surfacing.pathRowVisible).toBe(false);
});

test('t2371: contour/slot/text field SETS are unchanged by the addition — only the picker is new', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);
    // A minimum-count sanity check (not a full reproduction ratchet — none of these three had one before this
    // turn either): stockAttach/pathDatum still exist as real bound fields (behind the picker, per above),
    // nothing about the geometry/tool/cut fields was touched by a form-only picker addition.
    for (const [opType, min] of [['user_contour_data', 25], ['user_slot_data', 25], ['user_text_data', 30]]) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        await page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), opType);
        await page.waitForSelector('#wiz_user', { state: 'visible', timeout: 8000 });
        await page.waitForTimeout(400);
        const r = await page.evaluate(() => {
            const root = document.querySelector('#wiz_user');
            const fields = [...root.querySelectorAll('[data-param]')].map((el) => el.dataset.param);
            return { fieldCount: fields.length, hasStockAttach: fields.includes('stockAttach'), hasPathDatum: fields.includes('pathDatum') };
        });
        expect(r.fieldCount, `${opType}: real field count, not an empty/broken form`).toBeGreaterThan(min);
        expect(r.hasStockAttach, `${opType}: stockAttach still bound`).toBe(true);
        expect(r.hasPathDatum, `${opType}: pathDatum still bound`).toBe(true);
    }
});
