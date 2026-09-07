import { test, expect } from './support/harness.mjs';

/**
 * t2543 (BACKLOG #71 owner ruling) — SEPARATE THE SLOT: `param_group.children` used to be shared by two
 * incompatible owners — `renderUiTree`'s own transparent form-layout branch (t1605) and
 * `materializeParamGroup`'s own flat `param_field` canvas-materialization target (S5.3). A twin declaring
 * `group_box`/`field_ref` nodes in `param_group.children` (the authorability-sweep migration, BACKLOG #72)
 * made materialize's own idempotency guard (`children.length > 0` ⇒ "already materialized") false-positive;
 * tightening the guard instead made materialize OVERWRITE the declared structure outright (t2531, reverted).
 *
 * THE FIX: materialize now targets its OWN node, `param_table` (mirroring `materializeCamTable`'s own
 * `cam_table`, found by TYPE alone) — never reads, never writes, a twin's own `param_group` node. See the
 * sibling tests/param-group-table-separation-2543-drive.spec.js for the second test (`renderUiTree` render
 * contract, built + queried on a real DOM tree) and its own full header comment.
 *
 * Per this turn's own explicit scope, NO real twin file is migrated — this builds a throwaway `def` object
 * only, demonstrating the mechanism without shipping it.
 *
 * TIER MIGRATION WORK PACKAGE B: split out of tests/param-group-table-separation-2543.spec.js — this is the
 * ONE test in that 2-test file with zero DOM construction (`U.materializeParamGroup` mutates a plain `def`
 * object, no `document.createElement`/`querySelectorAll`).
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
