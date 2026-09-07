import { test, expect } from '@playwright/test';

/**
 * t1627 — THE FOUR SHAPE PRIMITIVES: `Wizard Shapes` gets its contents. See the sibling
 * tests/node/wizard-shapes-1627.test.mjs for the two pure `layoutSpecFromOp`-only tests (moved to the node
 * tier at tier-migration work package B) and its own full header comment.
 *
 * t2507 — the shapes below nest under `section` (a real, wired `uiChildren` container, `kind:'section'`,
 * `mouth:'DO'`), not `layout_2d_canvas` — that container was deleted (BACKLOG #61 L7: wired but never useful,
 * see ARCHITECTURE.md's own corrected finding). `section` was chosen deliberately for the test below, which
 * exercises the Blockly DO-mouth ROUND-TRIP mechanism itself (the t1595 childless-discard trap) — a property
 * genuinely worth still testing through SOME live mouth-declaring container, not specific to whichever one
 * used to host it. The spec builder itself never required any particular container (or none at all).
 *
 * This test stays here: it round-trips a REAL Blockly workspace (`window.__blkws`) and drives the real
 * "Open as modal" DOM chrome (reading a live-rendered `<svg class="feature-canvas">`).
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
    { type: 'feature_canvas', params: { panel: 'form2d' } },
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
