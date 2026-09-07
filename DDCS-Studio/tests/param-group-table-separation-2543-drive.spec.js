import { test, expect } from '@playwright/test';

/**
 * t2543 (BACKLOG #71 owner ruling) — SEPARATE THE SLOT. See the sibling
 * tests/node/param-group-table-separation-2543.test.mjs for the `materializeParamGroup` test (pure, moved to
 * the node tier at tier-migration work package B) and its own full header comment on the fix.
 *
 * The test below stays here — it builds and queries a real DOM tree
 * (`document.createElement`+`querySelectorAll('[data-param]')`/`querySelectorAll('.unwired-block')`), which
 * the node tier's structural-only `document` stub cannot support (querySelector/All always answer null/[]
 * regardless of what was appended).
 */

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
