import { test, expect } from '@playwright/test';

/**
 * t1623 — THE PALETTE BY ROLE (the t1572 ruling, landed): four groups on the EXISTING `category` axis —
 * Wizard Inputs / Wizard Layout / Wizard Previews / Wizard Shapes — with `Wizard Shapes` DECLARED AND EMPTY,
 * skipped at render by the general empty-group rule, so it appears BY ITSELF the day the first shape primitive
 * declares into it. The role lives ON the block def; the palette only reads it — no name list in the UI.
 *
 * Anti-drift: every membership assertion below derives the expected set from the REGISTRY (PALETTE defs by
 * category) and compares the TOOLBOX against it — the two can only agree by reading the same declaration.
 *
 * Bundled: the black inner-elbow wedge (user-circled) was the geras DARK PATH poking past the main path at a
 * statement mouth's inside corner — fixed by hiding .blocklyPathDark (the light highlight stays). The last test
 * pins the fix at the DOM (the crop pair in verification/ is the human evidence).
 */
test.use({ viewport: { width: 1600, height: 1000 } });

const boot = async (page) => {
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsEditWizardDef, null, { timeout: 60000 });
};

const toolboxGroups = () => async (pageEval) => pageEval;

test('FOUR role groups on the category axis — three populated (membership from the registry), Shapes declared + empty + absent', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const OPS = await import('/wizards/ops/index.js');
        const BR = await import('/blocks/blockly/bridge.js');
        const tb = BR.buildToolbox([]);
        const groups = {};
        (function walk(node) {
            if (Array.isArray(node)) return node.forEach(walk);
            if (node && node.kind === 'category') groups[node.name] = (node.contents || []).filter((c) => c.kind === 'block').map((c) => c.type).sort();
            if (node && node.contents) walk(node.contents);
        })(tb.contents);
        const byCat = {};
        for (const d of OPS.PALETTE.filter((x) => !x.hidden)) (byCat[d.category] ||= []).push(d.type);
        for (const k in byCat) byCat[k].sort();
        return { groups: Object.keys(groups), inputs: groups['Wizard Inputs'], layout: groups['Wizard Layout'], previews: groups['Wizard Previews'], byCat: { inputs: byCat['Wizard Inputs'], layout: byCat['Wizard Layout'], previews: byCat['Wizard Previews'], shapes: byCat['Wizard Shapes'] }, CATEGORIES: OPS.CATEGORIES };
    });
    // the four are DECLARED on the axis…
    for (const g of ['Wizard Inputs', 'Wizard Layout', 'Wizard Previews', 'Wizard Shapes']) {
        expect(r.CATEGORIES, `${g} is declared in CATEGORIES`).toContain(g);
    }
    // …the two OLD groups are gone from it (the regroup replaced them, not added beside them)
    expect(r.CATEGORIES).not.toContain('Wizard UI');
    expect(r.CATEGORIES).not.toContain('Wizard Form');
    expect(r.groups).not.toContain('Wizard UI');
    expect(r.groups).not.toContain('Wizard Form');
    // the three populated groups render, each holding EXACTLY the blocks whose defs declare that role
    expect(r.inputs, 'Wizard Inputs = the defs that declare it').toEqual(r.byCat.inputs);
    expect(r.layout, 'Wizard Layout = the defs that declare it').toEqual(r.byCat.layout);
    expect(r.previews, 'Wizard Previews = the defs that declare it').toEqual(r.byCat.previews);
    // sanity on the ruled shape: the named anchors sit where the ruling put them
    expect(r.inputs).toEqual(expect.arrayContaining(['formfield', 'param', 'form_dropdown', 'coordlist', 'slider_field', 'param_field', 'param_group']));
    // (opunit also declares Wizard Layout but is palette-hidden by design — created programmatically at fork/load-wrap)
    expect(r.layout).toEqual(expect.arrayContaining(['user_root', 'section', 'group_box', 'split_horizontal', 'layoutwidget', 'layout_2d_canvas']));
    expect(r.previews).toEqual(expect.arrayContaining(['sim', 'sim_3d_box', 'simstart', 'panel', 'code_preview_panel', 'form_diagram']));
    // Shapes: nothing declares it, so it must NOT render — the general empty-group skip, not a special case
    expect(r.byCat.shapes, 'no def declares Wizard Shapes yet').toBeUndefined();
    expect(r.groups, 'the declared-but-empty group is skipped at render').not.toContain('Wizard Shapes');
});

test('AUTO-APPEAR — the first def declaring Wizard Shapes makes the group render; removing it makes it vanish', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const OPS = await import('/wizards/ops/index.js');
        const BR = await import('/blocks/blockly/bridge.js');
        const names = (tb) => {
            const out = [];
            (function walk(node) {
                if (Array.isArray(node)) return node.forEach(walk);
                if (node && node.kind === 'category') out.push(node.name);
                if (node && node.contents) walk(node.contents);
            })(tb.contents);
            return out;
        };
        const inGroup = (tb, group, type) => {
            let found = false;
            (function walk(node, parent) {
                if (Array.isArray(node)) return node.forEach((n) => walk(n, parent));
                if (node && node.kind === 'block' && node.type === type && parent === group) found = true;
                if (node && node.contents) walk(node.contents, node.name || parent);
            })(tb.contents, null);
            return found;
        };
        const SYNTH = { type: '__shape_pilot__', label: 'shape pilot', category: 'Wizard Shapes', kind: 'leaf', defaults: {}, fields: [], emit: () => [] };
        const before = names(BR.buildToolbox([]));
        OPS.PALETTE.push(SYNTH);
        let withShape, landsInShapes;
        try {
            const tb = BR.buildToolbox([]);
            withShape = names(tb);
            landsInShapes = inGroup(tb, 'Wizard Shapes', SYNTH.type);
        } finally { OPS.PALETTE.splice(OPS.PALETTE.indexOf(SYNTH), 1); }
        const after = names(BR.buildToolbox([]));
        return { before, withShape, landsInShapes, after, uncat: BR.UNCATEGORISED };
    });
    expect(r.before, 'empty → absent').not.toContain('Wizard Shapes');
    expect(r.withShape, 'the FIRST declaring def makes the group appear, by itself').toContain('Wizard Shapes');
    expect(r.landsInShapes, 'and the block lands IN it, not in the catch-all — the declaration is live, not rotting').toBe(true);
    expect(r.after, 'removing the def removes the group again').not.toContain('Wizard Shapes');
});

test('ONE COLOUR PER ROLE — the inputs family shares a colour; layout keeps the authoring fuchsia; they differ', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 60000 });
    const r = await page.evaluate(() => {
        const ws = window.__blkws;
        const mk = (t) => { const b = ws.newBlock(t); const c = b.getColour(); b.dispose(); return c; };
        return { formfield: mk('formfield'), paramField: mk('param_field'), paramGroup: mk('param_group'), userRoot: mk('user_root'), sim: mk('sim') };
    });
    expect(r.paramField, 'param_field joins the inputs family colour').toBe(r.formfield);
    expect(r.paramGroup, 'param_group too — the t1105 split dissolves under the role axis').toBe(r.formfield);
    expect(r.userRoot, 'layout is its own colour').not.toBe(r.formfield);
    expect(r.sim, 'previews are their own colour').not.toBe(r.formfield);
    expect(r.sim).not.toBe(r.userRoot);
});

test('THE INNER-ELBOW FIX — the geras dark path is hidden (the black wedge at a mouth’s inside corner)', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 60000 });
    await page.evaluate(() => window.ddcsEditWizardDef('user_pause_confirm'));
    await page.waitForFunction(() => window.__blkws.getAllBlocks().length > 3, null, { timeout: 60000 });
    const r = await page.evaluate(() => {
        const els = [...document.querySelectorAll('.blocklyPathDark')];
        return { count: els.length, anyVisible: els.some((e) => getComputedStyle(e).display !== 'none') };
    });
    expect(r.count, 'geras still renders its dark paths (we hide, not patch the renderer)').toBeGreaterThan(0);
    expect(r.anyVisible, 'and every one of them is display:none — no black wedge at any inner elbow').toBe(false);
});
