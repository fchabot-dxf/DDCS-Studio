// tests/support/classicFixture.js
//
// t2629 (BACKLOG #71/#72) — a permanently-classic (non-tree) synthetic op, registered fresh on the page, for
// any test that needs "some op that stays classic-rendered" as a stable subject rather than borrowing a real
// production op whose migration status can change under it. That borrowing is the exact class of regression
// this file exists to close: pane-sizer-1353/pane-sizer-mobile-1468/open-as-modal-1625/pane-visual-host-1760/
// pane-visual-host-programmatic-1762/polish-batch-1239/wizard-sticky-preview all picked a real op (surfacing,
// then pocket, then corner) as their subject for exactly this reason, and broke a second time each time that
// op migrated onto the declared group_box tree. `passes-field-1613.spec.js` (t2625) proved the fix for the
// SAME disease on a different mechanism (the Blocks-tab canvas write-back): a synthetic def registered live on
// the page, through the exact `registerUserOp` path every real twin boots through, so its DOM shape is
// mechanically identical to a real classic op's — just never migrated, on purpose, forever.
//
// `panel: 'form3d+2d'` (not 'form', which passes-field-1613's own fixture used) is the one thing that matters
// here: userOpView.js's classic (non-tree) render() branch builds the SHARED `.wiz-2pane`/`.wiz-visual`/
// `.viz-pane-sizer` chrome OUTSIDE the op's own uiChildren, driven by `def.panel` alone — so a bare `sim` node
// (no `split_horizontal`) plus this panel value is sufficient to reproduce that chrome exactly, without
// depending on any single field or binding beyond the two below (depth/stepdown, matching passes-field-1613's
// own minimal shape).
// t2629 — `createUserOp` (persists to localStorage's `ddcs_user_ops`, THEN calls `registerUserOp` for the live
// registry), not the bare `registerUserOp` alone: `window.openWiz`/`wizardManager.open()`'s own code path
// resolves the def via `listUserOps().find(...)`, which reads the PERSISTED store (`readStore()`), not the
// live-only `USER_DEFS` map `registerUserOp` alone populates — measured live, not assumed (a bare
// `registerUserOp` call left `window.openWiz` opening an EMPTY, hidden form; `listUserOps().find(...)`
// returned nothing until `createUserOp` was used instead). Persisting is also what makes the fixture survive a
// `page.reload()` mid-test (a real app boot re-registers every persisted op live — `web/blocks/userOps.js`'s
// own `for (const def of listUserOps()) registerUserOp(def)` loop), which several of this helper's own callers
// need (pane-sizer-1353's own "a PERSISTED oversize heals on open" reloads and reopens the same twin).
// IDEMPOTENT: a second call in the same test (e.g. after that same reload) skips creation if the fixture is
// already in the persisted store, rather than hitting createUserOp's own "already exists" throw.
export async function registerClassicFixture(page, slug = 'classic_fixture_2629') {
    return page.evaluate(async (slug) => {
        const U = await import('/blocks/userOps.js');
        const opType = slug.startsWith('user_') ? slug : 'user_' + slug;
        if (U.listUserOps().some((d) => d.opType === opType)) return opType;
        const { deriveBindingsFor } = await import('/blocks/dataOps/deriveBindings.js');
        const stack = [{ type: 'stepdown', params: { to: 4, by: 1.5, confirmEvery: 0 }, children: [] }];
        const template = [{
            type: 'user_root', params: {},
            uiChildren: [
                { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
                { type: 'param_group', params: { group: 'Fixture' }, children: [] },
            ],
            children: stack,
        }];
        const specs = [
            { param: 'depth', match: { type: 'stepdown' }, key: 'to', type: 'number', default: 4, label: 'Depth' },
            { param: 'stepdown', match: { type: 'stepdown' }, key: 'by', type: 'number', default: 1.5, label: 'Step Down' },
        ];
        // blockIndex must derive against the FULL wrapped template (flattenBlocks walks user_root itself +
        // uiChildren before children) — the same t2595/t2625 gotcha, not the bare body array.
        const bindings = deriveBindingsFor(template, specs);
        const def = U.userOpFromStack(slug, 'Classic Fixture (test)', template, bindings, 'form3d+2d', null, 'test');
        U.createUserOp(def);
        return def.opType;
    }, slug);
}
