import { test, expect } from '@playwright/test';

/**
 * t2311 (BACKLOG #10, t2309's own gate) — THE MISSING DECLARATION: teach `split_horizontal`/`split_vertical`'s
 * `ratio` a FIXED-PIXEL pane. t2309 found the declared vocabulary could express ONLY a proportional split
 * (two plain numbers, default '1:1') while `.wiz-2pane` (styles.css:2392-2402) is a fixed 360px controls
 * column plus a visual pane that fills the rest — a structurally different shape a flip would have to fake.
 *
 * The fix extends the SAME `ratio` string (not a second param): a `<n>px` token is a FIXED pane
 * (`flex:0 0 <n>px`), a `*` token FILLS the remainder (`flex:1 1 0`), and anything else still parses as a
 * plain proportional number exactly as before — see `formWidgets.js`'s own `paneFlexCss`.
 *
 * This turn adds the vocabulary only — nothing consumes it yet (drill's own flip is a later turn), so every
 * test here drives `renderUiTree` directly with a synthetic tree, not through any shipped wizard.
 */
test.use({ viewport: { width: 1200, height: 800 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => !!window.ddcsGetBlockProgram, null, { timeout: 20000 });
};

test('EXISTING proportional ratios (default 1:1, and 2:1) render byte-identically to the pre-t2311 parsing', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { renderUiTree } = await import('/ui/formWidgets.js');
        const mk = (ratio) => ([{
            type: 'split_horizontal', params: ratio == null ? {} : { ratio },
            children: {
                LEFT: [{ type: 'section', params: { title: 'A' } }],
                RIGHT: [{ type: 'section', params: { title: 'B' } }],
            },
        }]);
        const render = (tree) => {
            const host = document.createElement('div');
            host.style.cssText = 'width:1000px; height:400px;';
            document.body.appendChild(host);
            renderUiTree(host, tree, [], {});
            const box = host.querySelector(':scope > div');
            const p1 = getComputedStyle(box.children[0]), p2 = getComputedStyle(box.children[1]);
            const out = { grow1: p1.flexGrow, shrink1: p1.flexShrink, grow2: p2.flexGrow, shrink2: p2.flexShrink };
            host.remove();
            return out;
        };
        return { noRatio: render(mk(null)), oneOne: render(mk('1:1')), twoOne: render(mk('2:1')) };
    });
    // no ratio param at all -> falls back to the '1:1' default, same as before
    expect(r.noRatio).toEqual({ grow1: '1', shrink1: '1', grow2: '1', shrink2: '1' });
    expect(r.oneOne).toEqual({ grow1: '1', shrink1: '1', grow2: '1', shrink2: '1' });
    expect(r.twoOne).toEqual({ grow1: '2', shrink1: '1', grow2: '1', shrink2: '1' });
});

test('NEW: a fixed-pixel pane ("360px:*") renders at the declared width, the other pane fills the rest', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { renderUiTree } = await import('/ui/formWidgets.js');
        const host = document.createElement('div');
        host.style.cssText = 'width:1000px; height:400px;';
        document.body.appendChild(host);
        renderUiTree(host, [{
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{ type: 'section', params: { title: 'Controls' } }],
                RIGHT: [{ type: 'section', params: { title: 'Visual' } }],
            },
        }], [], {});
        const box = host.querySelector(':scope > div');
        const pane1 = box.children[0], pane2 = box.children[1];
        const p1 = getComputedStyle(pane1), p2 = getComputedStyle(pane2);
        const out = {
            grow1: p1.flexGrow, shrink1: p1.flexShrink,
            grow2: p2.flexGrow, shrink2: p2.flexShrink,
            width1: pane1.getBoundingClientRect().width,
            width2: pane2.getBoundingClientRect().width,
        };
        host.remove();
        return out;
    });
    expect(r.grow1, 'the fixed pane does not grow').toBe('0');
    expect(r.shrink1, 'the fixed pane does not shrink').toBe('0');
    expect(r.grow2, 'the fill pane grows').toBe('1');
    // the fixed pane renders at its declared width
    expect(r.width1, `fixed pane width (${r.width1}px) matches the declared 360px`).toBeGreaterThan(355);
    expect(r.width1).toBeLessThan(365);
    // the fill pane takes essentially everything else (1000px host minus 360px minus the 16px gap)
    expect(r.width2, `fill pane width (${r.width2}px) took the remaining space`).toBeGreaterThan(600);
});

test('CONTROL — the LEFT/RIGHT children keys already express physical placement (no new vocabulary needed)', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { renderUiTree } = await import('/ui/formWidgets.js');
        const host = document.createElement('div');
        host.style.cssText = 'width:1000px; height:400px;';
        document.body.appendChild(host);
        // mirrors what drill's OWN future flip would declare: controls under LEFT, visual under RIGHT —
        // the opposite of the tree's natural (sim-first) declaration order, expressed purely via the key names.
        renderUiTree(host, [{
            type: 'split_horizontal', params: { ratio: '1:1' },
            children: {
                LEFT: [{ type: 'section', params: { title: 'Controls' } }],
                RIGHT: [{ type: 'section', params: { title: 'Visual' } }],
            },
        }], [], {});
        const controlsEl = [...host.querySelectorAll('.form-sec-title')].find((e) => e.textContent === 'Controls').closest('.form-sec');
        const visualEl = [...host.querySelectorAll('.form-sec-title')].find((e) => e.textContent === 'Visual').closest('.form-sec');
        const out = { controlsLeft: controlsEl.getBoundingClientRect().left, visualLeft: visualEl.getBoundingClientRect().left };
        host.remove();
        return out;
    });
    expect(r.controlsLeft, 'content declared under the LEFT key renders physically left of the RIGHT key\'s content').toBeLessThan(r.visualLeft);
});
