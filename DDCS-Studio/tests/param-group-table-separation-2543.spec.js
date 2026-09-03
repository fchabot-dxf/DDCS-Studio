import { test, expect } from '@playwright/test';

/**
 * t2543 (BACKLOG #71 owner ruling) — SEPARATE THE SLOT: `param_group.children` used to be shared by two
 * incompatible owners — `renderUiTree`'s own transparent form-layout branch (t1605) and
 * `materializeParamGroup`'s own flat `param_field` canvas-materialization target (S5.3). A twin declaring
 * `group_box`/`field_ref` nodes in `param_group.children` (the authorability-sweep migration, BACKLOG #72)
 * made materialize's own idempotency guard (`children.length > 0` ⇒ "already materialized") false-positive;
 * tightening the guard instead made materialize OVERWRITE the declared structure outright (t2531, reverted).
 *
 * THE FIX: materialize now targets its OWN node, `param_table` (mirroring `materializeCamTable`'s own
 * `cam_table`, found by TYPE alone) — never reads, never writes, a twin's own `param_group` node. This is the
 * CANARY + PROOF file for the separation: t2531's own two real failures stay green (their own spec files,
 * unmodified, are the canary — asserted again here isn't needed, they ARE the regression test), and THIS file
 * proves the previously-impossible case directly: a twin declaring group_box nodes in `param_group.children`
 * now materializes cleanly, its own declared structure completely undisturbed.
 *
 * Per this turn's own explicit scope, NO real twin file is migrated — this builds a throwaway `def` object
 * only, demonstrating the mechanism without shipping it.
 */

test('materializeParamGroup targets param_table exclusively -- a group_box-declaring param_group survives byte-identical', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        // A minimal def carrying the shape t2531 tried and reverted: param_group.children holds a group_box
        // (the declarative tree-layout structure), never touched by materialize. NOTE: this group_box wraps
        // usage_text, not field_ref -- a group_box wrapping field_ref rows for width/height would make THESE
        // SAME bindings already row-placed by declaration, which (see userOps.js's own field_ref skip, added
        // this same turn for drill-parity, t2299) correctly means materialize SKIPS them entirely, same as
        // drill -- that is a DIFFERENT, already-covered case (see the drillSame precedent). This scenario
        // demonstrates the other half: a group_box for LAYOUT/informational content coexisting with param_table
        // materializing the (separately, undeclared-in-the-tree) value bindings -- true two-owner separation.
        const groupBoxChildren = [
            { type: 'group_box', params: { title: 'GEOMETRY' }, children: [
                { type: 'usage_text', params: { text: 'Set the panel geometry below.' } },
            ] },
        ];
        const def = {
            opType: 'user_t2543_pilot',
            template: [{
                type: 'user_root', params: {},
                uiChildren: [
                    { type: 'param_group', params: { group: 'Test' }, children: groupBoxChildren },
                ],
                children: [
                    { type: 'progstart', params: { rpm: 12000, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
                ],
            }],
            bindings: [
                { param: 'width', type: 'number', blockIndex: 0, key: 'rpm', default: 100, label: 'Width' },
                { param: 'height', type: 'number', blockIndex: 0, key: 'rpm', default: 80, label: 'Height' },
            ],
        };
        // NOTE: flattenBlocks (called internally by materializeParamGroup) tags every block it walks with a
        // pre-existing, UNRELATED `_group` tracking property as a side effect (cam_table's own grouping
        // mechanism) -- strip it from both sides so the comparison is about STRUCTURAL content, not this
        // pre-existing annotation's own presence/absence depending on when flattenBlocks last ran.
        const stripGroup = (n) => JSON.parse(JSON.stringify(n), (k, v) => (k === '_group' ? undefined : v));
        const before = stripGroup(def.template[0].uiChildren.find((n) => n.type === 'param_group').children);

        U.materializeParamGroup(def);

        const root = def.template.find((b) => b.type === 'user_root');
        const paramGroup = root.uiChildren.find((n) => n.type === 'param_group');
        const paramTable = root.uiChildren.find((n) => n.type === 'param_table');
        const after = paramGroup ? stripGroup(paramGroup.children) : null;

        // idempotency: calling a second time must not double-inject or touch anything further
        const uiChildrenCountBefore = root.uiChildren.length;
        U.materializeParamGroup(def);
        const uiChildrenCountAfter = root.uiChildren.length;

        return {
            before, after,
            hasParamTable: !!paramTable,
            paramTableChildCount: paramTable ? paramTable.children.length : 0,
            paramTableFieldParams: paramTable ? paramTable.children.map((c) => c.params.param) : [],
            uiChildrenCountBefore, uiChildrenCountAfter,
        };
    });

    expect(r.after, "param_group's own declared group_box structure is COMPLETELY UNTOUCHED by materialize").toEqual(r.before);
    expect(r.hasParamTable, 'a separate param_table node was injected').toBe(true);
    expect(r.paramTableChildCount, 'one param_field per value binding').toBe(2);
    expect(r.paramTableFieldParams.sort()).toEqual(['height', 'width']);
    expect(r.uiChildrenCountBefore, 'idempotent: a second call injects nothing further').toBe(r.uiChildrenCountAfter);
});

test('renderUiTree renders the group_box structure from param_group AND ignores a param_table sibling entirely -- both owners read their own slot, live', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const FW = await import('/ui/formWidgets.js');
        // Hand-built, not run through materializeParamGroup: a group_box/field_ref structure (drill's own
        // shape) side by side with a param_table (the shape materialize produces for a DIFFERENT def that has
        // no field_ref coverage, per test 1 above) -- this isolates the RENDER contract (can the two node
        // types coexist under one root without either corrupting the other) from materialize's OWN decision
        // of when to produce that combination, which is a separate concern already covered by test 1's own
        // field_ref-skip assertion and the drillSame precedent (cam-block-native-params-s52.spec.js).
        const uiChildren = [
            { type: 'param_group', params: { group: 'Test' }, children: [
                { type: 'group_box', params: { title: 'GEOMETRY' }, children: [
                    { type: 'field_ref', params: { param: 'width' } },
                    { type: 'field_ref', params: { param: 'height' } },
                ] },
            ] },
            { type: 'param_table', params: { group: 'Settings' }, children: [
                { type: 'param_field', params: { param: 'feed', label: 'Feed', widget: 'number', type: 'number', dflt: '200', units: '', nmin: '', nmax: '', nstep: '', section: '', help: '', options: '' } },
            ] },
        ];
        const bindings = [
            { param: 'width', type: 'number', blockIndex: 0, key: 'rpm', default: 100, label: 'Width' },
            { param: 'height', type: 'number', blockIndex: 0, key: 'rpm', default: 80, label: 'Height' },
            { param: 'feed', type: 'number', blockIndex: 0, key: 'rpm', default: 200, label: 'Feed' },
        ];

        // field_ref RELOCATES an already-rendered row (formWidgets.js:1516) -- it needs byParam pre-populated
        // by the flat render, same as every other renderUiTree(...) caller (userOpView.js's own render()).
        const flatHost = document.createElement('div');
        document.body.appendChild(flatHost);
        const readers = FW.renderOpForm(flatHost, bindings) || [];
        const byParam = {};
        flatHost.querySelectorAll('[data-param]').forEach((inp, idx) => { byParam[inp.dataset.param] = { row: inp.closest('.form-row'), read: readers[idx] }; });

        const treeHost = document.createElement('div');
        document.body.appendChild(treeHost);
        FW.renderUiTree(treeHost, uiChildren, bindings, byParam, null, null);

        const treeRows = [...treeHost.querySelectorAll('[data-param]')].map((el) => el.dataset.param);
        const unwiredTypes = [...treeHost.querySelectorAll('.unwired-block')].map((el) => el.dataset.blockType);

        flatHost.remove(); treeHost.remove();
        return { treeRows, unwiredTypes };
    });

    // width/height are placed BY the group_box's own field_ref rows, in its declared order; feed has no tree
    // placement at all (param_table is a canvas-only no-op, never a form-tree placement node) so it surfaces
    // via the orphan-net fallback -- appearing exactly ONCE, never doubled, never dropped.
    expect(r.treeRows, 'group_box places width/height; feed reaches the form via the orphan net, not param_table').toEqual(['width', 'height', 'feed']);
    expect(r.unwiredTypes, 'param_table renders as a silent no-op, never an unwired-placeholder').not.toContain('param_table');
});
