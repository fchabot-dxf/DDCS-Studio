import { test, expect } from '@playwright/test';

/**
 * t1627 — THE FOUR SHAPE PRIMITIVES: `Wizard Shapes` gets its contents.
 *
 * The set is the FeatureCanvas's OWN item vocabulary (rect / circle / line / marker→hole — the four kinds it has
 * always drawn). The spec builder (layoutSpecFromOp) CONSUMES them from `def.template` by a GLOBAL, mouth-
 * agnostic flatten+filter (`SHAPE_2D_TYPES`) — never re-derives, and never cares what (if anything) nests them —
 * and every coordinate field takes a number OR an expression over the wizard's live params, evaluated by the ONE
 * evaluator (ops/expr.js, params as the caller-populated scope).
 *
 * t2507 — the shapes below nest under `section` (a real, wired `uiChildren` container, `kind:'section'`,
 * `mouth:'DO'`), not `layout_2d_canvas` — that container was deleted (BACKLOG #61 L7: wired but never useful,
 * see ARCHITECTURE.md's own corrected finding). `section` was chosen deliberately for the FIRST test below,
 * which exercises the Blockly DO-mouth ROUND-TRIP mechanism itself (the t1595 childless-discard trap) — a
 * property genuinely worth still testing through SOME live mouth-declaring container, not specific to whichever
 * one used to host it. The spec builder itself never required any particular container (or none at all).
 *
 * Anti-drift: the numeric claims read layoutSpecFromOp's OWN output (the same items the canvas draws) and the
 * registry — never coordinates transcribed from a screenshot.
 */
test.use({ viewport: { width: 1700, height: 1000 } });

const boot = async (page) => {
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.ddcsLoadBlockStack && window.showApp, null, { timeout: 60000 });
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 60000 });
};

const SHAPES = [
    { type: 'shape_rect', params: { x: '10', y: '10', w: '60', h: '40' } },
    { type: 'shape_circle', params: { cx: '110', cy: '60', dia: '30' } },
    { type: 'shape_line', params: { x1: '0', y1: '0', x2: '150', y2: '90' } },
    { type: 'shape_marker', params: { x: '20', y: '80' } },
];
const HAND_BUILT = [{ type: 'user_root', params: {}, uiChildren: [
    { type: 'panel', params: { panel: 'form2d' } },
    { type: 'section', params: { title: 'Shapes' }, children: SHAPES },
]}];

test('DECLARED → DRAWN: shapes on a DO-mouth container round-trip the Blockly canvas and render in the REAL modal', async ({ page }) => {
    await boot(page);
    await page.evaluate((stack) => window.ddcsLoadBlockStack(stack), HAND_BUILT);
    await page.waitForTimeout(2000);

    // the mouth round-trips: canvas → record keeps all four shapes as the container node's children
    const rt = await page.evaluate(() => {
        const rec = (window.ddcsGetBlockProgram() || [])[0];
        const canvas = rec && (rec.uiChildren || []).find((c) => c.type === 'section');
        return { blocks: window.__blkws.getAllBlocks().length, kids: canvas && canvas.children ? canvas.children.map((c) => c.type) : null };
    });
    expect(rt.kids, 'the DO mouth round-trips all four (the t1595 childless-discard trap, guarded here)').toEqual(SHAPES.map((s) => s.type));

    // the SPEC BUILDER consumes the declaration — the numeric claim, from its own output
    const items = await page.evaluate(async () => {
        const P = await import('/wizards/ops/panelTypes.js');
        const dm = await import('/blocks/devMode.js');
        const rec = (window.ddcsGetBlockProgram() || [])[0];
        const spec = P.layoutSpecFromOp({ opType: 'group', panel: 'form2d', template: [rec], bindings: [] }, {});
        return spec.items.filter((i) => ['rect', 'circle', 'line', 'hole'].includes(i.kind));
    });
    expect(items.find((i) => i.kind === 'rect' && i.x === 10 && i.y === 10 && i.w === 60 && i.h === 40), 'the declared rect, verbatim').toBeTruthy();
    expect(items.find((i) => i.kind === 'circle' && i.cx === 110 && i.cy === 60 && i.r === 15), 'the declared circle (dia 30 → r 15)').toBeTruthy();
    expect(items.find((i) => i.kind === 'line' && i.x1 === 0 && i.x2 === 150 && i.y2 === 90), 'the declared line, verbatim').toBeTruthy();
    expect(items.find((i) => i.kind === 'hole' && i.x === 20 && i.y === 80), 'the declared marker (a hole dot)').toBeTruthy();

    // …and the REAL gesture: Open as modal → the real chrome's canvas draws them
    await page.click('#blkOpenModal');
    await page.waitForFunction(() => {
        const c = document.getElementById('userVizContainer');
        const svg = c && c.querySelector('svg.feature-canvas');
        return !!(svg && svg.children[1] && svg.children[1].querySelectorAll('rect, circle, line').length >= 4);
    }, null, { timeout: 15000 });
    const drawn = await page.evaluate(() => {
        const g = document.getElementById('userVizContainer').querySelector('svg.feature-canvas').children[1];
        return { rects: g.querySelectorAll('rect').length, circles: g.querySelectorAll('circle').length, lines: g.querySelectorAll('line').length };
    });
    expect(drawn.rects, 'stock + the declared rect').toBeGreaterThanOrEqual(2);
    expect(drawn.circles, 'the declared circle + the marker dot').toBeGreaterThanOrEqual(2);
    expect(drawn.lines, 'the declared line').toBeGreaterThanOrEqual(1);
});

test('EXPRESSIONS over LIVE params — through the REAL registered path, and the value drives the drawing', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const P = await import('/wizards/ops/panelTypes.js');
        // the t1610 authoring shape: a formfield declares the knob (matched to an execution socket by var
        // identity) — bindingsToBlocks writes the block form, bindingsFromStack derives it back (one source).
        const specs = [{ param: 'width', type: 'number', default: 80, label: 'Width', match: { type: 'assign', var: '#1' }, key: 'value' }];
        const tpl = [{ type: 'user_root', params: {}, uiChildren: [
            { type: 'panel', params: { panel: 'form2d' } },
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
    await boot(page);
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
