import { test, expect } from '@playwright/test';

/**
 * t1561 — STEP 1: renderUiTree REFUSES an unknown block type instead of silently flattening it into the parent
 * container. The first version of this spec was written WHILE the three named containers (tab_group, group_box,
 * grid_container) were STILL unwired — that was the free, genuine non-vacuity proof the dispatch asked for: those
 * assertions were impossible to write honestly once step 2 wired them. Step 2 has now landed (same turn), so this
 * spec is RESTATED against types that are still genuinely unwired — group_box/grid_container/tab_group moved to
 * the "known, handled" side and are covered by ui-tree-layout-1561.spec.js instead. Restating here (rather than
 * leaving the old assertions to bit-rot green-by-coincidence) is what keeps this refusal mechanism's coverage from
 * silently eroding as more containers get wired later.
 *
 * The defect this closes: 35 blocks are declared category:'Wizard UI' in web/wizards/ops/; renderUiTree
 * (web/ui/formWidgets.js) explicitly handles only 7 node types. Every other type fell into a generic else branch
 * that traversed the unknown node's children straight into the PARENT — the container the author actually built
 * vanished with no trace, no error, nothing to diff against (unlike G-code, there is no factory dump to check a
 * wizard form against). A wizard author dragging in a tab_group got a flat form and no signal anything was wrong.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test.describe('STEP 1 (t1561) — unknown types get a visible placeholder, never a silent flatten', () => {
    test('a still-unwired form control (form_dropdown) renders a placeholder naming the type, not a silent flatten', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/ui/formWidgets.js');
            const host = document.createElement('div');
            const tree = [{ type: 'form_dropdown', params: { param: 'mode' } }];
            m.renderUiTree(host, tree, [], {});
            const ph = host.querySelector('.unwired-block');
            return { hasPlaceholder: !!ph, blockType: ph && ph.dataset.blockType, text: ph && ph.textContent };
        });
        expect(r.hasPlaceholder, 'a placeholder element exists for the unhandled type').toBe(true);
        expect(r.blockType).toBe('form_dropdown');
        expect(r.text).toContain('form_dropdown');
        expect(r.text, 'the placeholder uses the project\'s own "not wired yet" phrasing').toContain('not wired yet');
    });

    test('two unwired types together both placeholder, not just the first found', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/ui/formWidgets.js');
            const host = document.createElement('div');
            const tree = [
                // t1734 — the second entry was 'code_preview_panel' (a real, still-unwired viz box at t1561); that
                // block is now deleted outright (GAMEPLAN STEP 3), so a synthetic stand-in replaces it here, same
                // as the mouth-agnostic-fallback test below already does — this mechanism doesn't need a real block,
                // only a type renderUiTree's switch doesn't recognise, and a synthetic one can't go stale under it.
                { type: 'slider_field', params: { param: 'x' } },
                { type: 'future_viz_box_type', params: { title: 'Code' } },
            ];
            m.renderUiTree(host, tree, [], {});
            return [...host.querySelectorAll('.unwired-block')].map((el) => el.dataset.blockType);
        });
        expect(r.sort()).toEqual(['future_viz_box_type', 'slider_field']);
    });

    test('a NESTED unwired type under a NON-"DO" mouth name still loses nothing — the mouth-name-agnostic '
        + 'fallback, not just the .DO assumption every other branch gets to make. Uses synthetic types on purpose: '
        + 'every REAL block with a non-DO mouth (tab_group/TABS, split_*/LEFT-RIGHT-TOP-BOTTOM) is wired now, so '
        + 'this pins the generic mechanism itself rather than one real type that could get wired out from under it', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/ui/formWidgets.js');
            const host = document.createElement('div');
            const tree = [{
                type: 'future_container_type', params: {},
                children: { ITEMS: [{ type: 'future_item_type', params: {}, children: { DO: [] } }] },
            }];
            m.renderUiTree(host, tree, [], {});
            return [...host.querySelectorAll('.unwired-block')].map((el) => el.dataset.blockType);
        });
        // BOTH show — the outer placeholder, AND the nested one, proving the ITEMS-keyed child was actually
        // reached (not silently dropped the way a .DO-only assumption would have dropped it)
        expect(r).toEqual(['future_container_type', 'future_item_type']);
    });

    test('a KNOWN child nested inside a still-unwired container still renders — nothing lost, even without the container', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/ui/formWidgets.js');
            const host = document.createElement('div');
            const byParam = {
                foo: { row: (() => { const r = document.createElement('div'); r.className = 'probe-row'; r.textContent = 'foo-row'; return r; })(),
                    read: () => ({ foo: 1 }) },
            };
            const tree = [{ type: 'future_container_type', params: {}, children: { DO: [{ type: 'formfield', params: { param: 'foo' } }] } }];
            m.renderUiTree(host, tree, [], byParam);
            return { hasPlaceholder: !!host.querySelector('.unwired-block[data-block-type="future_container_type"]'),
                hasRow: !!host.querySelector('.probe-row') };
        });
        expect(r.hasPlaceholder).toBe(true);
        expect(r.hasRow, 'the formfield row nested inside the unwired container still made it into the form').toBe(true);
    });

    test('a KNOWN, already-handled type (section) never gets a placeholder', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/ui/formWidgets.js');
            const host = document.createElement('div');
            const tree = [{ type: 'section', params: { title: 'Geometry' }, children: [] }];
            m.renderUiTree(host, tree, [], {});
            return { hasPlaceholder: !!host.querySelector('.unwired-block'), hasSection: !!host.querySelector('.form-sec') };
        });
        expect(r.hasPlaceholder, 'a handled type never shows the unwired marker').toBe(false);
        expect(r.hasSection).toBe(true);
    });
});

test.describe('the orphan-row fallback is now OBSERVABLE (t1561)', () => {
    test('a well-formed tree that places every param leaves orphanCount at zero', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/ui/formWidgets.js');
            const host = document.createElement('div');
            const row = document.createElement('div'); row.className = 'form-row';
            const byParam = { foo: { row, read: () => ({ foo: 1 }) } };
            const tree = [{ type: 'formfield', params: { param: 'foo' } }];
            const readers = m.renderUiTree(host, tree, [], byParam);
            return { orphanCount: readers.orphanCount, readerCount: readers.length };
        });
        expect(r.orphanCount).toBe(0);
        expect(r.readerCount).toBe(1);
    });

    test('a param the tree never placed is caught by the fallback AND counted', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/ui/formWidgets.js');
            const host = document.createElement('div');
            const row = document.createElement('div'); row.className = 'form-row';
            const byParam = { orphan: { row, read: () => ({ orphan: 1 }) } };
            const readers = m.renderUiTree(host, [], [], byParam);   // empty tree — the row is never placed
            return { orphanCount: readers.orphanCount, inDom: !!host.querySelector('.form-row') };
        });
        expect(r.orphanCount, 'exactly one orphan row was caught and counted').toBe(1);
        expect(r.inDom, 'and it still made it into the DOM via the safety net').toBe(true);
    });
});
