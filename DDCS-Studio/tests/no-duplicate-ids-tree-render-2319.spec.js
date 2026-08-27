import { test, expect } from '@playwright/test';

/**
 * t2319 (BACKLOG #21's real root cause) — the guard t2317 found missing. `path_anchor`'s own formWidgets.js
 * branch used to stamp the OLD static shell's per-field id (`d_pathDatum`/`d_stockAttach`, index.html's own
 * hidden `<input>`) onto its tree-rendered row's input too — reproducing the CONVENTION, not just the widget's
 * behavior, so the shell's own always-present (whether opened or not) hidden markup and the tree's own row
 * ended up as TWO live elements sharing one id. `pathAnchorField.js`'s `buildPicker` (t2293) already prefers a
 * scoped `[data-param]` query whenever a non-`document` root is passed — which `path_anchor`'s own call to
 * `mountPathAnchor(prefix, container)` already does — so the id was never load-bearing for the tree path; only
 * stamping it was the hazard. Removed (not replaced) at t2319; this test is the guard that would have caught
 * it before a flip ever needed to find it live.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => !!window.ddcsGetBlockProgram, null, { timeout: 20000 });
};

test('a tree render carrying path_anchor produces NO duplicate DOM ids anywhere in the document', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const dd = await import('/blocks/dataOps/drillData.js');   // a real def with stockAttach/pathDatum bindings
        const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
        const def = dd.drillDataDef();

        const binds = formBindings(def);
        const tempHost = document.createElement('div');
        const readersFlat = renderOpForm(tempHost, binds) || [];
        const byParam = {};
        tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
            if (!inp || !inp.dataset || !inp.dataset.param) return;
            const row = inp.closest('.form-row') || inp.closest('.grid-2') || inp.parentElement;
            byParam[inp.dataset.param] = { row, read: readersFlat[idx] || (() => ({ [inp.dataset.param]: inp.value })) };
        });

        const host = document.createElement('div');
        document.body.appendChild(host);
        // a minimal tree exercising path_anchor under a split (the exact shape t2313/t2317/t2319 all drove) —
        // not drillData.js's own uiChildren (drill itself stays unflipped this turn), a synthetic tree built
        // the same way every prior gate-check in this arc has, so this test needs no source-file flip to run.
        renderUiTree(host, [{
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{ type: 'path_anchor', params: { prefix: 'd_' } }],
                RIGHT: [{ type: 'sim', params: {} }],
            },
        }], def.bindings || [], byParam);

        const allIds = [...document.querySelectorAll('[id]')].map((el) => el.id);
        const counts = {};
        for (const id of allIds) counts[id] = (counts[id] || 0) + 1;
        const dupes = Object.entries(counts).filter(([, n]) => n > 1);
        const paMount = host.querySelector('.pa-mount');
        // t2327 — this same split_horizontal('360px:*') shape, rendered at whatever viewport this test runs
        // at (no override — the project's own 412px default), is exactly what t2325 found pushed off-screen
        // before that turn's responsive-stacking fix. path_anchor sits on the FIXED-width LEFT pane, which
        // never goes off-screen regardless of the bug (a fixed pane always starts near x:0) — the RIGHT
        // (fill) pane's own content is what collapses and overflows, so the meaningful check is `sim`'s own
        // rendered container (`userVizContainer_tree`, RIGHT), not the path_anchor mount.
        const simContainer = document.getElementById('userVizContainer_tree');
        const r = simContainer ? simContainer.getBoundingClientRect() : null;
        return {
            dupes, paMountFound: !!paMount,
            simContainerFound: !!simContainer,
            simContainerOnScreen: !!(r && r.x >= 0 && r.x + r.width <= window.innerWidth),
        };
    });
    expect(r.paMountFound, 'the path anchor picker actually mounted').toBe(true);
    expect(r.dupes, `no duplicate ids anywhere in the document: ${JSON.stringify(r.dupes)}`).toEqual([]);
    expect(r.simContainerFound, 'the sim node\'s own container mounted').toBe(true);
    expect(r.simContainerOnScreen, 'the RIGHT (fill) pane renders within the visible viewport, not off past the right edge').toBe(true);
});
