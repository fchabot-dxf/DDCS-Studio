import { test, expect } from './support/harness.mjs';

/**
 * t1627 — THE FOUR SHAPE PRIMITIVES: `Wizard Shapes` gets its contents.
 *
 * The set is the FeatureCanvas's OWN item vocabulary (rect / circle / line / marker→hole — the four kinds it has
 * always drawn). The spec builder (layoutSpecFromOp) CONSUMES them from `def.template` by a GLOBAL, mouth-
 * agnostic flatten+filter (`SHAPE_2D_TYPES`) — never re-derives, and never cares what (if anything) nests them —
 * and every coordinate field takes a number OR an expression over the wizard's live params, evaluated by the ONE
 * evaluator (ops/expr.js, params as the caller-populated scope).
 *
 * Anti-drift: the numeric claims read layoutSpecFromOp's OWN output (the same items the canvas draws) and the
 * registry — never coordinates transcribed from a screenshot.
 *
 * TIER MIGRATION WORK PACKAGE B: split out of tests/wizard-shapes-1627.spec.js — these are the two tests in
 * that 3-test file whose assertions come entirely from `layoutSpecFromOp`'s plain returned data, with no
 * Blockly workspace or DOM read. The shared `boot(page)` helper (`window.showApp('blocks')` +
 * `window.__blkws` wait) is dropped for both — neither test's evaluate body ever touches the Blocks
 * workspace or the canvas SVG, so only `page.goto()` (which the node tier needs to publish
 * `window.ddcsGetSettings`) is kept. The third test (a real DO-mouth round-trip through a rendered Blockly
 * canvas + the "Open as modal" DOM chrome) stays in tests/wizard-shapes-1627-drive.spec.js.
 */

test('EXPRESSIONS over LIVE params — through the REAL registered path, and the value drives the drawing', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const P = await import('/wizards/ops/panelTypes.js');
        // the t1610 authoring shape: a formfield declares the knob (matched to an execution socket by var
        // identity) — bindingsToBlocks writes the block form, bindingsFromStack derives it back (one source).
        const specs = [{ param: 'width', type: 'number', default: 80, label: 'Width', match: { type: 'assign', var: '#1' }, key: 'value' }];
        const tpl = [{ type: 'user_root', params: {}, uiChildren: [
            { type: 'feature_canvas', params: { panel: 'form2d' } },
            { type: 'param_group', params: { group: 'Demo' }, children: U.bindingsToBlocks(specs) },
            { type: 'section', params: { title: 'Shapes' }, children: [
                { type: 'shape_circle', params: { cx: 'width / 2', cy: '60', dia: 'width / 4' } },
            ]},
        ], children: [{ type: 'assign', params: { var: '#1', value: 80 } }] }];
        // the REAL save path: registration derives the width binding from the formfield declaration itself
        // (passing bindingsFromStack's output TOO double-declares — registerUserOp re-derives from the template)
        const def = U.userOpFromStack('shape_expr_demo', 'Shape Expr Demo', tpl, [], 'form2d');
        U.createUserOp(def);
        const reg = U.getUserDef('user_shape_expr_demo');
        const at = (params) => {
            const c = P.layoutSpecFromOp(reg, params).items.find((i) => i.kind === 'circle' && i.r < 50);
            return c ? { cx: c.cx, r: c.r } : null;
        };
        return {
            binding: (reg.bindings || []).map((b) => b.param),
            atDefault: at({ width: 80 }),
            atWide: at({ width: 120 }),
        };
    });
    expect(r.binding, 'the formfield declaration became the binding (the real authoring path)').toContain('width');
    expect(r.atDefault, 'width 80 → cx = width/2 = 40, dia/2 = 10').toEqual({ cx: 40, r: 10 });
    expect(r.atWide, 'width 120 → the SAME declaration re-evaluates: cx 60, r 15 — params drive the drawing').toEqual({ cx: 60, r: 15 });
});

test('AN UNRESOLVED FIELD SKIPS ITS SHAPE ONLY — an unfinished declaration never breaks the canvas', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const r = await page.evaluate(async () => {
        const P = await import('/wizards/ops/panelTypes.js');
        const def = { opType: 'group', panel: 'form2d', bindings: [], template: [{ type: 'user_root', params: {}, uiChildren: [
            { type: 'section', params: { title: 'Shapes' }, children: [
                { type: 'shape_rect', params: { x: 'nosuchparam + 1', y: '0', w: '10', h: '10' } },   // unresolvable
                { type: 'shape_line', params: { x1: '0', y1: '0', x2: '99', y2: '0' } },              // fine
            ]},
        ]}]};
        const items = P.layoutSpecFromOp(def, {}).items;
        return {
            badRect: !!items.find((i) => i.kind === 'rect' && i.w === 10),
            goodLine: !!items.find((i) => i.kind === 'line' && i.x2 === 99),
        };
    });
    expect(r.badRect, 'the unresolvable rect is skipped').toBe(false);
    expect(r.goodLine, 'its healthy sibling still draws').toBe(true);
});
