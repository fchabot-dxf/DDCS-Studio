import { test, expect } from '@playwright/test';

/**
 * t2327 (BACKLOG's 6th layer, found gating drill's flip at t2325) — a DECLARED `split_horizontal` used to be a
 * static inline `flex-direction:row`, with no narrower-viewport behavior at all — unlike `.wiz-2pane`'s own
 * `.wiz-controls`/`.wiz-visual` pair (styles.css:2392-2402), which STACKS below 860px
 * (`@media (max-width: 860px)`, styles.css:2445). At the project's own 412px DEFAULT test viewport
 * (`playwright.config.js:40` — the app's own primary mobile target), a fixed-360px LEFT pane consumed nearly
 * all the available width and the fill RIGHT pane collapsed to 0 and rendered off-screen — invisible and
 * undraggable, exactly what t2325 found live.
 *
 * The fix: `.ui-split`/`.ui-split-horiz`/`.ui-split-vert` (styles.css, sharing the SAME media-query block
 * `.wiz-2pane` already stacks under, one source of truth for the breakpoint) — below 860px, a horizontal
 * split stacks column-wise with pane2 (RIGHT) on top and pane1 (LEFT) below, mirroring the shell's own
 * `.wiz-visual{order:1}`/`.wiz-controls{order:2}` mapping. That stacking order comes from LEFT/RIGHT's own
 * existing physical-placement meaning, not a new authored field — no per-node breakpoint override exists
 * (a shared constant, matching the ONE breakpoint every current and foreseeable declared split needs; adding
 * a per-node override is left for whenever a real case needs a different one, not built speculatively).
 * `split_vertical` needs no override at all — it is already a single column at every width.
 *
 * The first two tests here are the SAME assertions `split-node-ratio-2311.spec.js` already makes for EVERY
 * existing ratio value, at BOTH ends of the breakpoint, proving desktop rendering is untouched.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => !!window.ddcsGetBlockProgram, null, { timeout: 20000 });
};

const mkTree = (ratio) => ([{
    type: 'split_horizontal', params: { ratio },
    children: {
        LEFT: [{ type: 'section', params: { title: 'Controls' } }],
        RIGHT: [{ type: 'section', params: { title: 'Visual' } }],
    },
}]);

const render = async (page, tree) => page.evaluate(async (tree) => {
    const { renderUiTree } = await import('/ui/formWidgets.js');
    const host = document.createElement('div');
    host.style.cssText = 'width:100%; max-width:100%;';
    document.body.appendChild(host);
    renderUiTree(host, tree, [], {});
    const box = host.querySelector(':scope > div');
    const pane1 = box.children[0], pane2 = box.children[1];
    const boxCs = getComputedStyle(box);
    const p1 = getComputedStyle(pane1), p2 = getComputedStyle(pane2);
    const r1 = pane1.getBoundingClientRect(), r2 = pane2.getBoundingClientRect();
    const controlsTitle = [...host.querySelectorAll('.form-sec-title')].find((e) => e.textContent === 'Controls').closest('.form-sec');
    const visualTitle = [...host.querySelectorAll('.form-sec-title')].find((e) => e.textContent === 'Visual').closest('.form-sec');
    const out = {
        flexDirection: boxCs.flexDirection,
        grow1: p1.flexGrow, shrink1: p1.flexShrink, order1: p1.order,
        grow2: p2.flexGrow, shrink2: p2.flexShrink, order2: p2.order,
        rect1: { x: r1.x, y: r1.y, w: r1.width, h: r1.height },
        rect2: { x: r2.x, y: r2.y, w: r2.width, h: r2.height },
        controlsTop: controlsTitle.getBoundingClientRect().top,
        visualTop: visualTitle.getBoundingClientRect().top,
    };
    host.remove();
    return out;
}, tree);

test('NARROW (project default, 412px): a horizontal split STACKS — RIGHT (visual) above LEFT (controls)', async ({ page }) => {
    await boot(page);
    const r = await render(page, mkTree('360px:*'));
    expect(r.flexDirection, 'the split stacks into a column below the shared 860px breakpoint').toBe('column');
    // side-by-side X positions collapse to the same column once stacked
    expect(Math.abs(r.rect1.x - r.rect2.x), 'both panes share the same X once stacked (a real column, not an overflowing row)').toBeLessThan(2);
    // RIGHT (visual, pane2) renders ABOVE LEFT (controls, pane1) — matching the shell's own visual-on-top order
    expect(r.visualTop, 'RIGHT content sits above LEFT content when stacked').toBeLessThan(r.controlsTop);
});

test('WIDE (1400px): the SAME split stays side-by-side, unaffected', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await boot(page);
    const r = await render(page, mkTree('360px:*'));
    expect(r.flexDirection, 'the split stays a row above the breakpoint').toBe('row');
    expect(r.rect1.x, 'LEFT renders left of RIGHT').toBeLessThan(r.rect2.x);
    expect(r.rect1.w, 'the fixed pane still renders at its declared width').toBeGreaterThan(355);
    expect(r.rect1.w).toBeLessThan(365);
});

test('every EXISTING ratio value renders byte-identically at a wide viewport (no regression from the responsive rewrite)', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await boot(page);
    const noRatio = await render(page, mkTree(undefined));
    const oneOne = await render(page, mkTree('1:1'));
    const twoOne = await render(page, mkTree('2:1'));
    for (const [name, r] of [['default', noRatio], ['1:1', oneOne]]) {
        expect(r.grow1, `${name} grow1`).toBe('1'); expect(r.grow2, `${name} grow2`).toBe('1');
    }
    expect(twoOne.grow1, '2:1 grow1').toBe('2'); expect(twoOne.grow2, '2:1 grow2').toBe('1');
});

test('split_vertical needs no override — always a single column, at both widths', async ({ page }) => {
    const vTree = [{
        type: 'split_vertical', params: { ratio: '1:1' },
        children: { TOP: [{ type: 'section', params: { title: 'Controls' } }], BOTTOM: [{ type: 'section', params: { title: 'Visual' } }] },
    }];
    await boot(page);
    const narrow = await render(page, vTree);
    expect(narrow.flexDirection, 'vertical split is a column at the default (narrow) viewport').toBe('column');
    await page.setViewportSize({ width: 1400, height: 1000 });
    const wide = await render(page, vTree);
    expect(wide.flexDirection, 'vertical split is STILL a column at a wide viewport — nothing to stack').toBe('column');
});
