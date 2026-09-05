import { test, expect } from '@playwright/test';
import { waitReady } from './_boot.js';

/**
 * t2641 (BACKLOG #71/#72) — userOps.js's usesTreeOnlyLayout is now the ONE declared source both userOpView.js's
 * hasTreeLayout (the render-path decision: renderUiTree vs renderOpForm, and which DOM container-id scheme —
 * bare vs `_tree`-suffixed — the rest of userOpView.js's update() reads off it) and blocksApp.js's checkLayoutNodes
 * (a DIFFERENT, coarser "is this canvas state a wizard face at all" decision) build on, instead of independently
 * hand-copying the same two foundational types (split_horizontal/split_vertical) and silently drifting (t2633
 * census item 3).
 *
 * ⚠ THE FIRST VERSION OF THIS FIX WAS WRONG, caught by the REQUIRED full suite this same turn (25 failed specs)
 * and reverted before landing — see userOps.js's own header comment on usesTreeOnlyLayout for the full account.
 * It widened the trigger set to include preview3d/sim/feature_canvas (among others), reasoning that renderOpForm
 * has no way to draw a visualization pane — true, but userOpView.js's own update() draws those through a
 * completely SEPARATE, already-working panelType(_def.panel)-driven pipeline, independent of uiChildren node
 * types entirely. Forcing tree mode flipped the DOM container ids these ops' own tests (and real behavior)
 * depend on. The tests below pin the CORRECTED (== original, byte-identical) behavior, not the broken one.
 */
test('usesTreeOnlyLayout: ONLY split_horizontal/split_vertical trigger it — a bare feature_canvas/sim/preview3d does NOT (they have a working flat-mode equivalent)', async ({ page }) => {
    await page.goto('/', { timeout: 60000 });
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
    const r = await page.evaluate(async () => {
        const { usesTreeOnlyLayout } = await import('/blocks/userOps.js');
        const noSplit = [
            { type: 'param_group', params: { group: 'Settings' }, uiChildren: [{ type: 'field_ref', params: { param: 'radius' } }] },
            { type: 'feature_canvas', uiChildren: [{ type: 'point_handle', params: { param: 'radius' } }] },
            { type: 'sim' },
            { type: 'preview3d' },
        ];
        const withSplit = [{ type: 'split_horizontal', uiChildren: { LEFT: [{ type: 'sim' }], RIGHT: [] } }];
        return { noSplit: usesTreeOnlyLayout(noSplit), withSplit: usesTreeOnlyLayout(withSplit) };
    });
    expect(r.noSplit, 'feature_canvas/sim/preview3d alone must NOT force tree mode — panelType already renders them flat').toBe(false);
    expect(r.withSplit, 'an explicit split still forces tree mode — the one case with no flat equivalent at all').toBe(true);
});

test('an ordinary field-only form (field_ref/formfield/param_group/group_box/section, no split) stays FLAT', async ({ page }) => {
    await page.goto('/', { timeout: 60000 });
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
    const r = await page.evaluate(async () => {
        const { usesTreeOnlyLayout } = await import('/blocks/userOps.js');
        const uiChildren = [
            { type: 'section', params: { title: 'GEOMETRY' }, uiChildren: [
                { type: 'group_box', params: { title: 'Settings' }, uiChildren: [
                    { type: 'field_ref', params: { param: 'x' } },
                    { type: 'formfield', params: { param: 'y' } },
                ] },
                { type: 'param_group', params: { group: 'Cut' }, uiChildren: [
                    { type: 'param_field', params: { param: 'feed' } },
                ] },
            ] },
        ];
        return usesTreeOnlyLayout(uiChildren);
    });
    expect(r, 'ordinary bound rows never need the tree renderer — they render via formBindings() regardless of nesting').toBe(false);
});

test('a top-level bare path_anchor (no split/viz sibling) stays FLAT — the t2371 mountFlatPathAnchor exemption is preserved', async ({ page }) => {
    await page.goto('/', { timeout: 60000 });
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
    const r = await page.evaluate(async () => {
        const { usesTreeOnlyLayout } = await import('/blocks/userOps.js');
        const uiChildren = [{ type: 'path_anchor', params: { prefix: '' } }];
        return usesTreeOnlyLayout(uiChildren);
    });
    expect(r, 'path_anchor alone must not force tree mode — see findTopLevelPathAnchor/mountFlatPathAnchor (t2371)').toBe(false);
});

test('all 32 shipped ops: usesTreeOnlyLayout and blocksApp.js\'s composed checkLayoutNodes reproduce the ORIGINAL hasTreeLayout (2-type) and checkLayoutNodes (9-type) results exactly', async ({ page }) => {
    await page.goto('/', { timeout: 60000 });
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
    const r = await page.evaluate(async () => {
        const { childrenOf, usesTreeOnlyLayout } = await import('/blocks/userOps.js');
        const { SEED_BUILDERS } = await import('/app.js');
        const ORIGINAL_HAS_TREE = new Set(['split_horizontal', 'split_vertical']);
        const ORIGINAL_CHECK_LAYOUT = new Set(['split_horizontal', 'split_vertical', 'grid_container', 'tab_group', 'group_box', 'section', 'sim', 'preview3d', 'feature_canvas']);
        function walk(nodes, set) {
            for (const n of childrenOf(nodes)) {
                if (!n) continue;
                if (set.has(n.type)) return true;
                if (n.children && walk(n.children, set)) return true;
                if (n.uiChildren && walk(n.uiChildren, set)) return true;
            }
            return false;
        }
        const rows = [];
        for (const fn of SEED_BUILDERS) {
            const def = fn();
            const root = Array.isArray(def.template) ? def.template.find((b) => b && b.type === 'user_root') : null;
            const uiChildren = (root && root.uiChildren) || [];
            rows.push({
                opType: def.opType,
                originalHasTree: uiChildren.length > 0 && walk(uiChildren, ORIGINAL_HAS_TREE),
                originalCheckLayout: walk(uiChildren, ORIGINAL_CHECK_LAYOUT),
                freshHasTree: uiChildren.length > 0 && usesTreeOnlyLayout(uiChildren),
                freshCheckLayout: usesTreeOnlyLayout(uiChildren) || walk(uiChildren, new Set(['grid_container', 'tab_group', 'group_box', 'section', 'sim', 'preview3d', 'feature_canvas'])),
            });
        }
        return rows;
    });
    expect(r.length, 'the full shipped set').toBe(32);
    for (const row of r) {
        expect(row.freshHasTree, `${row.opType}: usesTreeOnlyLayout matches the original hasTreeLayout result`).toBe(row.originalHasTree);
        expect(row.freshCheckLayout, `${row.opType}: blocksApp.js's composed checkLayoutNodes matches the original result`).toBe(row.originalCheckLayout);
    }
});
