import { test, expect } from '@playwright/test';

/**
 * t2545 (BACKLOG #71/#72) — THE REAL ACCEPTANCE QUESTION, per the dispatch's own framing: not just "does
 * surfacing render identically today" (proven by surfacing-form-reproduction-2377.spec.js's own row-diff,
 * switched to `mode:'tree'` this same turn), but CAN THE ROWS BE REORDERED WITHOUT THE GROUPING BREAKING —
 * because that is the actual defect class `section:` string tags carry and `group_box` containment does not.
 *
 * Measured directly (not assumed) before writing this: `renderOpForm`'s own section-box creation
 * (`ensureSec`, formWidgets.js) is NAME-KEYED (a `secEls[s]` map, reused across non-adjacent same-name
 * bindings) — a bare interleave-and-reassemble of `def.bindings` does NOT fragment section MEMBERSHIP the way
 * a naive "contiguous run" description would suggest. What genuinely IS array-order-hostage is section BOX
 * ORDER: `secList` (and therefore which box gets appended to the DOM first) is built by first-seen-order
 * over `def.bindings` — reorder the array, and the FLAT render's own section order reorders right along with
 * it, silently, with no declaration anywhere stating "AREA comes first." (surfacingData.js's own t2377
 * comment names this exact property — "formWidgets.js's own first-seen-wins section-box order" — as the
 * reason SURFACING_BINDING_SPECS had to be hand-ordered correctly in the first place.) The declared
 * `group_box` tree has no such hostage relationship: its own order is FOUR EXPLICIT NODES, written once,
 * inside `buildSurfacingTwinStack()` — reordering `def.bindings` cannot touch it, by construction, not by
 * care.
 *
 * REVERSING `def.bindings` (not a random shuffle — the strongest, most legible reordering) isolates exactly
 * this: field-to-section MEMBERSHIP is untouched either way (each field still carries its own `.section`
 * string, wherever it sits in the array), but the FLAT renderer's own section-box ORDER inverts to match,
 * while the TREE renderer's stays exactly AREA -> TOOL -> TOOL & STEPOVER -> DEPTH & FEED regardless.
 */

test('surfacing section ORDER is array-position-hostage under FLAT rendering, but NOT under the declared group_box tree', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);

    const r = await page.evaluate(async () => {
        const dd = await import('/blocks/dataOps/surfacingData.js');
        const { renderOpForm, renderUiTree, formBindings } = await import('/ui/formWidgets.js');
        const def = dd.surfacingDataDef();
        const binds = formBindings(def);
        const reversed = [...binds].reverse();   // membership (b.section) is per-field, untouched by array position

        const flatHost = document.createElement('div');
        document.body.appendChild(flatHost);
        renderOpForm(flatHost, reversed);
        const flatSecOrder = [...flatHost.querySelectorAll('.form-sec')].map((el) => el.dataset.section);
        const flatMembership = Object.fromEntries(
            [...flatHost.querySelectorAll('.form-sec')].map((el) => [el.dataset.section, [...el.querySelectorAll('[data-param]')].map((f) => f.dataset.param).sort()])
        );

        // TREE render, over the SAME reversed array — renderUiTree needs byParam (a flat render's own rows,
        // same convention every other reproduction test in this repo uses).
        const userRoot = def.template.find((b) => b && b.type === 'user_root');
        const tempHost = document.createElement('div');
        const readersFlat = renderOpForm(tempHost, reversed) || [];
        const byParam = {};
        tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
            const row = inp.closest('.form-row, .grid-2, .grid-3') || inp.parentElement;
            byParam[inp.dataset.param] = { row, read: readersFlat[idx] || (() => ({})) };
        });
        const treeHost = document.createElement('div');
        document.body.appendChild(treeHost);
        const readers = renderUiTree(treeHost, userRoot.uiChildren, reversed, byParam);
        const treeSecOrder = [...treeHost.querySelectorAll('.form-sec')].map((el) => el.dataset.section);
        const treeMembership = Object.fromEntries(
            [...treeHost.querySelectorAll('.form-sec')].map((el) => [el.dataset.section, [...el.querySelectorAll('[data-param]')].map((f) => f.dataset.param).sort()])
        );

        return { flatSecOrder, flatMembership, treeSecOrder, treeMembership, orphanCount: readers.orphanCount, forwardOrder: [...new Set(binds.map((b) => b.section))] };
    });

    // FLAT: reversing the bindings array reverses the section-box ORDER right along with it — array-position-hostage.
    expect(r.flatSecOrder, 'FLAT section-box order follows the (now-reversed) array\'s own first-seen order').toEqual([...r.forwardOrder].reverse());
    // TREE: the declared group_box order is UNCHANGED — AREA leads regardless of def.bindings' own array order.
    expect(r.treeSecOrder, 'the declared group_box order survives the reversal untouched').toEqual(r.forwardOrder);
    expect(r.treeSecOrder, 'and matches the real, expected AREA -> TOOL -> TOOL & STEPOVER -> DEPTH & FEED order').toEqual(['AREA', 'TOOL', 'TOOL & STEPOVER', 'DEPTH & FEED']);

    // Membership itself (which fields land in which box) is identical either way, reversal or not — the four
    // groups contain exactly the same rows regardless of which rendering path or array order produced them.
    expect(r.treeMembership, 'field-to-section membership is identical between FLAT and TREE, even reversed').toEqual(r.flatMembership);
    expect(r.orphanCount, 'every field is explicitly placed by its own field_ref — nothing falls to the orphan net').toBe(0);
});
