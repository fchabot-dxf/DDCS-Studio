import { test, expect } from '@playwright/test';
import { waitReady } from './_boot.js';

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
    // t2351 — the app's own declared "everything is wired" signal (t1279), not a hand-picked global subset —
    // see wizard-face-1599's own boot() for the full trace of why this class of wait was silently racy.
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
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
    expect(r.layout).toEqual(expect.arrayContaining(['user_root', 'section', 'group_box', 'split_horizontal', 'layoutwidget']));
    // t2507 — layout_2d_canvas deleted (BACKLOG #61 L7: wired but never useful, see ARCHITECTURE.md's own
    // corrected finding); layout's anchor set shrinks with it, same registry-derived membership check either way.
    // t1734 — sim_3d_box / code_preview_panel deleted (dead containers, zero readers); previews' anchor set shrinks
    // with them, same membership-from-the-registry check either way.
    expect(r.previews).toEqual(expect.arrayContaining(['sim', 'simstart', 'panel', 'form_diagram']));
    // t1627 — Wizard Shapes has its CONTENTS now (the four primitives): the group renders, membership from the registry
    expect(r.byCat.shapes, 'the four shape primitives declare the group').toEqual(['shape_circle', 'shape_line', 'shape_marker', 'shape_rect']);
    expect(r.groups, 'the once-empty group now renders — the auto-appear this spec was holding the door for').toContain('Wizard Shapes');
});

test('THE EMPTY-GROUP SKIP, pinned by INVERSION — remove every member and the group vanishes; restore and it returns', async ({ page }) => {
    // t1627 — the original auto-appear claim ("the first declaring def makes the empty group render") is FULFILLED:
    // the four shipped primitives populate Wizard Shapes now, so "empty → absent" is no longer this registry's state.
    // The MECHANISM it pinned (a declared category with no members renders nothing — generally, not specially) is
    // still the thing that must not rot, so the same test runs INVERTED: strip the four out, the group goes; put
    // them back, it returns with its members in place.
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
        const before = names(BR.buildToolbox([]));
        const pulled = [];
        for (let i = OPS.PALETTE.length - 1; i >= 0; i--) {
            if (OPS.PALETTE[i] && OPS.PALETTE[i].category === 'Wizard Shapes') pulled.unshift(...OPS.PALETTE.splice(i, 1));
        }
        let emptied;
        try { emptied = names(BR.buildToolbox([])); } finally { OPS.PALETTE.push(...pulled); }
        const restored = names(BR.buildToolbox([]));
        return { before, emptied, restored, pulledCount: pulled.length };
    });
    expect(r.pulledCount, 'the four shipped primitives were the members pulled').toBe(4);
    expect(r.before, 'populated → present').toContain('Wizard Shapes');
    expect(r.emptied, 'no members → the declared group is skipped at render (the general rule, still alive)').not.toContain('Wizard Shapes');
    expect(r.restored, 'members back → the group returns').toContain('Wizard Shapes');
});

test('ONE COLOUR PER ROLE — the inputs family shares a colour; layout keeps the authoring fuchsia; they differ', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await waitReady(page, () => !!window.__blkws);
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
    await waitReady(page, () => !!window.__blkws);
    await page.evaluate(() => window.ddcsEditWizardDef('user_pause_confirm'));
    await waitReady(page, () => window.__blkws.getAllBlocks().length > 3);
    const r = await page.evaluate(() => {
        const els = [...document.querySelectorAll('.blocklyPathDark')];
        return { count: els.length, anyVisible: els.some((e) => getComputedStyle(e).display !== 'none') };
    });
    expect(r.count, 'geras still renders its dark paths (we hide, not patch the renderer)').toBeGreaterThan(0);
    expect(r.anyVisible, 'and every one of them is display:none — no black wedge at any inner elbow').toBe(false);
});
